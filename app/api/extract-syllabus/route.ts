import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'

const SYSTEM = `You are a school syllabus parser for Indian curriculum (CBSE/State boards).
Parse the input and return structured topics with their sub-topics.

Return ONLY valid JSON (no markdown, no code fences):
{
  "topics": [
    {
      "topic": "unit or chapter name",
      "description": "brief one-line description of the unit",
      "subTopics": ["individual lesson or concept 1", "individual lesson or concept 2"],
      "weekNumber": 1
    }
  ]
}

Rules:
- Each unit/chapter = one topic entry
- subTopics = array of individual lessons, concepts, or sub-units listed under that unit
- description = one short sentence describing the overall unit (not a list)
- Assign weekNumber sequentially starting from 1
- If no clear units, treat each row/line as one topic with empty subTopics
- Keep topic names short and clean
- Each subTopic should be a meaningful standalone lesson (not just a single word)`

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1]
  const firstBrace = raw.indexOf('{')
  const lastBrace  = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1) return raw.slice(firstBrace, lastBrace + 1)
  return raw
}

export async function POST(req: NextRequest) {
  try {
    const { text, image }: { text?: string; image?: string } = await req.json()

    if (!text && !image) {
      return NextResponse.json({ error: 'Provide text or image' }, { status: 400 })
    }

    const messages = image
      ? [{ role: 'user' as const, content: [
          { type: 'image_url' as const, image_url: { url: image } },
          { type: 'text'      as const, text: SYSTEM },
        ]}]
      : [{ role: 'user' as const, content: `${SYSTEM}\n\nSyllabus to parse:\n${text}` }]

    const raw = await callAI(messages, { jsonMode: false, temperature: 0.1 })

    if (!raw) {
      return NextResponse.json({ error: 'AI returned an empty response. Please try again.' }, { status: 500 })
    }

    let parsed: { topics?: unknown[] }
    try {
      parsed = JSON.parse(extractJSON(raw))
    } catch {
      console.error('[extract-syllabus] JSON parse failed, raw:', raw.slice(0, 300))
      return NextResponse.json(
        { error: 'Could not parse AI response. Try rephrasing your syllabus text.' },
        { status: 500 }
      )
    }

    const topics = (parsed.topics ?? [])
      .map((t: unknown, i: number) => {
        const row = t as Record<string, unknown>
        const rawSubs = Array.isArray(row.subTopics) ? row.subTopics : []
        return {
          topic:       String(row.topic      ?? `Unit ${i + 1}`).trim(),
          description: String(row.description ?? '').trim(),
          weekNumber:  Number.isInteger(row.weekNumber) ? (row.weekNumber as number) : i + 1,
          subTopics:   rawSubs.map((s: unknown) => String(s).trim()).filter(Boolean),
        }
      })
      .filter((t: { topic: string }) => t.topic.length > 0)

    return NextResponse.json({ topics })
  } catch (err) {
    console.error('[extract-syllabus] Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected server error. Please try again.' }, { status: 500 })
  }
}
