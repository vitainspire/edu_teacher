import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { withCache, ck } from '@/lib/server-cache'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { apiLog } from '@/lib/logger'
import { UnderstandingCheckSchema, parseBody } from '@/lib/schemas'

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1]
  const firstBrace = raw.indexOf('{')
  const lastBrace  = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1) return raw.slice(firstBrace, lastBrace + 1)
  return raw
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) {
    apiLog({ route: 'understanding-check', ip, fromCache: false, durationMs: 0, status: 'rate_limited' })
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  let rawBody: unknown
  try { rawBody = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed_ = parseBody(UnderstandingCheckSchema, rawBody)
  if (!parsed_.ok) return parsed_.response
  const { topic, subject, grade } = parsed_.data

  const prompt =
`You are helping a teacher in an Indian government school check if students understood today's lesson on "${topic}" (${subject}, Grade ${grade}).

Write exactly 2 short oral questions the teacher will READ ALOUD to the whole class after teaching. Students answer by raising hands or saying aloud — no writing needed.

Question 1 — RECALL: Tests if students can remember a key fact, term, or definition from the lesson. One sentence. Simple enough that any student who was paying attention can answer.

Question 2 — APPLICATION: Tests if students can USE the concept in a simple real-life situation. One sentence. Connects to everyday Indian life (cricket, food, market, farming, family, mobile phone, etc.).

Rules:
- Both questions must be about "${topic}" specifically
- No yes/no questions — students must actually think
- Grade ${grade} language — short, clear words
- Do NOT say "Question 1:" or "Question 2:" in your output — just the question text

Return ONLY valid JSON:
{"questions": ["<recall question>", "<application question>"]}`

  const t = Date.now()
  try {
    const { value: result, fromCache } = await withCache<{ questions: string[] }>(
      ck('understanding-check-v1', topic.toLowerCase().trim(), subject.toLowerCase().trim(), grade),
      86400,
      async () => {
        const raw = await callAI([{ role: 'user', content: prompt }], { maxTokens: 300 })
        const parsed = JSON.parse(extractJSON(raw)) as { questions?: unknown[] }
        if (!Array.isArray(parsed.questions) || parsed.questions.length < 2) {
          throw new Error('Invalid response shape')
        }
        return { questions: [String(parsed.questions[0]), String(parsed.questions[1])] }
      },
    )
    apiLog({ route: 'understanding-check', ip, fromCache, durationMs: Date.now() - t, status: 'ok' })
    return NextResponse.json(result)
  } catch {
    apiLog({ route: 'understanding-check', ip, fromCache: false, durationMs: Date.now() - t, status: 'error' })
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
