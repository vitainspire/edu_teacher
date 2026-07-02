import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

type Params = { params: { schoolId: string; classId: string } }
type Row = Record<string, unknown>

function mapTopic(r: Row) {
  return {
    id:          r.id           as string,
    classId:     r.class_id     as string,
    teacherId:   (r.teacher_id  as string) ?? null,
    topic:       r.topic        as string,
    description: (r.description as string) ?? '',
    weekNumber:  (r.week_number as number)  ?? null,
    orderIndex:  (r.order_index as number)  ?? 0,
    isCompleted: (r.is_completed as boolean) ?? false,
    createdAt:   (r.created_at  as string)  ?? '',
  }
}

// ── GET — list all topics for a class ────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { classId } = params
  const ac = createAdminClient()
  const { data, error } = await ac
    .from('syllabus_topics')
    .select('*')
    .eq('class_id', classId)
    .order('order_index')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ topics: (data ?? []).map(mapTopic) })
}

// ── POST — add a new topic ────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const { schoolId, classId } = params
  const body: { topic: string; description?: string; weekNumber?: number } = await req.json()
  if (!body.topic?.trim()) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  const ac = createAdminClient()

  // Determine the next order_index
  const { data: existing } = await ac
    .from('syllabus_topics')
    .select('order_index')
    .eq('class_id', classId)
    .order('order_index', { ascending: false })
    .limit(1)
  const nextIndex = ((existing?.[0] as Row | undefined)?.order_index as number ?? -1) + 1

  // Find the assigned teacher for this class (so teacher can see the topic)
  const { data: asgRow } = await ac
    .from('teacher_class_assignments')
    .select('teacher_id')
    .eq('class_id', classId)
    .limit(1)
    .maybeSingle()

  let teacherId = (asgRow as Row | null)?.teacher_id as string | null ?? null

  // If no explicit assignment, check timetable periods
  if (!teacherId) {
    const { data: stp } = await ac
      .from('school_timetable_periods')
      .select('teacher_id')
      .eq('class_id', classId)
      .limit(1)
      .maybeSingle()
    teacherId = (stp as Row | null)?.teacher_id as string | null ?? null
  }

  // Get the teacher's user_id to fetch their class info (needed for grade)
  const { data: cls } = await ac
    .from('classes')
    .select('grade, school_id')
    .eq('id', classId)
    .maybeSingle()
  const grade = (cls as Row | null)?.grade as string ?? ''
  const rowSchoolId = (cls as Row | null)?.school_id as string ?? schoolId

  const id = crypto.randomUUID()
  const { error } = await ac.from('syllabus_topics').insert({
    id,
    class_id:    classId,
    teacher_id:  teacherId,
    grade:       grade || null,
    school_id:   rowSchoolId || null,
    topic:       body.topic.trim(),
    description: body.description?.trim() ?? '',
    week_number: body.weekNumber ?? null,
    order_index: nextIndex,
    is_completed: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id }, { status: 201 })
}

// ── PATCH — update a topic (topic text, description, completion) ───────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { classId } = params
  const body: { id: string; topic?: string; description?: string; isCompleted?: boolean; weekNumber?: number } =
    await req.json()
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.topic       !== undefined) updates.topic        = body.topic.trim()
  if (body.description !== undefined) updates.description  = body.description.trim()
  if (body.isCompleted !== undefined) updates.is_completed = body.isCompleted
  if (body.weekNumber  !== undefined) updates.week_number  = body.weekNumber

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const ac = createAdminClient()
  const { error } = await ac
    .from('syllabus_topics')
    .update(updates)
    .eq('id', body.id)
    .eq('class_id', classId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ── DELETE — remove a topic ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const { classId } = params
  const body: { id: string } = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const ac = createAdminClient()
  const { error } = await ac
    .from('syllabus_topics')
    .delete()
    .eq('id', body.id)
    .eq('class_id', classId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
