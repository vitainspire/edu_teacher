import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouter } from '@/lib/openrouter'
import { withCache, ck } from '@/lib/server-cache'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { apiLog } from '@/lib/logger'
import { RecoverySchema, parseBody } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) {
    apiLog({ route: 'recovery', ip, fromCache: false, durationMs: 0, status: 'rate_limited' })
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  const t = Date.now()
  try {
    let rawBody: unknown
    try { rawBody = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const parsed_ = parseBody(RecoverySchema, rawBody)
    if (!parsed_.ok) return parsed_.response
    const { grade, topic, attempts, previousApproaches, studentName } = parsed_.data

    const prevList = previousApproaches?.length
      ? `\nPrevious approaches already tried (do NOT repeat these):\n${previousApproaches.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}`
      : '\nNo previous approaches tried yet.'

    const prompt = `A Grade ${grade} student named ${studentName} in a rural Indian school has tried to understand "${topic}" ${attempts} time(s) without success.
${prevList}

Generate ONE completely new explanation approach that:
1. Uses a real-life Indian example — from cricket, food, farming, festivals, or daily village life
2. Can be explained verbally in class — no materials or equipment needed
3. Is genuinely different from all previous approaches listed above
4. Ends with one short question the teacher can ask to immediately check if the student understood

Return valid JSON only:
{
  "explanation": "The new explanation approach (2-4 sentences)",
  "example": "The specific real-life Indian example to use (1-2 sentences)",
  "checkQuestion": "One short question to ask the student to check understanding"
}`

    const prevKey = (previousApproaches ?? []).slice().sort().join('~~')
    const { value: parsed, fromCache } = await withCache(
      ck('recovery', topic.toLowerCase().trim(), grade, attempts, prevKey),
      604800,
      async () => {
        const result = await callOpenRouter([{ role: 'user', content: prompt }])
        return JSON.parse(result)
      },
    )
    apiLog({ route: 'recovery', ip, fromCache, durationMs: Date.now() - t, status: 'ok' })
    return NextResponse.json(parsed)
  } catch (err) {
    apiLog({ route: 'recovery', ip, fromCache: false, durationMs: Date.now() - t, status: 'error', error: String(err) })
    return NextResponse.json(
      {
        explanation: 'Try explaining the concept using a story from everyday life.',
        example: 'Use something the student sees every day — like dividing a roti equally.',
        checkQuestion: 'Can you show me on your fingers how you would divide this?',
      },
      { status: 200 }
    )
  }
}
