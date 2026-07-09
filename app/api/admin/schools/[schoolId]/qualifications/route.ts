import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchAdmin, fetchTeacherQualifications, addTeacherQualification, deleteTeacherQualification } from '@/lib/admin-queries'

async function auth(userId: string, schoolId: string) {
  const ac = createAdminClient()
  const admin = await fetchAdmin(userId, ac)
  if (!admin || admin.schoolId !== schoolId) return null
  return { admin, ac }
}

async function requireUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET — all qualifications for the school (client filters by teacherId as needed)
export async function GET(_req: Request, { params }: { params: { schoolId: string } }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await auth(user.id, params.schoolId)
    if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const qualifications = await fetchTeacherQualifications(params.schoolId, ctx.ac)
    return NextResponse.json({ qualifications })
  } catch (err) {
    console.error('[admin/qualifications GET] failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST { teacherId, subject, grade, section? } — add one qualification
export async function POST(req: Request, { params }: { params: { schoolId: string } }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await auth(user.id, params.schoolId)
    if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { teacherId, subject, grade, section } = await req.json()
    if (!teacherId || !subject?.trim() || !grade?.trim()) {
      return NextResponse.json({ error: 'teacherId, subject and grade are required.' }, { status: 400 })
    }

    await addTeacherQualification(
      {
        id: crypto.randomUUID(),
        schoolId: params.schoolId,
        teacherId,
        subject: subject.trim(),
        grade: grade.trim(),
        section: section?.trim() || undefined,
      },
      ctx.ac
    )
    const qualifications = await fetchTeacherQualifications(params.schoolId, ctx.ac)
    return NextResponse.json({ qualifications })
  } catch (err) {
    console.error('[admin/qualifications POST] failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE { id }
export async function DELETE(req: Request, { params }: { params: { schoolId: string } }) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await auth(user.id, params.schoolId)
    if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })

    await deleteTeacherQualification(id, ctx.ac)
    const qualifications = await fetchTeacherQualifications(params.schoolId, ctx.ac)
    return NextResponse.json({ qualifications })
  } catch (err) {
    console.error('[admin/qualifications DELETE] failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
