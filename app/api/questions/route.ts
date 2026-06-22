import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouter } from '@/lib/openrouter'
import { withCache, ck } from '@/lib/server-cache'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { apiLog } from '@/lib/logger'
import { QuestionsSchema, parseBody } from '@/lib/schemas'

type QuestionType = 'mcq' | 'fill-in-blank' | 'short-answer' | 'long-answer'

interface Section {
  marks: number
  count: number
  difficulty: 'easy' | 'medium' | 'hard'
  type: QuestionType
  label: string
}

// Confirmed paper templates
const PATTERNS: Record<number, Section[]> = {
  10: [
    { marks: 1, count: 2,  difficulty: 'easy',   type: 'mcq',           label: 'Multiple Choice' },
    { marks: 2, count: 1,  difficulty: 'easy',   type: 'fill-in-blank', label: 'Fill in the Blank' },
    { marks: 2, count: 1,  difficulty: 'medium', type: 'short-answer',  label: 'Short Answer' },
    { marks: 4, count: 1,  difficulty: 'hard',   type: 'long-answer',   label: 'Long Answer' },
  ],
  20: [
    { marks: 1, count: 4,  difficulty: 'easy',   type: 'mcq',           label: 'Multiple Choice' },
    { marks: 2, count: 3,  difficulty: 'easy',   type: 'fill-in-blank', label: 'Fill in the Blank' },
    { marks: 2, count: 2,  difficulty: 'medium', type: 'short-answer',  label: 'Short Answer' },
    { marks: 6, count: 1,  difficulty: 'hard',   type: 'long-answer',   label: 'Long Answer' },
  ],
  25: [
    { marks: 1, count: 5,  difficulty: 'easy',   type: 'mcq',           label: 'Multiple Choice' },
    { marks: 2, count: 3,  difficulty: 'easy',   type: 'fill-in-blank', label: 'Fill in the Blank' },
    { marks: 3, count: 2,  difficulty: 'medium', type: 'short-answer',  label: 'Short Answer' },
    { marks: 8, count: 1,  difficulty: 'hard',   type: 'long-answer',   label: 'Long Answer' },
  ],
  50: [
    { marks: 1,  count: 10, difficulty: 'easy',   type: 'mcq',           label: 'Multiple Choice' },
    { marks: 2,  count: 4,  difficulty: 'easy',   type: 'fill-in-blank', label: 'Fill in the Blank' },
    { marks: 3,  count: 4,  difficulty: 'medium', type: 'short-answer',  label: 'Short Answer' },
    { marks: 10, count: 2,  difficulty: 'hard',   type: 'long-answer',   label: 'Long Answer' },
  ],
  100: [
    { marks: 1,  count: 20, difficulty: 'easy',   type: 'mcq',           label: 'Multiple Choice' },
    { marks: 2,  count: 8,  difficulty: 'easy',   type: 'fill-in-blank', label: 'Fill in the Blank' },
    { marks: 4,  count: 6,  difficulty: 'medium', type: 'short-answer',  label: 'Short Answer' },
    { marks: 10, count: 4,  difficulty: 'hard',   type: 'long-answer',   label: 'Long Answer' },
  ],
}

function getPattern(totalMarks: number): Section[] {
  const supported = [10, 20, 25, 50, 100]
  const closest = supported.reduce((a, b) =>
    Math.abs(b - totalMarks) < Math.abs(a - totalMarks) ? b : a
  )
  return PATTERNS[closest]
}

interface RawQuestion {
  text: string
  type: string
  difficulty: string
  marks: number
  options?: string[] | null
  answer?: string
  keywords?: string[]
}

// LLMs often embed MCQ options inside the question text instead of the options array.
// This extracts them and moves them to options[], cleaning the question text.
function normaliseMcq(q: RawQuestion): RawQuestion {
  if (q.type !== 'mcq') return q
  if (q.options && q.options.length >= 2) return q

  // Match patterns like: (a) text   (A) text   a) text   A. text
  const rx = /\(?\b([a-dA-D])[.)]\)?\s+([^(a-dA-D\n]{2,}?)(?=\s*\(?\b[a-dA-D][.)]\)?|$)/g
  const hits = [...q.text.matchAll(rx)]
  if (hits.length < 2) return q

  const options = hits.map(m => `${m[1].toUpperCase()}. ${m[2].trim()}`)
  const firstIdx = q.text.search(/\(?\b[a-dA-D][.)]\)?/)
  const cleanText = (firstIdx > 0 ? q.text.slice(0, firstIdx) : q.text).replace(/[:\s]+$/, '')
  return { ...q, text: cleanText, options }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) {
    apiLog({ route: 'questions', ip, fromCache: false, durationMs: 0, status: 'rate_limited' })
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  const t = Date.now()
  try {
    let rawBody: unknown
    try { rawBody = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const parsed_ = parseBody(QuestionsSchema, rawBody)
    if (!parsed_.ok) return parsed_.response
    const { subject, topic, grade, totalMarks } = parsed_.data
    const marks   = parseInt(String(totalMarks)) || 10
    const pattern = getPattern(marks)
    const total   = pattern.reduce((s, p) => s + p.marks * p.count, 0)

    const sectionLines = pattern.map((s, i) =>
      `  Section ${String.fromCharCode(65 + i)} — ${s.label}: ${s.count} question${s.count > 1 ? 's' : ''} × ${s.marks} mark${s.marks > 1 ? 's' : ''} each (${s.type}, difficulty: ${s.difficulty})`
    ).join('\n')

    const prompt = `Generate a ${total}-mark exam paper for Grade ${grade} ${subject} on the topic: "${topic}".

Paper structure — follow EXACTLY (correct count and marks per section):
${sectionLines}
Total: ${total} marks

CRITICAL RULES FOR MCQ:
- The "text" field must contain ONLY the question sentence. Do NOT put options inside the text.
- Put all 4 options in the "options" array: ["A. <option>", "B. <option>", "C. <option>", "D. <option>"]
- Set "answer" to the correct letter only: "A", "B", "C", or "D"
- WRONG: { "text": "Which is a planet? (a) Sun (b) Moon (c) Earth (d) Star", "options": [] }
- RIGHT: { "text": "Which of these is a planet?", "options": ["A. Sun", "B. Moon", "C. Earth", "D. Star"], "answer": "C" }

Rules for other types:
- fill-in-blank: sentence with ______ for the blank. "answer" = the exact word/phrase.
- short-answer: "answer" = 1-3 sentence model answer. "keywords" = 2-4 key terms for grading.
- long-answer: "answer" = full model answer paragraph.

General rules:
- Simple language for Grade ${grade} students in Indian schools
- Use Indian contexts (farming, cricket, food, festivals, Indian cities, rupees)
- Self-contained questions only — no "refer to diagram" or "as discussed"
- Follow section counts exactly

Return valid JSON only — no markdown, no extra text:
{
  "questions": [
    { "text": "Which of these is a planet?", "type": "mcq", "difficulty": "easy", "marks": 1, "options": ["A. Sun", "B. Moon", "C. Earth", "D. Star"], "answer": "C", "keywords": [] },
    { "text": "The Sun rises in the ______.", "type": "fill-in-blank", "difficulty": "easy", "marks": 2, "options": [], "answer": "east", "keywords": [] },
    { "text": "Why is the Sun important for life on Earth?", "type": "short-answer", "difficulty": "medium", "marks": 2, "options": [], "answer": "The Sun provides light and heat...", "keywords": ["light", "heat", "energy"] },
    { "text": "Describe the water cycle in detail.", "type": "long-answer", "difficulty": "hard", "marks": 4, "options": [], "answer": "The water cycle is...", "keywords": [] }
  ]
}`

    const { value: parsed, fromCache } = await withCache(
      ck('questions', 'v3', topic.toLowerCase().trim(), grade, total),
      2592000,
      async () => {
        const result = await callOpenRouter([{ role: 'user', content: prompt }])
        const data = JSON.parse(result)
        // Normalise MCQ options in case the LLM embedded them in question text
        if (Array.isArray(data.questions)) {
          data.questions = data.questions.map(normaliseMcq)
        }
        return data
      },
    )
    apiLog({ route: 'questions', ip, fromCache, durationMs: Date.now() - t, status: 'ok' })
    return NextResponse.json(parsed)
  } catch (err) {
    apiLog({ route: 'questions', ip, fromCache: false, durationMs: Date.now() - t, status: 'error', error: String(err) })
    return NextResponse.json({ questions: [] }, { status: 500 })
  }
}
