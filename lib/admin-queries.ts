import type { SupabaseClient } from '@supabase/supabase-js'
import type { Admin, School, Teacher, Class, Student, SchoolTimetablePeriod, TimetableEntry, SchoolSchedule } from './types'

type AC = SupabaseClient

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function fetchAdmin(userId: string, ac: AC): Promise<Admin | null> {
  const { data } = await ac.from('admins').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    email: data.email,
    schoolId: data.school_id,
    createdAt: data.created_at,
  }
}

export async function upsertAdmin(a: Admin, ac: AC): Promise<void> {
  await ac.from('admins').upsert({
    id: a.id,
    user_id: a.userId,
    name: a.name,
    email: a.email,
    school_id: a.schoolId,
    created_at: a.createdAt,
  })
}

// ── School ────────────────────────────────────────────────────────────────────

export async function fetchSchool(schoolId: string, ac: AC): Promise<School | null> {
  const { data } = await ac.from('schools').select('*').eq('id', schoolId).maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    name: data.name,
    joinCode: data.join_code ?? '',
    createdBy: data.created_by,
    createdAt: data.created_at,
  }
}

export async function createSchool(school: School, ac: AC): Promise<void> {
  await ac.from('schools').insert({
    id: school.id,
    name: school.name,
    join_code: school.joinCode,
    created_by: school.createdBy,
    created_at: school.createdAt,
  })
}

// ── Teachers ──────────────────────────────────────────────────────────────────

export async function fetchSchoolTeachers(schoolId: string, ac: AC): Promise<Teacher[]> {
  const { data } = await ac.from('teachers').select('*').eq('school_id', schoolId)
  if (!data) return []
  return data.map(r => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    schoolName: r.school_name ?? '',
    schoolId: r.school_id,
    subject: r.subject ?? '',
    grade: r.grade ?? '',
    phone: r.phone ?? '',
    languagePreference: r.language_preference ?? 'English',
    teacherCode: r.teacher_code,
  }))
}

export async function removeTeacherFromSchool(teacherId: string, ac: AC): Promise<void> {
  await ac.from('teachers').update({ school_id: null }).eq('id', teacherId)
}

// ── Classes ───────────────────────────────────────────────────────────────────

export async function fetchSchoolClasses(schoolId: string, ac: AC): Promise<Class[]> {
  const { data } = await ac.from('classes').select('*').eq('school_id', schoolId)
  if (!data) return []
  return data.map(r => ({
    id: r.id,
    teacherId: r.teacher_id,
    schoolName: r.school_name ?? '',
    schoolId: r.school_id,
    name: r.name,
    grade: r.grade ?? '',
    section: r.section ?? '',
    academicYear: r.academic_year ?? '',
    createdAt: r.created_at,
    classCode: r.class_code,
  }))
}

export async function adminCreateClass(cls: Class, ac: AC): Promise<void> {
  const { error } = await ac.from('classes').insert({
    id: cls.id,
    teacher_id: cls.teacherId,
    school_name: cls.schoolName,
    school_id: cls.schoolId,
    name: cls.name,
    grade: cls.grade,
    section: cls.section,
    academic_year: cls.academicYear,
    created_at: cls.createdAt,
    class_code: cls.classCode,
  })
  if (error) throw new Error(error.message)
}

export async function adminDeleteClass(classId: string, ac: AC): Promise<void> {
  await ac.from('classes').delete().eq('id', classId)
}

// ── Students ──────────────────────────────────────────────────────────────────

export async function fetchSchoolStudents(schoolId: string, ac: AC): Promise<Student[]> {
  const { data: classes } = await ac.from('classes').select('id').eq('school_id', schoolId)
  if (!classes || classes.length === 0) return []
  const classIds = classes.map((c: { id: string }) => c.id)
  const { data } = await ac.from('students').select('*').in('class_id', classIds)
  if (!data) return []
  return data.map(r => ({
    id: r.id,
    teacherId: r.teacher_id,
    classId: r.class_id,
    name: r.name,
    rollNumber: r.roll_number,
    isActive: r.is_active ?? true,
    interests: r.interests ?? [],
    goal: r.goal ?? '',
    pin: r.pin,
    studentCode: r.student_code ?? undefined,
  }))
}

export async function fetchClassStudents(classId: string, ac: AC): Promise<Student[]> {
  const { data } = await ac.from('students').select('*').eq('class_id', classId).order('roll_number')
  if (!data) return []
  return data.map(r => ({
    id: r.id,
    teacherId: r.teacher_id,
    classId: r.class_id,
    name: r.name,
    rollNumber: r.roll_number,
    isActive: r.is_active ?? true,
    interests: r.interests ?? [],
    goal: r.goal ?? '',
    pin: r.pin,
    studentCode: r.student_code ?? undefined,
  }))
}

export async function bulkInsertStudents(
  classId: string,
  rows: { id: string; name: string; rollNumber: string; studentCode: string }[],
  ac: AC
): Promise<void> {
  const records = rows.map(r => ({
    id: r.id,
    teacher_id: null,
    class_id: classId,
    name: r.name,
    roll_number: r.rollNumber,
    is_active: true,
    interests: [],
    goal: '',
    student_code: r.studentCode,
  }))
  const { error } = await ac.from('students').upsert(records, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export async function deleteStudent(studentId: string, ac: AC): Promise<void> {
  const { error } = await ac.from('students').delete().eq('id', studentId)
  if (error) throw new Error(error.message)
}

// ── Teacher–class assignments ─────────────────────────────────────────────────

export async function assignTeacherToClass(
  id: string,
  teacherId: string,
  classId: string,
  ac: AC,
  subject?: string,
): Promise<void> {
  await ac.from('teacher_class_assignments').upsert(
    { id, teacher_id: teacherId, class_id: classId, subject: subject ?? null, created_at: new Date().toISOString() },
    { onConflict: 'teacher_id,class_id' }
  )
}

export async function removeTeacherFromClass(teacherId: string, classId: string, ac: AC): Promise<void> {
  await ac.from('teacher_class_assignments')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)
}

export async function fetchClassAssignments(
  classId: string,
  ac: AC
): Promise<{ teacherId: string; classId: string; subject?: string }[]> {
  const { data } = await ac.from('teacher_class_assignments').select('*').eq('class_id', classId)
  if (!data) return []
  return data.map(r => ({ teacherId: r.teacher_id, classId: r.class_id, subject: r.subject ?? undefined }))
}

// ── School schedule template ──────────────────────────────────────────────────

export async function fetchSchoolSchedule(schoolId: string, ac: AC): Promise<SchoolSchedule | null> {
  const { data } = await ac.from('school_schedule').select('*').eq('school_id', schoolId).maybeSingle()
  if (!data) return null
  return { id: data.id, schoolId: data.school_id, slots: data.slots ?? [], createdAt: data.created_at }
}

export async function upsertSchoolSchedule(s: SchoolSchedule, ac: AC): Promise<void> {
  const { error } = await ac.from('school_schedule').upsert({
    id: s.id, school_id: s.schoolId, slots: s.slots,
    created_at: s.createdAt, updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

// ── School timetable ──────────────────────────────────────────────────────────

export async function fetchSchoolTimetable(schoolId: string, ac: AC): Promise<SchoolTimetablePeriod[]> {
  const { data } = await ac.from('school_timetable_periods').select('*').eq('school_id', schoolId)
  if (!data) return []
  return data.map(r => ({
    id: r.id,
    schoolId: r.school_id,
    dayOfWeek: r.day_of_week,
    periodNumber: r.period_number,
    startTime: r.start_time,
    endTime: r.end_time,
    classId: r.class_id,
    teacherId: r.teacher_id,
    label: r.label,
    createdAt: r.created_at,
  }))
}

export async function upsertSchoolTimetablePeriod(p: SchoolTimetablePeriod, ac: AC): Promise<void> {
  await ac.from('school_timetable_periods').upsert({
    id: p.id,
    school_id: p.schoolId,
    day_of_week: p.dayOfWeek,
    period_number: p.periodNumber,
    start_time: p.startTime,
    end_time: p.endTime,
    class_id: p.classId,
    teacher_id: p.teacherId ?? null,
    label: p.label ?? null,
    created_at: p.createdAt,
  })
}

export async function deleteSchoolTimetablePeriod(periodId: string, ac: AC): Promise<void> {
  await ac.from('school_timetable_periods').delete().eq('id', periodId)
}

export async function publishTimetable(schoolId: string, ac: AC): Promise<void> {
  const periods = await fetchSchoolTimetable(schoolId, ac)
  if (periods.length === 0) return

  // Fan periods out into per-teacher timetable rows
  const rows: Omit<TimetableEntry, never>[] = periods
    .filter(p => p.teacherId)
    .map(p => ({
      id: `stp-${p.id}`,
      teacherId: p.teacherId!,
      classId: p.classId,
      dayOfWeek: p.dayOfWeek,
      periodNumber: p.periodNumber,
      startTime: p.startTime,
      endTime: p.endTime,
      label: p.label ?? undefined,
    }))

  if (rows.length === 0) return

  // Delete all existing timetable rows for affected teachers before re-inserting
  // to avoid stale entries accumulating across republishes
  const teacherIds = [...new Set(rows.map(r => r.teacherId))]
  await ac.from('timetable').delete().in('teacher_id', teacherIds)

  await ac.from('timetable').insert(
    rows.map(r => ({
      id: r.id,
      teacher_id: r.teacherId,
      class_id: r.classId,
      day_of_week: r.dayOfWeek,
      period_number: r.periodNumber,
      start_time: r.startTime,
      end_time: r.endTime,
      label: r.label ?? null,
    }))
  )
}
