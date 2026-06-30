import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { apiLog, getClientIp } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const t  = Date.now()
  try {
    const { classCode, rollNumber } = await req.json()
    if (!classCode?.trim() || !rollNumber?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: cls } = await supabase
      .from('classes')
      .select('*')
      .ilike('class_code', classCode.trim())
      .single()

    if (!cls) {
      return NextResponse.json(
        { error: 'Class code not found. Ask your teacher for the correct code.' },
        { status: 404 },
      )
    }

    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', cls.id)
      .eq('roll_number', rollNumber.trim())
      .eq('is_active', true)
      .single()

    if (!student) {
      return NextResponse.json(
        { error: 'Roll number not found in this class.' },
        { status: 404 },
      )
    }

    const session = {
      studentId: student.id,
      classId: cls.id,
      studentName: student.name,
      grade: cls.grade,
      section: cls.section ?? '',
      subject: cls.name,
    }

    apiLog({ route: 'student/login', ip, userId: student.id, durationMs: Date.now() - t, fromCache: false, status: 'ok' })
    const res = NextResponse.json({ ok: true, session })
    res.cookies.set('edu-student-id', student.id, {
      path: '/',
      maxAge: 86400 * 30,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  } catch (err) {
    apiLog({ route: 'student/login', ip, durationMs: Date.now() - t, fromCache: false, status: 'error', error: String(err) })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
