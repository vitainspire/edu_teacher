import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouter } from '@/lib/openrouter'

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1]
  const first = raw.indexOf('['), last = raw.lastIndexOf(']')
  if (first !== -1 && last !== -1) return raw.slice(first, last + 1)
  return raw
}

export async function POST(req: NextRequest) {
  try {
    const { topics, totalWeeks, sessionsPerWeek, subject, grade }: {
      topics: Array<{ id: string; topic: string; description?: string }>
      totalWeeks: number
      sessionsPerWeek: number
      subject: string
      grade: string
    } = await req.json()

    const totalSessions = totalWeeks * sessionsPerWeek
    const topicList = topics
      .map((t, i) => `${i + 1}. ${t.topic}${t.description ? ` — ${t.description}` : ''}`)
      .join('\n')

    const prompt = `You are helping an Indian school teacher plan their academic year for ${subject}, Grade ${grade}.

Total teaching sessions available: ${totalSessions} (${totalWeeks} weeks × ${sessionsPerWeek} sessions per week)
Number of topics to cover: ${topics.length}

Topics:
${topicList}

Assign a realistic number of sessions to each topic based on its complexity and importance.
- Simple/short topics: 8–12 sessions
- Medium topics: 12–18 sessions
- Complex/foundational topics: 18–25 sessions
- The total MUST add up to exactly ${totalSessions}
- Every topic must get at least 5 sessions

Return ONLY a valid JSON array in this exact order (same order as the topics above):
[
  { "id": "${topics[0]?.id ?? 'id'}", "estimatedSessions": 15, "rationale": "one short sentence why" },
  ...
]`

    const raw = await callOpenRouter([{ role: 'user', content: prompt }])
    const parsed: Array<{ id: string; estimatedSessions: number; rationale: string }> = JSON.parse(extractJSON(raw))

    // Safety: ensure every topic has an entry with a valid number
    const fallback = Math.round(totalSessions / topics.length)
    const plan = topics.map((t, i) => ({
      id: t.id,
      estimatedSessions: parsed[i]?.estimatedSessions > 0 ? parsed[i].estimatedSessions : fallback,
      rationale: parsed[i]?.rationale ?? '',
    }))

    return NextResponse.json({ plan })
  } catch (err) {
    console.error('[year-plan]', err)
    return NextResponse.json({ error: 'Failed to generate year plan' }, { status: 500 })
  }
}
