import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyStudentCookie } from '@/lib/student-auth'
import { callAI } from '@/lib/ai'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { todayDateStr, traitForDate } from '@/lib/personality-traits'
import type { PersonalityStory } from '@/lib/types'

// callAI's primary+fallback retry chain can take up to ~90s on failure.
export const maxDuration = 60

function isValidOption(o: unknown): boolean {
  if (o == null || typeof o !== 'object') return false
  const opt = o as Record<string, unknown>
  return (
    typeof opt.text === 'string' &&
    typeof opt.outcome === 'string' &&
    (opt.leadsToward === 'wise' || opt.leadsToward === 'regret')
  )
}

function isValidStep(v: unknown): boolean {
  if (v == null || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return (
    typeof s.scene === 'string' &&
    typeof s.question === 'string' &&
    Array.isArray(s.options) &&
    s.options.length === 3 &&
    (s.options as unknown[]).every(isValidOption)
  )
}

// { wise: string, mixed: string, regret: string } — used for endings,
// personalityAnalysis, and learningSummary, which all share this shape.
function isValidTriple(v: unknown): boolean {
  if (v == null || typeof v !== 'object') return false
  const t = v as Record<string, unknown>
  return typeof t.wise === 'string' && typeof t.mixed === 'string' && typeof t.regret === 'string'
}

function isValidStory(v: unknown): v is PersonalityStory {
  if (v == null || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return (
    typeof s.title === 'string' &&
    typeof s.introduction === 'string' &&
    Array.isArray(s.steps) &&
    s.steps.length === 3 &&
    (s.steps as unknown[]).every(isValidStep) &&
    isValidTriple(s.endings) &&
    isValidTriple(s.personalityAnalysis) &&
    isValidTriple(s.learningSummary)
  )
}

// GET /api/personality-story — today's personality-development story for the
// authenticated student. One story per student per calendar day, persisted in
// `personality_stories` so it's stable across devices and serverless cold starts.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const studentId = verifyStudentCookie(req.cookies.get('edu-student-id')?.value)
  if (!studentId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createAdminClient()
  const date = todayDateStr()

  const { data: existing } = await supabase
    .from('personality_stories')
    .select('trait, story')
    .eq('student_id', studentId)
    .eq('date', date)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ trait: existing.trait, story: existing.story as PersonalityStory })
  }

  const { data: student } = await supabase
    .from('students').select('name, interests').eq('id', studentId).single()
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const trait = traitForDate(date)
  const interests: string[] = student.interests ?? []
  const interestHint = interests.length
    ? `Weave in one of these interests as the setting or characters: ${interests.slice(0, 3).join(', ')}.`
    : 'Use a simple everyday Indian setting — school, playground, home, or market.'

  const prompt =
`You are writing a short, interactive personality-development story for a young Indian schoolchild named ${student.name.split(' ')[0]}, in Class 1 to Class 5 (age 6-10).

Personality trait to teach: ${trait}
${interestHint}

READING LEVEL — this is the most important rule. Write for a 6-10 year old reading alone:
- Short sentences only — about 8-12 words each, never long or twisty.
- Simple, everyday words a young child already knows. No big or abstract words (don't say things like "consequence," "reflect," "prioritize" — say what actually happened instead).
- Concrete and visual — say exactly what the character sees/does/says, not how they "feel" in the abstract.
- Never explain the trait itself or lecture the reader — the child should feel the story, not be told a lesson mid-story.

SETTING — keep it to a child's real world. Good scenarios: school, classroom, playground, friends, siblings, parents, grandparents, festivals (Diwali, Holi, Eid, etc.), sharing food or toys, homework, a cricket/sports match, pocket money, finding something that isn't theirs, a promise to a friend, screen time / TV / games. Do NOT use grown-up settings like jobs, careers, exams-as-high-stakes, dating, or money problems beyond simple pocket money.

Write the story as exactly 3 connected scenes ("steps"), each ending at a decision point. Each scene must continue directly from what happened in the previous one — the SAME ongoing situation, not a new unrelated one each time. Give it something real a child would recognize (a friendship, a game, a promise, a family moment) — not a generic "be nice" filler scenario.

First, write an "introduction" — 1-2 short sentences that introduce the character and where they are, before anything happens yet.

For each of the 3 steps, write:
- "scene": 2-3 short sentences of story. For step 1, this sets up the situation right after the introduction. For steps 2 and 3, this continues from whatever happened after the previous choice. End right at the moment of a decision.
- "question": one short sentence asking what the character should do next.
- "options": exactly 3 short choices (a few words each, simple words). For EACH option, also write:
  - "outcome": 1-2 short sentences of what happens next, told as story — this becomes the opening of the next scene, so keep it concrete and continuable, not a judgment.
  - "leadsToward": "wise" if this choice reflects ${trait} well, or "regret" if it doesn't. Choices should feel understandable either way (never villainous or scary), just leaning one way or the other.

After the 3 steps, write three possible closing scenes in "endings" — these are NOT verdicts or advice, they are genuine continuations of the story, as if the reader is still following the character. Each must be specific to what actually happened across the 3 steps, not a generic wrap-up:
- "wise": the character mostly chose well through the story. Show the concrete good result those specific choices led to, AND have someone (a friend, parent, or teacher) or the character themself plainly say something warm, in their own words — the child should clearly come away knowing "I did well here."
- "regret": the character mostly chose poorly. Spell out the actual, specific thing that went wrong, and because of which choice — concrete and simple, not a vague feeling — then end on the character's own quiet realization of what they'd do differently next time. Keep it gentle, never harsh or scary, and never stated as a lesson to the reader.
- "mixed": a softer in-between scene — name one specific thing that went right and one that went less well, then a small realization.

Then write "personalityAnalysis" — one short, warm paragraph (2-3 simple sentences) for EACH of wise/mixed/regret, reflecting on what THIS story's choices showed about the child, written directly to them ("You..."). Plain, encouraging, simple words only — not a score, not a list of traits, just a kind observation matching that ending.

Then write "learningSummary" — one short, friendly sentence for EACH of wise/mixed/regret — a simple, practical tip for "next time," in plain child-friendly words.

Also write a short "title" (3-6 simple words) for the story.

No violence, no scary content, no narrator voice stating a moral mid-story — everything in the steps and endings must come through as the character's own experience. The personalityAnalysis and learningSummary are the only places allowed to speak directly to the reader.

Return ONLY valid JSON, no markdown, no extra text:
{
  "title": "string",
  "introduction": "string",
  "steps": [
    {
      "scene": "string",
      "question": "string",
      "options": [
        { "text": "string", "outcome": "string", "leadsToward": "wise" },
        { "text": "string", "outcome": "string", "leadsToward": "wise" },
        { "text": "string", "outcome": "string", "leadsToward": "regret" }
      ]
    }
  ],
  "endings": { "wise": "string", "mixed": "string", "regret": "string" },
  "personalityAnalysis": { "wise": "string", "mixed": "string", "regret": "string" },
  "learningSummary": { "wise": "string", "mixed": "string", "regret": "string" }
}
(steps must contain exactly 3 entries, each with exactly 3 options)`

  try {
    const text = await callAI([{ role: 'user', content: prompt }], { maxTokens: 2000 })
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match?.[0] ?? cleaned)
    if (!isValidStory(parsed)) throw new Error('AI returned an incomplete story')

    const story: PersonalityStory = { ...parsed, trait }

    // Insert with unique(student_id, date) as the guard against a race between
    // two concurrent requests (e.g. two devices) both missing the cache above.
    const { error: insertErr } = await supabase
      .from('personality_stories')
      .insert({ id: crypto.randomUUID(), student_id: studentId, date, trait, story })

    if (insertErr) {
      // Someone else won the race — fetch what they inserted instead of erroring.
      const { data: winner } = await supabase
        .from('personality_stories')
        .select('trait, story')
        .eq('student_id', studentId)
        .eq('date', date)
        .maybeSingle()
      if (winner) return NextResponse.json({ trait: winner.trait, story: winner.story as PersonalityStory })
    }

    return NextResponse.json({ trait, story })
  } catch (err) {
    console.error('[personality-story] generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 })
  }
}
