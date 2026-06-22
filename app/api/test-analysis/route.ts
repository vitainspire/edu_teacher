import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouter } from '@/lib/openrouter'

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1]
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}')
  if (first !== -1 && last !== -1) return raw.slice(first, last + 1)
  return raw
}

export async function POST(req: NextRequest) {
  try {
    const { topic, totalMarks, grade, subject, results }: {
      topic: string
      totalMarks: number
      grade: string
      subject: string
      results: Array<{ name: string; score: number; percentage: number }>
    } = await req.json()

    if (!results?.length) return NextResponse.json({ error: 'No results provided' }, { status: 400 })

    const avg = results.reduce((s, r) => s + r.percentage, 0) / results.length
    const sorted = [...results].sort((a, b) => b.percentage - a.percentage)
    const resultLines = sorted
      .map(r => `  ${r.name}: ${r.score}/${totalMarks} (${Math.round(r.percentage)}%)`)
      .join('\n')

    const prompt = `You are an experienced Indian school teacher reviewing a class test.

Subject: ${subject}, Grade: ${grade}
Topic: ${topic}
Total Marks: ${totalMarks}
Class Average: ${Math.round(avg)}%

Student Results (best to lowest):
${resultLines}

Write a short analysis in 4 parts. Be specific — use student names. Be warm and practical.
1. Summary: How did the class do overall? (1-2 sentences)
2. Top Performers: Which 2-3 students did well and what did they demonstrate?
3. Needs Help: Which students scored below 50%? What should the teacher watch for?
4. Next Action: One concrete step the teacher should take next (re-teach a subtopic, pair weaker with stronger, give extra practice, etc.)

Return ONLY valid JSON:
{
  "summary": "...",
  "topPerformers": "...",
  "needHelp": "...",
  "action": "..."
}`

    const raw = await callOpenRouter([{ role: 'user', content: prompt }])
    const parsed = JSON.parse(extractJSON(raw))
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('test-analysis error:', err)
    return NextResponse.json({ error: 'Failed to analyse test' }, { status: 500 })
  }
}
