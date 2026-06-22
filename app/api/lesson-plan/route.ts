import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouter } from '@/lib/openrouter'

interface TopicInfo {
  topic: string
  description: string
  weekNumber?: number
  isCompleted: boolean
}

export async function POST(req: NextRequest) {
  try {
    const { topics, className, subject, studentInterests }: {
      topics: TopicInfo[]
      className: string
      subject: string
      studentInterests: string[]   // top interests across class
    } = await req.json()

    const pending = topics.filter(t => !t.isCompleted)
    const done    = topics.filter(t => t.isCompleted).length

    const topicList = pending
      .slice(0, 10)
      .map((t, i) => `${i + 1}. ${t.topic}${t.description ? ` (${t.description})` : ''}${t.weekNumber ? ` [Week ${t.weekNumber}]` : ''}`)
      .join('\n')

    const interestLine = studentInterests.length > 0
      ? `Class interests: ${studentInterests.slice(0, 5).join(', ')}`
      : 'Student interests not recorded yet'

    const prompt = `You are helping a teacher at an Indian government school plan their lessons.

Class: ${className}
Subject: ${subject}
${interestLine}
Topics completed so far: ${done}

Remaining syllabus topics (up to 10):
${topicList || 'No pending topics'}

Create a practical week-by-week lesson plan for the NEXT 4 weeks covering the pending topics above.
For each week:
- Assign 1-2 topics
- Write one short teaching tip (max 20 words) connecting the topic to the students' interests
- Suggest one quick activity or example (max 15 words)

Be warm, practical, and specific. No jargon.

Return ONLY valid JSON:
{
  "weeks": [
    {
      "week": 1,
      "topics": ["topic name"],
      "tip": "short teaching tip using student interests",
      "activity": "quick activity or example"
    }
  ]
}`

    const raw = await callOpenRouter([{ role: 'user', content: prompt }])
    const parsed = JSON.parse(raw)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[lesson-plan]', err)
    return NextResponse.json({ weeks: [] }, { status: 200 })
  }
}
