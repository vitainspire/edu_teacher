import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getClientIp } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

// GET /api/worksheet-marks?worksheetId=...
// Returns all marks for a worksheet (teacher-authenticated or scanner via teacherId query param)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const worksheetId = searchParams.get('worksheetId')
  if (!worksheetId) return NextResponse.json({ error: 'Missing worksheetId' }, { status: 400 })

  // Try authenticated teacher first
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data, error } = await supabase
      .from('worksheet_marks')
      .select('*')
      .eq('worksheet_id', worksheetId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ marks: data ?? [] })
  }

  // Scanner fallback — verify ownership via teacherId param
  const teacherId = searchParams.get('teacherId')
  if (!teacherId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: ws } = await admin.from('worksheets').select('teacher_id').eq('id', worksheetId).single()
  if (!ws || (ws as { teacher_id: string }).teacher_id !== teacherId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data, error } = await admin.from('worksheet_marks').select('*').eq('worksheet_id', worksheetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ marks: data ?? [] })
}

// POST /api/worksheet-marks
// Upsert one or many worksheet marks (teacher portal, auth required)
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { worksheetId: string; entries: { studentId: string; score: number; feedback?: string; source?: string }[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { worksheetId, entries } = body
  if (!worksheetId || !Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: 'Missing worksheetId or entries' }, { status: 400 })
  }

  const rows = entries.map(e => ({
    id: crypto.randomUUID(),
    worksheet_id: worksheetId,
    student_id: e.studentId,
    score: e.score,
    feedback: e.feedback ?? null,
    source: e.source ?? 'manual',
    entered_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('worksheet_marks')
    .upsert(rows, { onConflict: 'worksheet_id,student_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
