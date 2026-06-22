import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, students, totalMarks, topic }: {
      imageBase64: string   // data:image/...;base64,...
      students: Array<{ id: string; name: string }>
      totalMarks: number
      topic: string
    } = await req.json()

    if (!imageBase64 || !students?.length) {
      return NextResponse.json({ entries: [] })
    }

    const studentList = students.map((s, i) => `${i + 1}. ${s.name} (id: ${s.id})`).join('\n')

    const prompt = `You are helping a teacher grade student test papers.

Topic: ${topic}
Total marks: ${totalMarks}

The image shows a mark sheet or student answer paper. Extract the score for each student listed below.
Also add a short observation/feedback if anything is visible (e.g. "left Q3 blank", "calculation errors", "good work", "skipped last question"). Keep feedback under 10 words. If nothing notable, leave feedback as an empty string.

Students:
${studentList}

Return ONLY valid JSON:
{
  "entries": [
    { "studentId": "...", "score": 0, "feedback": "" }
  ]
}

Rules:
- score must be a number between 0 and ${totalMarks}
- Only include students whose score you can clearly read
- studentId must exactly match one of the ids above
- feedback is optional — empty string if nothing notable visible`

    const raw = await callAI([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageBase64 } },
        { type: 'text',      text: prompt },
      ],
    }], { temperature: 0.2 })

    const parsed = JSON.parse(raw)

    // Validate scores are within range
    const entries = (parsed.entries ?? [])
      .filter(
        (e: { studentId: string; score: number; feedback?: string }) =>
          typeof e.score === 'number' &&
          e.score >= 0 &&
          e.score <= totalMarks &&
          students.some(s => s.id === e.studentId)
      )
      .map((e: { studentId: string; score: number; feedback?: string }) => ({
        studentId: e.studentId,
        score: e.score,
        feedback: typeof e.feedback === 'string' ? e.feedback.trim() : '',
      }))

    return NextResponse.json({ entries })
  } catch (err) {
    const msg = String(err)
    if (msg.startsWith('[ai]')) {
      return NextResponse.json({ error: 'AI service temporarily unavailable. Please retry shortly.' }, { status: 503 })
    }
    console.error('[grade-image]', err)
    return NextResponse.json({ entries: [] })
  }
}
