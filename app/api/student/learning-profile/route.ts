import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

interface QuizRecord { topic: string; subject: string; score: number; total: number; date: string }

function computeDifficulty(history: QuizRecord[]): 'beginner' | 'standard' | 'advanced' {
  if (history.length < 3) return 'standard'
  const recent = history.slice(-6)
  const avg = recent.reduce((sum, q) => sum + (q.total > 0 ? q.score / q.total : 0), 0) / recent.length
  if (avg < 0.4) return 'beginner'
  if (avg > 0.72) return 'advanced'
  return 'standard'
}

// GET /api/student/learning-profile
export async function GET(req: NextRequest) {
  const studentId = req.cookies.get('edu-student-id')?.value
  if (!studentId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('student_learning_profile')
    .select('difficulty_level, learning_style, avg_quiz_score, plans_completed, quiz_history')
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data) {
    return NextResponse.json({
      difficultyLevel: 'standard', learningStyle: 'balanced',
      avgQuizScore: null, plansCompleted: 0, quizCount: 0,
    })
  }

  return NextResponse.json({
    difficultyLevel: data.difficulty_level,
    learningStyle:   data.learning_style,
    avgQuizScore:    data.avg_quiz_score,
    plansCompleted:  data.plans_completed,
    quizCount:       Array.isArray(data.quiz_history) ? (data.quiz_history as unknown[]).length : 0,
  })
}

// PATCH /api/student/learning-profile — called after quiz completion
export async function PATCH(req: NextRequest) {
  const studentId = req.cookies.get('edu-student-id')?.value
  if (!studentId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const b = body as {
    quizResult?:   { topic: string; subject: string; score: number; total: number }
    learningStyle?: string
    planCompleted?: boolean
  }

  const supabase = createAdminClient()
  const { data: current } = await supabase
    .from('student_learning_profile')
    .select('quiz_history, plans_completed, learning_style')
    .eq('student_id', studentId)
    .maybeSingle()

  const quizHistory: QuizRecord[] = Array.isArray(current?.quiz_history) ? current.quiz_history as QuizRecord[] : []

  if (b.quizResult) {
    quizHistory.push({ ...b.quizResult, date: new Date().toISOString() })
    if (quizHistory.length > 20) quizHistory.splice(0, quizHistory.length - 20)
  }

  const plansCompleted = (current?.plans_completed ?? 0) + (b.planCompleted ? 1 : 0)

  const recent = quizHistory.slice(-6)
  const avgQuizScore = recent.length > 0
    ? Math.round(recent.reduce((s, q) => s + (q.total > 0 ? (q.score / q.total) * 100 : 0), 0) / recent.length * 10) / 10
    : (current ? null : null)

  const difficultyLevel = computeDifficulty(quizHistory)
  const learningStyle   = b.learningStyle ?? current?.learning_style ?? 'balanced'

  const { error } = await supabase
    .from('student_learning_profile')
    .upsert(
      {
        student_id: studentId, difficulty_level: difficultyLevel,
        learning_style: learningStyle, avg_quiz_score: avgQuizScore,
        plans_completed: plansCompleted, quiz_history: quizHistory,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'student_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, difficultyLevel, avgQuizScore })
}
