import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getClientIp } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

// Scanner portal — save a worksheet mark using service role key (no Supabase session needed).
// Verifies teacher ownership of the worksheet before saving.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  let body: {
    teacherId: string
    worksheetId: string
    studentId: string
    score: number
    totalMarks: number
    breakdown?: unknown
    feedback?: string
    imageUrl?: string
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { teacherId, worksheetId, studentId, score, totalMarks, breakdown, feedback, imageUrl } = body
  if (!teacherId || !worksheetId || !studentId || score === undefined || !totalMarks) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (score < 0 || score > totalMarks) {
    return NextResponse.json({ error: 'score out of range' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify teacher owns the worksheet
  const { data: ws, error: wsErr } = await admin
    .from('worksheets')
    .select('teacher_id')
    .eq('id', worksheetId)
    .single()
  if (wsErr || !ws) return NextResponse.json({ error: 'Worksheet not found' }, { status: 404 })
  if ((ws as { teacher_id: string }).teacher_id !== teacherId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('worksheet_marks').upsert(
    {
      id: crypto.randomUUID(),
      worksheet_id: worksheetId,
      student_id: studentId,
      score,
      entered_at: new Date().toISOString(),
      source: 'ai_scanned',
      breakdown: breakdown ?? null,
      feedback: feedback ?? null,
      image_url: imageUrl ?? null,
    },
    { onConflict: 'worksheet_id,student_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
