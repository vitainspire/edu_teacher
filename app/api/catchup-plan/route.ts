import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { withCache, ck } from '@/lib/server-cache'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { apiLog } from '@/lib/logger'
import { CatchupPlanSchema, parseBody } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) {
    apiLog({ route: 'catchup-plan', ip, fromCache: false, durationMs: 0, status: 'rate_limited' })
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  let rawBody: unknown
  try { rawBody = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed_ = parseBody(CatchupPlanSchema, rawBody)
  if (!parsed_.ok) return parsed_.response
  const { studentName, topic, subject, grade, score } = parsed_.data

  const scoreContext = score != null
    ? `The student scored ${score}% on the test for this topic — meaning they missed the lesson AND struggled on the test.`
    : `No test score yet for this topic.`

  const prompt = `You are helping a teacher in an Indian government school create a catch-up plan for a student who was absent.

Student: ${studentName}, Grade ${grade}, Subject: ${subject}
Topic missed: ${topic}
${scoreContext}

The student has no phone or internet. This plan will be given as a written note or explained verbally by the teacher in a 10-minute one-on-one session.

Return a JSON object with exactly these fields:
- explanation: Simple 3-4 sentence explanation of "${topic}" in plain language a Grade ${grade} student can understand. Use an everyday Indian example (market, cricket, cooking, etc.)
- practiceQuestions: Array of exactly 4 short written questions the student can do in a notebook. Make them progressively harder.
- activity: One practical 10-minute activity the teacher can do with the student using no special materials (chalk, notebook, or verbal only)
- focusNote: One sentence telling the teacher exactly what concept to focus on first based on the grade level and topic${score != null && score < 50 ? ' (student scored low so start from basics)' : ''}`

  const t = Date.now()
  try {
    const scoreBucket = score == null ? 'none' : score < 50 ? 'low' : score < 75 ? 'medium' : 'high'
    const { value: parsed, fromCache } = await withCache(
      ck('catchup', topic.toLowerCase().trim(), subject.toLowerCase().trim(), grade, scoreBucket),
      604800,
      async () => {
        const text = await callAI([{ role: 'user', content: prompt }], { maxTokens: 800 })
        return JSON.parse(text)
      },
    )
    apiLog({ route: 'catchup-plan', ip, fromCache, durationMs: Date.now() - t, status: 'ok' })
    return NextResponse.json({
      explanation: parsed.explanation ?? '',
      practiceQuestions: Array.isArray(parsed.practiceQuestions) ? parsed.practiceQuestions : [],
      activity: parsed.activity ?? '',
      focusNote: parsed.focusNote ?? '',
    })
  } catch {
    apiLog({ route: 'catchup-plan', ip, fromCache: false, durationMs: Date.now() - t, status: 'error' })
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
