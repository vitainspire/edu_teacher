import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getClientIp } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

interface GapTopic {
  topic: string
  avgMastery: number
  weakStudentCount: number
  totalStudents: number
}

interface BridgeNote {
  concept: string   // name of the prior-grade concept woven in here
  text: string      // what the teacher says — 1-2 sentences, natural teacher voice
}

interface LessonSection {
  type: 'teach' | 'check'
  title: string
  content: string       // full teaching content, gap explanation already woven in
  bridgeNote?: BridgeNote  // only when a gap concept naturally arose in this section
}

// POST /api/smart-lesson
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  let body: { classId: string; topic: string; subject: string; grade: string; teacherId?: string; subtopic?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { classId, topic, subject, grade, subtopic } = body
  if (!classId || !topic || !subject || !grade) {
    return NextResponse.json({ error: 'classId, topic, subject, grade are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Active students in this class
  const { data: students } = await admin
    .from('students')
    .select('id, name')
    .eq('class_id', classId)
    .eq('is_active', true)

  const studentIds = (students ?? []).map((s: { id: string }) => s.id)
  const totalStudents = studentIds.length

  // 2. All marks for these students
  const { data: allMarks } = await admin
    .from('marks')
    .select('student_id, score, tests(topic, total_marks, subject)')
    .in('student_id', studentIds)

  // 3. Per-topic avg mastery from marks
  const topicStats = new Map<string, { totalPct: number; count: number }>()

  type MarkRow = { student_id: string; score: number; tests: { topic: string; total_marks: number; subject: string } | null }
  const marks = (allMarks ?? []) as unknown as MarkRow[]

  for (const mark of marks) {
    if (!mark.tests || !mark.tests.total_marks) continue
    const t = mark.tests.topic
    const pct = mark.score / mark.tests.total_marks
    const cur = topicStats.get(t) ?? { totalPct: 0, count: 0 }
    topicStats.set(t, { totalPct: cur.totalPct + pct, count: cur.count + 1 })
  }

  // 4. Also factor in topic_mastery table
  const { data: masteryRows } = await admin
    .from('topic_mastery')
    .select('student_id, topic, mastery')
    .in('student_id', studentIds)

  for (const row of (masteryRows ?? []) as { student_id: string; topic: string; mastery: number }[]) {
    const cur = topicStats.get(row.topic) ?? { totalPct: 0, count: 0 }
    topicStats.set(row.topic, { totalPct: cur.totalPct + row.mastery, count: cur.count + 1 })
  }

  // 5. Find weak topics (avg < 65%), excluding today's topic
  const gapTopics: GapTopic[] = []
  for (const [t, stats] of topicStats.entries()) {
    if (t.toLowerCase() === topic.toLowerCase()) continue
    const avg = stats.totalPct / stats.count
    if (avg < 0.65) {
      const weakCount = marks.filter(m => {
        if (!m.tests || m.tests.topic !== t || !m.tests.total_marks) return false
        return m.score / m.tests.total_marks < 0.65
      }).length

      gapTopics.push({
        topic: t,
        avgMastery: Math.round(avg * 100) / 100,
        weakStudentCount: weakCount,
        totalStudents,
      })
    }
  }

  const topGaps = gapTopics
    .sort((a, b) => a.avgMastery - b.avgMastery)
    .slice(0, 3)

  // 6. Build AI prompt
  const gapContext = topGaps.length > 0
    ? `Assessment data shows these prior concepts are weak in this class:
${topGaps.map(g => `- "${g.topic}": ${Math.round(g.avgMastery * 100)}% avg mastery (${g.weakStudentCount}/${g.totalStudents} students weak)`).join('\n')}

Your job: at the exact moment each of these concepts naturally becomes relevant while explaining today's topic, explain it briefly in plain teacher language — as if you're just explaining the topic really well. Never announce "we need to review this" or "this is from last year" or use words like prerequisite, recap, or revision. It must feel like one seamless lesson.`
    : `No specific knowledge gaps detected. Write a thorough, well-explained lesson that naturally reinforces foundational ideas as part of teaching.`

  const systemPrompt = `You are an expert classroom teacher writing a practical lesson plan.

Your teaching style: when students are missing prior knowledge, you never stop class or call it out. Instead, you explain the missing concept at exactly the moment it becomes useful for understanding today's topic — woven into your explanation so naturally that students who already know it hear a good reminder, and students who missed it learn it without feeling behind.

This is not remediation. It is just excellent, thorough teaching.`

  const userPrompt = `Write a SHORT classroom lesson plan for:

Topic: ${topic}${subtopic ? `\nSubtopic (focus specifically on this): ${subtopic}` : ''}
Subject: ${subject}
Grade: ${grade}
Students: ${totalStudents}

${gapContext}

Return ONLY valid JSON (no markdown, no extra text):
{
  "hook": "One short punchy question or statement — max 15 words",
  "sections": [
    {
      "type": "teach",
      "title": "3-4 word title",
      "content": "1-2 sentences max. Direct, simple, classroom-ready.",
      "bridgeNote": {
        "concept": "Prior concept name",
        "text": "One sentence — what the teacher says naturally at this moment"
      }
    }
  ],
  "closingActivity": "One sentence. Doable immediately in class."
}

Rules:
- 3 to 4 sections total
- Most sections type "teach", max 1 type "check"
- bridgeNote OPTIONAL — only when a gap concept naturally surfaces; every listed gap must appear once
- content: never say "review", "recall", "prerequisite", "from last year"
- Keep everything SHORT — this is a quick reference card, not an essay`

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'EduTeach Smart Lesson',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1400,
    }),
  })

  if (!aiRes.ok) {
    const err = await aiRes.text()
    return NextResponse.json({ error: `AI error: ${err}` }, { status: 500 })
  }

  const aiData = await aiRes.json() as { choices: { message: { content: string } }[] }
  const raw = aiData.choices?.[0]?.message?.content ?? ''

  let lesson: { hook: string; sections: LessonSection[]; closingActivity: string }
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    lesson = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'AI returned malformed JSON', raw }, { status: 500 })
  }

  return NextResponse.json({
    topic,
    subtopic: subtopic || undefined,
    subject,
    grade,
    totalStudents,
    gapTopics: topGaps,
    lesson,
  })
}
