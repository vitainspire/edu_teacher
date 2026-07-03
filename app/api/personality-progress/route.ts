import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

const VALID_TRAITS = [
  'patience', 'kindness', 'honesty', 'courage', 'perseverance',
  'responsibility', 'respect', 'gratitude', 'empathy', 'fairness',
  'creativity', 'helpfulness',
]

// GET /api/personality-progress — list all traits this student has completed
export async function GET(req: NextRequest) {
  const studentId = req.cookies.get('edu-student-id')?.value
  if (!studentId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('student_trait_progress')
    .select('trait, story_title, completed_at')
    .eq('student_id', studentId)
    .order('completed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ progress: data ?? [] })
}

// POST /api/personality-progress — mark a trait story as read
export async function POST(req: NextRequest) {
  const studentId = req.cookies.get('edu-student-id')?.value
  if (!studentId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { trait, storyTitle } = body as { trait?: string; storyTitle?: string }
  if (!trait || typeof trait !== 'string' || !VALID_TRAITS.includes(trait)) {
    return NextResponse.json({ error: 'Invalid or missing trait' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('student_trait_progress')
    .upsert(
      { student_id: studentId, trait, story_title: storyTitle ?? null, completed_at: new Date().toISOString() },
      { onConflict: 'student_id,trait' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
