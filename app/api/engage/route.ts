import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { withCache, ck } from '@/lib/server-cache'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { apiLog } from '@/lib/logger'
import { EngageSchema, parseBody } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) {
    apiLog({ route: 'engage', ip, fromCache: false, durationMs: 0, status: 'rate_limited' })
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  let rawBody: unknown
  try { rawBody = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed_ = parseBody(EngageSchema, rawBody)
  if (!parsed_.ok) return parsed_.response
  const { topic, presentStudents, totalStudents, absentNames, grade } = parsed_.data

  try {
    // Tally interests across present students
    const interestCount: Record<string, number> = {}
    presentStudents.forEach(s => {
      s.interests.forEach(i => {
        interestCount[i] = (interestCount[i] ?? 0) + 1
      })
    })

    const sortedInterests = Object.entries(interestCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)

    const interestSummary = sortedInterests.length > 0
      ? sortedInterests.map(([i, c]) => `${i} (${c} kids)`).join(', ')
      : 'varied interests'

    const absentLine = absentNames.length > 0
      ? `Absent today: ${absentNames.slice(0, 4).join(', ')}${absentNames.length > 4 ? ` +${absentNames.length - 4} more` : ''}`
      : 'Full attendance today'

    const gradeContext = grade ? `Grade ${grade}` : 'primary/middle school'

    const prompt = `You are a master teacher trainer for Indian government schools. Your job: write a powerful class opener AND show students where this topic lives in their real world.

Class today:
- Topic: "${topic}"
- Students: ${gradeContext}, ${presentStudents.length} of ${totalStudents} present
- ${absentLine}
- Top interests: ${interestSummary}

TASK 1 — "hook" (2-3 sentences, max 65 words):
This is what the teacher READS OUT LOUD in the first 60 seconds of class.
Rules:
- Sentence 1: Start with a BOLD question or surprising fact rooted in Indian everyday life. Use ONE of: cricket scores/overs, chai/dosa/roti prices, auto-rickshaw fares, train journeys, Diwali/Eid/Holi context, IPL team stats, local market bargaining, mobile data usage, school exam marks. Pick what fits "${topic}" best.
- Sentence 2: Directly connect that example to today's topic.
- Sentence 3 (optional): One 30-second action every student does RIGHT NOW.
Write in simple English. NEVER be vague.

TASK 2 — "watchNote": ONE sentence (max 20 words) about absent students follow-up. Empty string if full attendance.

TASK 3 — "realLifeExamples": Array of exactly 3 short sentences.
Each sentence shows WHERE "${topic}" appears in the daily life of ${gradeContext} Indian students.
Rules:
- Draw from their top interests: ${interestSummary}
- Use Indian everyday context: cricket, chai, market prices, mobile data, farming, cooking, festivals, transport
- Age-appropriate for ${gradeContext}
- Address the student directly: start with "When you..." or "Every time you..." or "Next time you..."
- Max 20 words per sentence. Be specific and concrete, never generic.

TASK 4 — "topInterest": single top interest word.

Return ONLY valid JSON: {"hook": "...", "watchNote": "...", "realLifeExamples": ["...", "...", "..."], "topInterest": "..."}`

    const topInterestKeys = sortedInterests.slice(0, 3).map(([i]) => i).sort().join('~')
    const absentBucket = absentNames.length === 0 ? 'full' : absentNames.length < 4 ? 'few' : 'many'
    const t = Date.now()
    const { value: parsed, fromCache } = await withCache(
      ck('engage', topic.toLowerCase().trim(), grade ?? '', topInterestKeys, absentBucket),
      86400,
      async () => {
        const raw = await callAI([{ role: 'user', content: prompt }])
        return JSON.parse(raw)
      },
    )
    apiLog({ route: 'engage', ip, fromCache, durationMs: Date.now() - t, status: 'ok' })
    return NextResponse.json(parsed)
  } catch (err) {
    apiLog({ route: 'engage', ip, fromCache: false, durationMs: 0, status: 'error', error: String(err) })
    const topInterest = Object.entries(
      presentStudents.reduce((acc: Record<string, number>, s) => {
        s.interests.forEach(i => { acc[i] = (acc[i] ?? 0) + 1 })
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'real life'

    return NextResponse.json({
      hook: `Connect "${topic}" to ${topInterest} — find an example from students' world to open the class.`,
      watchNote: absentNames.length > 0
        ? `Follow up with ${absentNames[0]}${absentNames.length > 1 ? ` and ${absentNames.length - 1} others` : ''} next class.`
        : 'Great — everyone is present today.',
      realLifeExamples: [
        `When you use ${topInterest} in daily life, you are applying ${topic}.`,
        `Look around you — ${topic} is happening right now in your neighbourhood.`,
        `Every time you solve a real problem, ${topic} is the tool you are using.`,
      ],
      topInterest,
    })
  }
}
