import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { gradeMcq, gradeFib, gradeShortAnswer } from '@/lib/graders'
import type { AiQuestion } from '@/lib/types'

interface Breakdown {
  questionIndex: number
  marksAwarded: number
  maxMarks: number
  feedback: string
}

interface ExtractedAnswer { questionIndex: number; text: string }
interface LongAnswerGrade { questionIndex: number; marksAwarded: number; feedback: string }
interface ExtractionResult {
  answers?: ExtractedAnswer[]
  longAnswerGrades?: LongAnswerGrade[]
  generalFeedback?: string
}

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
    const { imageBase64, questions, totalMarks, topic, studentName }: {
      imageBase64: string
      questions: AiQuestion[]
      totalMarks: number
      topic: string
      studentName: string
    } = await req.json()

    if (!imageBase64 || !questions?.length) {
      return NextResponse.json({ error: 'Image and questions are required' }, { status: 400 })
    }

    const longIndices = new Set(
      questions.map((q, i) => (!q.type || q.type === 'long-answer' ? i : -1)).filter(i => i >= 0)
    )

    const qLines = questions.map((q, i) => {
      const type = q.type ?? 'long-answer'
      if (type === 'mcq') {
        const opts = q.options?.join('  ') ?? ''
        return `Q${i + 1} [MCQ, ${q.marks}m]: ${q.text}${opts ? `\n   Options: ${opts}` : ''}\n   → Extract the letter the student wrote.`
      }
      if (type === 'fill-in-blank') {
        return `Q${i + 1} [Fill in blank, ${q.marks}m]: ${q.text}\n   → Extract the exact word or phrase written in the blank.`
      }
      if (type === 'short-answer') {
        return `Q${i + 1} [Short answer, ${q.marks}m]: ${q.text}\n   → Extract the student's full written answer.`
      }
      const modelAns = q.answer ? `\n   Model answer: ${q.answer}` : ''
      return `Q${i + 1} [Long answer, ${q.marks}m — EXTRACT AND GRADE]:${modelAns}\n   Question: ${q.text}\n   → Extract answer AND award marks (0–${q.marks}) with brief feedback.`
    }).join('\n\n')

    const prompt =
      `Grade the handwritten answer paper for student: ${studentName}\n` +
      `Topic: ${topic}  Total marks: ${totalMarks}\n\n` +
      `QUESTIONS:\n${qLines}\n\n` +
      `RULES:\n` +
      `- Extract what the student wrote for every question into "answers".\n` +
      `- Do NOT grade MCQ, fill-in-blank, or short-answer — only extract text.\n` +
      `- For long-answer questions, grade them in "longAnswerGrades".\n` +
      `- Blank/unreadable → set text to "" in answers.\n\n` +
      `Return ONLY valid JSON:\n` +
      `{\n` +
      `  "answers": [{ "questionIndex": 0, "text": "C" }, ...],\n` +
      (longIndices.size > 0
        ? `  "longAnswerGrades": [{ "questionIndex": ${[...longIndices][0]}, "marksAwarded": 3, "feedback": "..." }],\n`
        : `  "longAnswerGrades": [],\n`) +
      `  "generalFeedback": "One sentence summary"\n` +
      `}`

    const raw = await callAI([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageBase64 } },
        { type: 'text', text: prompt },
      ],
    }], { temperature: 0.1 })

    if (!raw) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 })
    }

    let result: ExtractionResult
    try {
      result = JSON.parse(extractJSON(raw)) as ExtractionResult
    } catch {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const answerMap = new Map<number, string>(
      (result.answers ?? []).map(a => [a.questionIndex, a.text ?? ''])
    )
    const longGradeMap = new Map<number, LongAnswerGrade>(
      (result.longAnswerGrades ?? []).map(g => [g.questionIndex, g])
    )

    const breakdown: Breakdown[] = questions.map((q, i) => {
      const scanned = answerMap.get(i) ?? ''
      const type    = q.type ?? 'long-answer'
      const max     = q.marks ?? 0

      let marksAwarded: number
      let feedback: string

      if (type === 'mcq') {
        const g = gradeMcq(scanned, q.answer ?? '', max)
        marksAwarded = g.marksAwarded; feedback = g.feedback
      } else if (type === 'fill-in-blank') {
        const g = gradeFib(scanned, q.answer ?? '', max)
        marksAwarded = g.marksAwarded; feedback = g.feedback
      } else if (type === 'short-answer') {
        const g = gradeShortAnswer(scanned, q.keywords ?? [], max)
        marksAwarded = g.marksAwarded; feedback = g.feedback
      } else {
        const llmGrade = longGradeMap.get(i)
        marksAwarded = llmGrade ? Math.max(0, Math.min(llmGrade.marksAwarded ?? 0, max)) : 0
        feedback     = llmGrade?.feedback ?? (scanned ? 'Graded by AI' : 'No answer written')
      }

      return { questionIndex: i, marksAwarded, maxMarks: max, feedback }
    })

    const totalScore = Math.min(
      breakdown.reduce((s, b) => s + b.marksAwarded, 0),
      totalMarks,
    )

    return NextResponse.json({
      totalScore,
      breakdown,
      generalFeedback: result.generalFeedback ?? '',
    })
  } catch (err) {
    console.error('[grade-paper]', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
