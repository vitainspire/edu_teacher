import { supabase } from './supabase'
import type {
  Teacher, Student, Test, Mark, TopicMastery, RecoveryAttempt,
  Class, SyllabusTopic, Attendance, Session, SyllabusSubTopic, TimetableEntry, CatchupMaterial, InterventionNote,
  TeacherClassAssignment, School,
} from './types'

// ─── Schools ──────────────────────────────────────────────────────────────────

function genJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createSchool(name: string, createdBy: string): Promise<School> {
  let code = genJoinCode()
  // retry on collision (astronomically rare with 32^6 = 1B combinations)
  for (let i = 0; i < 5; i++) {
    const { error } = await supabase.from('schools').insert({
      name, join_code: code, created_by: createdBy,
    })
    if (!error) break
    if (error.code !== '23505') throw error  // 23505 = unique_violation
    code = genJoinCode()
  }
  const { data, error } = await supabase.from('schools')
    .select('*').eq('join_code', code).single()
  if (error || !data) throw error ?? new Error('School create failed')
  return { id: data.id, name: data.name, joinCode: data.join_code, createdBy: data.created_by, createdAt: data.created_at }
}

export async function joinSchool(joinCode: string): Promise<School | null> {
  const { data, error } = await supabase.from('schools')
    .select('*').eq('join_code', joinCode.toUpperCase().trim()).single()
  if (error || !data) return null
  return { id: data.id, name: data.name, joinCode: data.join_code, createdBy: data.created_by, createdAt: data.created_at }
}

export async function findSchoolByName(name: string): Promise<School | null> {
  const { data, error } = await supabase.from('schools')
    .select('*').ilike('name', name.trim()).limit(1).single()
  if (error || !data) return null
  return { id: data.id, name: data.name, joinCode: data.join_code, createdBy: data.created_by, createdAt: data.created_at }
}

export async function fetchSchoolById(schoolId: string): Promise<School | null> {
  const { data, error } = await supabase.from('schools')
    .select('*').eq('id', schoolId).single()
  if (error || !data) return null
  return { id: data.id, name: data.name, joinCode: data.join_code, createdBy: data.created_by, createdAt: data.created_at }
}

// ─── Teachers ─────────────────────────────────────────────────────────────────

export async function upsertTeacher(t: Teacher) {
  const { error } = await supabase.from('teachers').upsert({
    id: t.id,
    user_id: t.userId,
    name: t.name,
    school_name: t.schoolName,
    school_id: t.schoolId ?? null,
    subject: t.subject,
    grade: t.grade,
    phone: t.phone,
    language_preference: t.languagePreference,
    academic_year_start: t.academicYearStart ?? null,
    current_term: t.currentTerm ?? null,
    teacher_code: t.teacherCode ?? null,
  })
  if (error) throw error
}

export async function fetchTeacher(userId: string): Promise<Teacher | null> {
  const { data, error } = await supabase.from('teachers').select('*').eq('id', userId).single()
  if (error || !data) return null
  return {
    id: data.id,
    userId: data.user_id ?? data.id,
    name: data.name ?? '',
    schoolName: data.school_name ?? '',
    schoolId: data.school_id ?? undefined,
    subject: data.subject ?? '',
    grade: data.grade ?? '',
    phone: data.phone ?? '',
    languagePreference: data.language_preference ?? 'english',
    academicYearStart: data.academic_year_start ?? undefined,
    currentTerm: data.current_term ?? undefined,
    teacherCode: data.teacher_code ?? undefined,
  }
}

// ─── Classes ──────────────────────────────────────────────────────────────────

export async function upsertClass(c: Class) {
  const { error } = await supabase.from('classes').upsert({
    id: c.id, teacher_id: c.teacherId, school_name: c.schoolName,
    school_id: c.schoolId ?? null,
    name: c.name, grade: c.grade, section: c.section,
    academic_year: c.academicYear, created_at: c.createdAt,
    class_code: c.classCode ?? null,
  })
  if (error) throw error
}

// Fetches the teacher's own classes. Each teacher owns their classes; there is
// no cross-teacher sharing. (schoolId/schoolName kept for signature compat.)
export async function fetchClasses(teacherId: string, _schoolId?: string, _schoolName?: string): Promise<Class[]> {
  const { data, error } = await supabase
    .from('classes').select('*').order('created_at')
    .eq('teacher_id', teacherId)
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, teacherId: r.teacher_id, schoolName: r.school_name ?? '',
    schoolId: r.school_id ?? undefined,
    name: r.name, grade: r.grade, section: r.section ?? '',
    academicYear: r.academic_year ?? '', createdAt: r.created_at ?? '',
    classCode: r.class_code ?? undefined,
  }))
}

// ─── Syllabus Topics ──────────────────────────────────────────────────────────

export async function upsertSyllabusTopic(t: SyllabusTopic) {
  const { error } = await supabase.from('syllabus_topics').upsert({
    id: t.id, class_id: t.classId, teacher_id: t.teacherId ?? null,
    grade: t.grade ?? null, definition_id: t.definitionId ?? null,
    topic: t.topic, description: t.description,
    week_number: t.weekNumber ?? null, order_index: t.orderIndex,
    is_completed: t.isCompleted, created_at: t.createdAt,
  })
  if (error) throw error
}

// Fetches only the current teacher's syllabus topics (private per teacher).
// Each subject teacher has their own curriculum for a class — science teacher
// has science topics, maths teacher has maths topics, for the same class.
export async function fetchSyllabusTopics(teacherId: string, classIds: string[]): Promise<SyllabusTopic[]> {
  if (!classIds.length) return []
  const { data, error } = await supabase
    .from('syllabus_topics').select('*')
    .eq('teacher_id', teacherId)
    .in('class_id', classIds)
    .order('order_index')
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, classId: r.class_id, teacherId: r.teacher_id ?? undefined,
    grade: r.grade ?? undefined, definitionId: r.definition_id ?? undefined,
    topic: r.topic, description: r.description ?? '',
    weekNumber: r.week_number ?? undefined, orderIndex: r.order_index ?? 0,
    isCompleted: r.is_completed ?? false, createdAt: r.created_at ?? '',
  }))
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function upsertSession(s: Session) {
  const { error } = await supabase.from('sessions').upsert({
    id: s.id, class_id: s.classId, teacher_id: s.teacherId,
    syllabus_topic_id: s.syllabusTopicId || null, topic: s.topic,
    date: s.date, created_at: s.createdAt,
    session_note: s.sessionNote ?? null,
  }, { onConflict: 'id' })
  if (error) throw error
}

export async function fetchSessions(teacherId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions').select('*').eq('teacher_id', teacherId).order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, classId: r.class_id, teacherId: r.teacher_id,
    syllabusTopicId: r.syllabus_topic_id, topic: r.topic,
    date: r.date, createdAt: r.created_at ?? '',
    sessionNote: r.session_note ?? undefined,
  }))
}

// ─── Students ─────────────────────────────────────────────────────────────────

export async function upsertStudent(s: Student) {
  const { error } = await supabase.from('students').upsert({
    id: s.id, teacher_id: s.teacherId, class_id: s.classId, name: s.name,
    roll_number: s.rollNumber, is_active: s.isActive, interests: s.interests, goal: s.goal,
  })
  if (error) throw error
}

export async function fetchStudents(teacherId: string): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*').eq('teacher_id', teacherId).order('roll_number')
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, teacherId: r.teacher_id, classId: r.class_id ?? '',
    name: r.name, rollNumber: r.roll_number, isActive: r.is_active,
    interests: r.interests ?? [], goal: r.goal ?? '',
  }))
}

// Fetch students for a set of classes — used in multi-teacher mode so Teacher B
// sees the same roster as Teacher A without needing to re-add all students.
export async function fetchStudentsByClasses(classIds: string[]): Promise<Student[]> {
  if (!classIds.length) return []
  const { data, error } = await supabase
    .from('students').select('*').in('class_id', classIds).order('roll_number')
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, teacherId: r.teacher_id, classId: r.class_id ?? '',
    name: r.name, rollNumber: r.roll_number, isActive: r.is_active,
    interests: r.interests ?? [], goal: r.goal ?? '',
  }))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

export async function upsertTest(t: Test) {
  const { error } = await supabase.from('tests').upsert({
    id: t.id, teacher_id: t.teacherId, class_id: t.classId ?? null,
    subject: t.subject, topic: t.topic, total_marks: t.totalMarks, conducted_on: t.conductedOn,
    term: t.term ?? null,
    questions: t.questions ? JSON.stringify(t.questions) : null,
  })
  if (error) throw error
}

export async function fetchTests(teacherId: string): Promise<Test[]> {
  const { data, error } = await supabase.from('tests').select('*').eq('teacher_id', teacherId).order('conducted_on', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, teacherId: r.teacher_id, classId: r.class_id ?? undefined,
    subject: r.subject, topic: r.topic, totalMarks: r.total_marks, conductedOn: r.conducted_on,
    term: r.term ?? undefined,
    questions: r.questions
      ? (typeof r.questions === 'string' ? JSON.parse(r.questions) : r.questions)
      : undefined,
  }))
}

// ─── Marks ────────────────────────────────────────────────────────────────────

export async function upsertMark(m: Mark) {
  const { error } = await supabase.from('marks').upsert({
    id: m.id, test_id: m.testId, student_id: m.studentId, score: m.score,
    feedback: m.feedback ?? null,
    breakdown: m.breakdown ?? null,
    entered_at: m.enteredAt,
    source: m.source ?? 'manual',
    image_url: m.imageUrl ?? null,
  })
  if (error) throw error
}

export async function fetchMarks(teacherId: string): Promise<Mark[]> {
  const { data: tests, error: testError } = await supabase.from('tests').select('id').eq('teacher_id', teacherId)
  if (testError) throw testError
  if (!tests?.length) return []
  const { data, error } = await supabase.from('marks').select('*').in('test_id', tests.map(t => t.id))
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, testId: r.test_id, studentId: r.student_id, score: r.score,
    feedback: r.feedback ?? undefined,
    breakdown: r.breakdown ?? undefined,
    enteredAt: r.entered_at,
    source: (r.source as Mark['source']) ?? undefined,
    imageUrl: r.image_url ?? undefined,
  }))
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export async function upsertAttendanceRecord(a: Attendance) {
  const { error } = await supabase.from('attendance').upsert({
    id: a.id,
    session_id: a.sessionId || null,
    student_id: a.studentId,
    class_id: a.classId,
    syllabus_topic_id: a.syllabusTopicId || null,
    date: a.date,
    status: a.status,
  })
  if (error) throw error
}

export async function fetchAttendance(classIds: string[]): Promise<Attendance[]> {
  if (!classIds.length) return []
  const { data, error } = await supabase
    .from('attendance').select('*').in('class_id', classIds).order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id,
    sessionId: r.session_id ?? '',
    studentId: r.student_id,
    classId: r.class_id ?? '',
    syllabusTopicId: r.syllabus_topic_id ?? '',
    date: r.date,
    status: r.status,
  }))
}

// ─── Topic Mastery ────────────────────────────────────────────────────────────

export async function upsertTopicMastery(m: TopicMastery) {
  const { error } = await supabase.from('student_topic_mastery').upsert(
    {
      id: m.id, student_id: m.studentId, topic: m.topic, subject: m.subject,
      mastery: m.mastery, attempts: m.attempts, last_updated: m.lastUpdated,
    },
    { onConflict: 'student_id,topic' }
  )
  if (error) throw error
}

// classIds is preferred over teacherId because students are school-shared.
// Teacher B who joins a class doesn't own students (teacher_id !== B), so
// filtering by teacher_id would return zero mastery for Teacher B.
export async function fetchTopicMastery(teacherId: string, classIds?: string[]): Promise<TopicMastery[]> {
  const { data: students, error: studentsError } = classIds?.length
    ? await supabase.from('students').select('id').in('class_id', classIds)
    : await supabase.from('students').select('id').eq('teacher_id', teacherId)
  if (studentsError) throw studentsError
  if (!students?.length) return []
  const { data, error } = await supabase.from('student_topic_mastery').select('*').in('student_id', students.map(s => s.id))
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, studentId: r.student_id, topic: r.topic, subject: r.subject,
    mastery: r.mastery, attempts: r.attempts, lastUpdated: r.last_updated,
  }))
}

// ─── Syllabus Sub-Topics ──────────────────────────────────────────────────────

export async function upsertSubTopic(t: SyllabusSubTopic): Promise<void> {
  try {
    const { error } = await supabase.from('syllabus_sub_topics').upsert({
      id: t.id, topic_id: t.topicId, class_id: t.classId,
      teacher_id: t.teacherId ?? null, definition_id: t.definitionId ?? null,
      name: t.name, description: t.description ?? null, order_index: t.orderIndex,
      is_completed: t.isCompleted, completed_at: t.completedAt ?? null, created_at: t.createdAt,
    })
    if (error) throw error
  } catch { /* table may not exist in Supabase yet — ignore */ }
}

export async function fetchSubTopics(teacherId: string, classIds: string[]): Promise<SyllabusSubTopic[]> {
  try {
    if (!classIds.length) return []
    const { data, error } = await supabase
      .from('syllabus_sub_topics').select('*')
      .eq('teacher_id', teacherId)
      .in('class_id', classIds)
      .order('order_index')
    if (error) return []
    return (data ?? []).map(r => ({
      id: r.id, topicId: r.topic_id, classId: r.class_id,
      teacherId: r.teacher_id ?? undefined, definitionId: r.definition_id ?? undefined,
      name: r.name, description: r.description ?? undefined, orderIndex: r.order_index ?? 0,
      isCompleted: r.is_completed ?? false, completedAt: r.completed_at ?? undefined,
      createdAt: r.created_at ?? '',
    }))
  } catch { return [] }
}

// ─── Recovery Attempts ────────────────────────────────────────────────────────

export async function upsertRecoveryAttempt(r: RecoveryAttempt) {
  const { error } = await supabase.from('recovery_attempts').upsert({
    id: r.id, student_id: r.studentId, topic: r.topic,
    approach_used: r.approachUsed, helped: r.helped, generated_at: r.generatedAt,
  })
  if (error) throw error
}

export async function fetchPreviousApproaches(studentId: string, topic: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('recovery_attempts').select('approach_used').eq('student_id', studentId).eq('topic', topic)
    .order('generated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => r.approach_used).filter(Boolean)
}

// ─── Timetable ────────────────────────────────────────────────────────────────

export async function upsertTimetableEntry(e: TimetableEntry) {
  try {
    const { error } = await supabase.from('timetable').upsert({
      id: e.id, teacher_id: e.teacherId, class_id: e.classId,
      day_of_week: e.dayOfWeek, period_number: e.periodNumber,
      start_time: e.startTime, end_time: e.endTime,
    })
    if (error) throw error
  } catch { /* table may not exist yet */ }
}

export async function fetchTimetableEntries(teacherId: string): Promise<TimetableEntry[]> {
  try {
    const { data, error } = await supabase.from('timetable').select('*').eq('teacher_id', teacherId)
    if (error) return []
    return (data ?? []).map(r => ({
      id: r.id, teacherId: r.teacher_id, classId: r.class_id,
      dayOfWeek: r.day_of_week, periodNumber: r.period_number,
      startTime: r.start_time, endTime: r.end_time,
    }))
  } catch { return [] }
}

export async function deleteTimetableEntry(id: string) {
  try {
    await supabase.from('timetable').delete().eq('id', id)
  } catch { /* ignore */ }
}

// ─── Catchup Materials ────────────────────────────────────────────────────────

export async function upsertCatchupMaterial(m: CatchupMaterial) {
  try {
    const { error } = await supabase.from('catchup_materials').upsert({
      id: m.id, teacher_id: m.teacherId, student_id: m.studentId,
      student_name: m.studentName, topic: m.topic, subject: m.subject,
      grade: m.grade, explanation: m.explanation,
      practice_questions: m.practiceQuestions,
      activity: m.activity, focus_note: m.focusNote,
      status: m.status, created_at: m.createdAt,
    })
    if (error) throw error
  } catch { /* table may not exist yet */ }
}

export async function fetchCatchupMaterials(teacherId: string): Promise<CatchupMaterial[]> {
  try {
    const { data, error } = await supabase
      .from('catchup_materials').select('*').eq('teacher_id', teacherId)
    if (error) return []
    return (data ?? []).map(r => ({
      id: r.id, teacherId: r.teacher_id, studentId: r.student_id,
      studentName: r.student_name, topic: r.topic, subject: r.subject,
      grade: r.grade, explanation: r.explanation,
      practiceQuestions: r.practice_questions ?? [],
      activity: r.activity, focusNote: r.focus_note,
      status: r.status, createdAt: r.created_at,
    }))
  } catch { return [] }
}

export async function updateCatchupStatus(id: string, status: CatchupMaterial['status']) {
  try {
    await supabase.from('catchup_materials').update({ status }).eq('id', id)
  } catch { /* ignore */ }
}

// ─── Interventions ────────────────────────────────────────────────────────────

export async function upsertIntervention(n: InterventionNote) {
  try {
    const { error } = await supabase.from('interventions').upsert({
      id: n.id, student_id: n.studentId, teacher_id: n.teacherId,
      note: n.note, date: n.date, created_at: n.createdAt,
    })
    if (error) throw error
  } catch { /* table may not exist yet */ }
}

export async function fetchInterventions(teacherId: string): Promise<InterventionNote[]> {
  try {
    const { data, error } = await supabase.from('interventions').select('*').eq('teacher_id', teacherId)
    if (error) return []
    return (data ?? []).map(r => ({
      id: r.id, studentId: r.student_id, teacherId: r.teacher_id,
      note: r.note, date: r.date, createdAt: r.created_at,
    }))
  } catch { return [] }
}

export async function deleteIntervention(id: string) {
  try {
    await supabase.from('interventions').delete().eq('id', id)
  } catch { /* ignore */ }
}

// ─── Teacher Class Assignments ────────────────────────────────────────────────

export async function upsertAssignment(a: TeacherClassAssignment) {
  try {
    const { error } = await supabase.from('teacher_class_assignments').upsert({
      id: a.id, teacher_id: a.teacherId, class_id: a.classId, created_at: a.createdAt,
    }, { onConflict: 'teacher_id,class_id' })
    if (error) throw error
  } catch { /* ignore if table not yet created */ }
}

export async function deleteAssignment(teacherId: string, classId: string) {
  try {
    await supabase.from('teacher_class_assignments')
      .delete().eq('teacher_id', teacherId).eq('class_id', classId)
  } catch { /* ignore */ }
}

export async function fetchAssignments(teacherId: string): Promise<TeacherClassAssignment[]> {
  try {
    const { data, error } = await supabase
      .from('teacher_class_assignments').select('*').eq('teacher_id', teacherId)
    if (error) return []
    return (data ?? []).map(r => ({
      id: r.id, teacherId: r.teacher_id, classId: r.class_id, createdAt: r.created_at ?? '',
    }))
  } catch { return [] }
}
