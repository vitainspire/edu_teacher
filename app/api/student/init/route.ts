import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { apiLog, getClientIp } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const t  = Date.now()
  try {
    const studentId = req.cookies.get('edu-student-id')?.value
    if (!studentId) {
      apiLog({ route: 'student/init', ip, durationMs: Date.now() - t, fromCache: false, status: 'unauthorized' })
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: student } = await supabase
      .from('students').select('*').eq('id', studentId).single()
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const { data: cls } = await supabase
      .from('classes').select('*').eq('id', student.class_id).single()
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

    // Find all classes with same grade + section + school
    let classQuery = supabase.from('classes').select('*')
      .eq('grade', cls.grade)
    if (cls.section) classQuery = classQuery.eq('section', cls.section)
    if (cls.school_id) {
      classQuery = classQuery.eq('school_id', cls.school_id)
    } else {
      classQuery = classQuery.eq('school_name', cls.school_name)
    }
    const { data: allClasses } = await classQuery

    const tabs: Array<{ classId: string; studentId: string; subject: string }> = []
    for (const c of allClasses ?? []) {
      const { data: st } = await supabase
        .from('students').select('id')
        .eq('class_id', c.id)
        .eq('roll_number', student.roll_number)
        .eq('is_active', true)
        .single()
      if (!st) continue

      // Try to get teacher's subject label
      const { data: teacher } = await supabase
        .from('teachers').select('subject').eq('id', c.teacher_id).single()
      const label = teacher?.subject || c.name

      tabs.push({ classId: c.id, studentId: st.id, subject: label })
    }

    apiLog({ route: 'student/init', ip, userId: studentId, durationMs: Date.now() - t, fromCache: false, status: 'ok' })
    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        rollNumber: student.roll_number,
        goal: student.goal ?? '',
        interests: student.interests ?? [],
      },
      primaryClass: {
        id: cls.id,
        grade: cls.grade,
        section: cls.section ?? '',
        schoolId: cls.school_id ?? undefined,
        schoolName: cls.school_name ?? '',
      },
      tabs,
    })
  } catch (err) {
    apiLog({ route: 'student/init', ip, durationMs: Date.now() - t, fromCache: false, status: 'error', error: String(err) })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
