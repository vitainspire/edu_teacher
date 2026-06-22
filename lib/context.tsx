'use client'
import React, {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode, useRef,
} from 'react'
import { db } from './db'
import { supabase } from './supabase'
import { computeWarnings } from './logic/warnings'
import { buildFingerprint } from './logic/fingerprint'
import { detectHiddenPotential } from './logic/potential'
import { computeBriefingFindings } from './logic/briefing'
import { syncRecord, flushSyncQueue, startSyncListener } from './sync'
import * as sbq from './supabase-queries'
import { useStudentActions }   from './hooks/useStudentActions'
import { useMarksActions }     from './hooks/useMarksActions'
import { useAttendanceActions } from './hooks/useAttendanceActions'
import { useSyllabusActions }  from './hooks/useSyllabusActions'
import { useScheduleActions }  from './hooks/useScheduleActions'
import type {
  Teacher, Student, Test, Mark, TopicMastery, Attendance, Session,
  Class, SyllabusTopic, SyllabusSubTopic, TopicCoverageStatus, ClassBriefingData,
  Warning, Fingerprint, PotentialSignal, BriefingFinding, EnrichedMark, TimetableEntry, CatchupMaterial,
  TeacherClassAssignment,
} from './types'

interface SignUpData {
  name: string
  schoolName: string   // used when creating a new school
  joinCode?: string    // used when joining an existing school by code
  subject: string
  grade: string
  phone: string
  languagePreference: string
}

interface AppContextType {
  teacher: Teacher | null
  classes: Class[]
  students: Student[]
  tests: Test[]
  marks: Mark[]
  mastery: TopicMastery[]
  attendance: Attendance[]
  sessions: Session[]
  syllabusTopics: SyllabusTopic[]
  isLoading: boolean
  syncStatus: 'online' | 'offline' | 'syncing'

  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, data: SignUpData) => Promise<{ error: string | null; requiresEmailConfirmation?: boolean }>
  logout: () => Promise<void>

  // Class assignments (teacher allotment)
  assignments: TeacherClassAssignment[]
  assignClasses: (classIds: string[]) => Promise<void>
  unassignClass: (classId: string) => Promise<void>

  // Classes
  addClass: (data: { name: string; grade: string; section: string }) => Promise<void>
  deleteClass: (id: string) => Promise<void>
  getClassStudents: (classId: string) => Student[]

  // Students
  addStudent: (classId: string, data: { name: string; rollNumber: string; interests: string[]; goal: string }) => Promise<void>
  addStudentsBulk: (classId: string, names: string[]) => Promise<void>
  toggleStudent: (id: string, active: boolean) => Promise<void>

  // Tests & Marks
  createTest: (data: Omit<Test, 'id' | 'teacherId'>) => Promise<string>
  saveMarks: (testId: string, entries: Array<{ studentId: string; score: number; feedback?: string; source?: string }>) => Promise<void>

  // Sessions + Attendance
  recordSession: (
    classId: string, date: string, syllabusTopicId: string, topic: string,
    entries: Array<{ studentId: string; status: 'present' | 'absent' | 'late' }>,
    sessionNote?: string,
  ) => Promise<void>
  getClassSessions: (classId: string) => Session[]
  getTopicSessions: (syllabusTopicId: string) => Session[]
  getClassAttendance: (classId: string, date?: string) => Attendance[]
  getStudentTopicCoverage: (studentId: string, syllabusTopicId: string) => TopicCoverageStatus | null

  // Syllabus topics
  addSyllabusTopic: (classId: string, data: { topic: string; description?: string; weekNumber?: number }) => Promise<string>
  toggleTopicComplete: (topicId: string, isCompleted: boolean) => Promise<void>
  updateSyllabusTopicEstimate: (topicId: string, estimatedSessions: number) => Promise<void>
  deleteSyllabusTopic: (topicId: string) => Promise<void>
  getClassSyllabus: (classId: string) => SyllabusTopic[]
  ensureClassSyllabus: (classId: string) => Promise<number>

  // Syllabus sub-topics
  syllabusSubTopics: SyllabusSubTopic[]
  addSubTopic: (topicId: string, classId: string, data: { name: string; description?: string }) => Promise<void>
  deleteSubTopic: (subTopicId: string) => Promise<void>
  toggleSubTopicComplete: (subTopicId: string, isCompleted: boolean) => Promise<void>
  getTopicSubTopics: (topicId: string) => SyllabusSubTopic[]

  // Timetable
  timetableEntries: TimetableEntry[]
  addTimetableEntry: (entry: Omit<TimetableEntry, 'id' | 'teacherId'>) => Promise<void>
  removeTimetableEntry: (id: string) => Promise<void>
  getTodaySchedule: () => TimetableEntry[]
  getCurrentPeriod: () => TimetableEntry | null

  // Catchup Materials
  catchupMaterials: CatchupMaterial[]
  saveCatchupMaterial: (m: Omit<CatchupMaterial, 'id' | 'teacherId' | 'createdAt'>) => Promise<void>
  updateCatchupStatus: (id: string, status: CatchupMaterial['status']) => Promise<void>
  getCatchupForStudent: (studentId: string) => CatchupMaterial[]

  clearAllData: () => Promise<void>
  forceSync: () => Promise<void>
  updateTeacherSettings: (updates: { academicYearStart?: string; currentTerm?: string }) => Promise<void>

  // Computed
  getStudentMastery: (studentId: string) => TopicMastery[]
  getStudentWarnings: (studentId: string) => Warning[]
  getStudentMarks: (studentId: string) => EnrichedMark[]
  getStudentFingerprint: (studentId: string) => Fingerprint
  getStudentAttendanceRate: (studentId: string) => number
  getStudentAvgMastery: (studentId: string) => number
  getStudentPotential: (studentId: string) => PotentialSignal | null
  getMasteryStats: () => { proficient: number; developing: number; struggling: number }
  getBriefingFindings: () => BriefingFinding[]
  getBriefingData: () => ClassBriefingData[]
  getActiveStudents: () => Student[]
}

const AppContext = createContext<AppContextType | null>(null)

// Short, human-friendly code (no ambiguous chars like 0/O, 1/I).
// Used both for class codes and the per-teacher scanner code.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode(len = 6) {
  return Array.from({ length: len }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher]           = useState<Teacher | null>(null)
  const [classes, setClasses]           = useState<Class[]>([])
  const [students, setStudents]         = useState<Student[]>([])
  const [tests, setTests]               = useState<Test[]>([])
  const [marks, setMarks]               = useState<Mark[]>([])
  const [mastery, setMastery]           = useState<TopicMastery[]>([])
  const [attendance, setAttendance]     = useState<Attendance[]>([])
  const [sessions, setSessions]         = useState<Session[]>([])
  const [syllabusTopics, setSyllabusTopics] = useState<SyllabusTopic[]>([])
  const [syllabusSubTopics, setSyllabusSubTopics] = useState<SyllabusSubTopic[]>([])
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([])
  const [catchupMaterials, setCatchupMaterials] = useState<CatchupMaterial[]>([])
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([])
  const [isLoading, setIsLoading]       = useState(true)
  const [syncStatus, setSyncStatus]     = useState<'online' | 'offline' | 'syncing'>('online')

  const studentsRef    = useRef(students)
  const mastersRef     = useRef(mastery)
  const marksRef       = useRef(marks)
  const testsRef       = useRef(tests)
  const attendanceRef  = useRef(attendance)
  const sessionsRef    = useRef(sessions)
  const syllabusRef    = useRef(syllabusTopics)
  const subTopicsRef   = useRef(syllabusSubTopics)
  const classesRef     = useRef(classes)

  useEffect(() => { classesRef.current    = classes }, [classes])
  useEffect(() => { studentsRef.current   = students }, [students])
  useEffect(() => { mastersRef.current    = mastery }, [mastery])
  useEffect(() => { marksRef.current      = marks }, [marks])
  useEffect(() => { testsRef.current      = tests }, [tests])
  useEffect(() => { attendanceRef.current = attendance }, [attendance])
  useEffect(() => { sessionsRef.current   = sessions }, [sessions])
  useEffect(() => { syllabusRef.current   = syllabusTopics }, [syllabusTopics])
  useEffect(() => { subTopicsRef.current  = syllabusSubTopics }, [syllabusSubTopics])

  // ─── Load all IndexedDB data for a teacher (filtered by teacherId) ────────────

  const loadLocalData = useCallback(async (teacherId: string, _schoolId?: string, _schoolName?: string) => {
    // Each teacher owns their own classes — query by teacherId.
    const allClasses = await db.classes.where('teacherId').equals(teacherId).toArray()

    const classIds   = allClasses.map(c => c.id)

    // Students belong to the teacher's classes
    const [allStudents, allTests, allSessions] = await Promise.all([
      classIds.length ? db.students.where('classId').anyOf(classIds).toArray() : Promise.resolve([]),
      db.tests.where('teacherId').equals(teacherId).toArray(),
      db.sessions.where('teacherId').equals(teacherId).toArray(),
    ])

    const studentIds = allStudents.map(s => s.id)

    // Syllabus is private per teacher — each subject teacher builds their own
    // curriculum for a class. Query by teacherId, not classIds.
    const [allMarks, allMastery, allAttendance, allSyllabus, allSubTopics] = await Promise.all([
      studentIds.length ? db.marks.where('studentId').anyOf(studentIds).toArray()        : Promise.resolve([]),
      studentIds.length ? db.topicMastery.where('studentId').anyOf(studentIds).toArray() : Promise.resolve([]),
      classIds.length   ? db.attendance.where('classId').anyOf(classIds).toArray()       : Promise.resolve([]),
      db.syllabusTopics.where('teacherId').equals(teacherId).toArray(),
      db.syllabusSubTopics.where('teacherId').equals(teacherId).toArray(),
    ])

    // Deduplicate marks: keep only the latest entry per (testId, studentId)
    const sortedMarks = [...allMarks].sort((a, b) => a.enteredAt.localeCompare(b.enteredAt))
    const latestByKey = new Map<string, Mark>()
    for (const m of sortedMarks) latestByKey.set(`${m.testId}|${m.studentId}`, m)
    const dedupedMarks = [...latestByKey.values()]
    if (dedupedMarks.length < allMarks.length) {
      const keepIds = new Set(dedupedMarks.map(m => m.id))
      const toDelete = allMarks.filter(m => !keepIds.has(m.id)).map(m => m.id)
      await db.marks.bulkDelete(toDelete)
    }

    const allTimetable = classIds.length
      ? await db.timetable.where('classId').anyOf(classIds).toArray()
      : []

    const allCatchup = await db.catchupMaterials.where('teacherId').equals(teacherId).toArray()
    const allAssignments = await db.teacherClassAssignments.where('teacherId').equals(teacherId).toArray()

    // Backfill classCode for any existing class that was created before this feature
    const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const backfilled = await Promise.all(allClasses.map(async (c) => {
      if (c.classCode) return c
      const classCode = Array.from({ length: 6 }, () => codeChars[Math.floor(Math.random() * codeChars.length)]).join('')
      const updated = { ...c, classCode }
      await db.classes.put(updated)
      syncRecord('classes', updated).catch(console.error)
      return updated
    }))

    setClasses(backfilled)
    setStudents(allStudents)
    setTests(allTests)
    setMarks(dedupedMarks)
    setMastery(allMastery)
    setAttendance(allAttendance)
    setSyllabusTopics(allSyllabus)
    setSessions(allSessions)
    setSyllabusSubTopics(allSubTopics)
    setTimetableEntries(allTimetable)
    setCatchupMaterials(allCatchup)
    setAssignments(allAssignments)
  }, [])

  // ─── Sync from Supabase → IndexedDB → state ─────────────────────────────────

  const fetchAndMergeFromSupabase = useCallback(async (teacherId: string, schoolId?: string, schoolName?: string) => {
    if (typeof window === 'undefined' || !navigator.onLine) return
    await flushSyncQueue().catch(console.error)
    try {
      // Fetch classes for the whole school first so we have classIds for related data
      const cls = await sbq.fetchClasses(teacherId, schoolId, schoolName)
      const classIds = cls.map(c => c.id)

      const [syl, ses, s, t, m, ma, att, sub, tt, cu, asgn] = await Promise.all([
        sbq.fetchSyllabusTopics(teacherId, classIds),
        sbq.fetchSessions(teacherId),
        sbq.fetchStudentsByClasses(classIds),
        sbq.fetchTests(teacherId),
        sbq.fetchMarks(teacherId),
        sbq.fetchTopicMastery(teacherId, classIds),
        sbq.fetchAttendance(classIds),
        sbq.fetchSubTopics(teacherId, classIds),
        sbq.fetchTimetableEntries(teacherId),
        sbq.fetchCatchupMaterials(teacherId),
        sbq.fetchAssignments(teacherId),
      ])
      await Promise.all([
        cls.length  ? db.classes.bulkPut(cls)                          : Promise.resolve(),
        syl.length  ? db.syllabusTopics.bulkPut(syl)                   : Promise.resolve(),
        ses.length  ? db.sessions.bulkPut(ses)                         : Promise.resolve(),
        s.length    ? db.students.bulkPut(s)                           : Promise.resolve(),
        t.length    ? db.tests.bulkPut(t)                              : Promise.resolve(),
        m.length    ? db.marks.bulkPut(m)                              : Promise.resolve(),
        ma.length   ? db.topicMastery.bulkPut(ma)                      : Promise.resolve(),
        att.length  ? db.attendance.bulkPut(att)                       : Promise.resolve(),
        sub.length  ? db.syllabusSubTopics.bulkPut(sub)                : Promise.resolve(),
        tt.length   ? db.timetable.bulkPut(tt)                         : Promise.resolve(),
        cu.length   ? db.catchupMaterials.bulkPut(cu)                  : Promise.resolve(),
        asgn.length ? db.teacherClassAssignments.bulkPut(asgn)         : Promise.resolve(),
      ])
      await loadLocalData(teacherId, schoolId, schoolName)
    } catch (err) {
      console.error('Supabase fetch failed:', err)
    }
  }, [loadLocalData])

  // ─── Sync + online listeners ─────────────────────────────────────────────────

  useEffect(() => {
    const handleOnline  = () => setSyncStatus('online')
    const handleOffline = () => setSyncStatus('offline')
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (!navigator.onLine) setSyncStatus('offline')
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const cleanup = startSyncListener()
    flushSyncQueue().catch(console.error)
    return cleanup
  }, [])

  // ─── Auth state listener ─────────────────────────────────────────────────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
        document.cookie = `edu-session=1; path=/; SameSite=Strict; max-age=604800${secure}`
      } else {
        document.cookie = 'edu-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict'
      }

      if (event === 'SIGNED_OUT') {
        setTeacher(null)
        setClasses([]); setStudents([]); setTests([]); setMarks([])
        setMastery([]); setAttendance([]); setSessions([]); setSyllabusTopics([])
        setSyllabusSubTopics([])
        localStorage.removeItem('eduteach_teacher')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ─── Init: check session + local storage ─────────────────────────────────────

  useEffect(() => {
    const SYNC_TTL = 2 * 60 * 1000
    const secure   = window.location.protocol === 'https:' ? '; Secure' : ''

    const init = async () => {
      const storedStr = localStorage.getItem('eduteach_teacher')
      if (storedStr) {
        try {
          const parsed: Teacher = JSON.parse(storedStr)
          if (parsed.id && parsed.id !== 'teacher-001') {
            setTeacher(parsed)
            setIsLoading(false)
            document.cookie = `edu-session=1; path=/; SameSite=Strict; max-age=604800${secure}`
            void loadLocalData(parsed.id, parsed.schoolId, parsed.schoolName)
              .then(() => {
                const lastSync = parseInt(localStorage.getItem('eduteach_last_sync') ?? '0')
                if (Date.now() - lastSync > SYNC_TTL) {
                  localStorage.setItem('eduteach_last_sync', String(Date.now()))
                  return fetchAndMergeFromSupabase(parsed.id, parsed.schoolId, parsed.schoolName)
                }
              })
              .catch(console.error)
            return
          }
        } catch { /* bad JSON */ }
        localStorage.removeItem('eduteach_teacher')
      }

      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]) as Awaited<ReturnType<typeof supabase.auth.getSession>>

        const session = sessionResult.data.session
        if (session?.user) {
          const fresh = await sbq.fetchTeacher(session.user.id).catch(() => null)
          if (fresh) {
            if (!fresh.teacherCode) {
              fresh.teacherCode = genCode()
              void sbq.upsertTeacher(fresh).catch(console.error)
            }
            setTeacher(fresh)
            localStorage.setItem('eduteach_teacher', JSON.stringify(fresh))
            localStorage.setItem('eduteach_last_sync', String(Date.now()))
            document.cookie = `edu-session=1; path=/; SameSite=Strict; max-age=604800${secure}`
            setIsLoading(false)
            void loadLocalData(fresh.id, fresh.schoolId, fresh.schoolName)
              .then(() => {
                const lastSync = parseInt(localStorage.getItem('eduteach_last_sync') ?? '0')
                if (Date.now() - lastSync > SYNC_TTL) {
                  localStorage.setItem('eduteach_last_sync', String(Date.now()))
                  return fetchAndMergeFromSupabase(fresh.id, fresh.schoolId, fresh.schoolName)
                }
              })
              .catch(console.error)
            return
          }
        }
        document.cookie = 'edu-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict'
      } catch { /* offline or timeout */ }

      setIsLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Auth actions ─────────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          return { error: 'Please confirm your email first — check your inbox for a verification link from Supabase.' }
        }
        return { error: error.message }
      }
      const userId = data.user?.id
      if (!userId) return { error: 'Sign in failed. Please try again.' }

      let profile = await sbq.fetchTeacher(userId).catch(() => null)

      if (!profile) {
        const stored = localStorage.getItem('eduteach_teacher')
        if (stored) {
          try {
            const local: Teacher = JSON.parse(stored)
            if (local.id === userId) {
              await sbq.upsertTeacher(local).catch(console.error)
              profile = local
            }
          } catch { /* bad JSON */ }
        }
      }

      if (!profile) {
        const meta = data.user.user_metadata ?? {}
        if (meta.name) {
          profile = {
            id: userId, userId,
            name: meta.name ?? '',
            schoolName: meta.school_name ?? '',
            subject: meta.subject ?? '',
            grade: '',
            phone: meta.phone ?? '',
            languagePreference: meta.language_preference ?? 'english',
          }
          await sbq.upsertTeacher(profile).catch(console.error)
        }
      }

      if (!profile) return { error: 'Profile not found. Please register again.' }

      // Ensure a scanner code exists (backfill for accounts created before this feature).
      if (!profile.teacherCode) {
        profile.teacherCode = genCode()
        await sbq.upsertTeacher(profile).catch(console.error)
      }

      await db.teachers.put(profile)
      setTeacher(profile)
      localStorage.setItem('eduteach_teacher', JSON.stringify(profile))
      // Clear private data from any previous teacher session on this device.
      // Classes, students, and attendance are school-shared — do NOT delete them.
      const otherTestIds = await db.tests.where('teacherId').notEqual(userId).primaryKeys()
      await Promise.all([
        db.tests.where('teacherId').notEqual(userId).delete(),
        db.sessions.where('teacherId').notEqual(userId).delete(),
        db.syllabusTopics.where('teacherId').notEqual(userId).delete(),
        db.syllabusSubTopics.where('teacherId').notEqual(userId).delete(),
        db.timetable.where('teacherId').notEqual(userId).delete(),
        db.catchupMaterials.where('teacherId').notEqual(userId).delete(),
        db.teacherClassAssignments.where('teacherId').notEqual(userId).delete(),
        otherTestIds.length ? db.marks.where('testId').anyOf(otherTestIds as string[]).delete() : Promise.resolve(),
      ])
      await loadLocalData(userId, profile.schoolId, profile.schoolName)
      fetchAndMergeFromSupabase(userId, profile.schoolId, profile.schoolName).catch(console.error)
      return { error: null }
    } catch (e) {
      return { error: (e as Error).message ?? 'Sign in failed.' }
    }
  }, [loadLocalData, fetchAndMergeFromSupabase])

  const signUp = useCallback(async (
    email: string,
    password: string,
    profileData: SignUpData,
  ): Promise<{ error: string | null; requiresEmailConfirmation?: boolean }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: {
            name: profileData.name.trim(),
            school_name: profileData.schoolName.trim(),
            subject: profileData.subject,
            phone: profileData.phone.trim(),
            language_preference: profileData.languagePreference,
          },
        },
      })
      if (error) return { error: error.message }
      const userId = data.user?.id
      if (!userId) return { error: 'Registration failed. Please try again.' }

      const profile: Teacher = {
        id: userId, userId,
        name: profileData.name.trim(),
        schoolName: profileData.schoolName.trim(),
        subject: profileData.subject,
        grade: '',
        phone: profileData.phone.trim(),
        languagePreference: profileData.languagePreference,
        teacherCode: genCode(),
      }

      if (data.session) {
        // Session available immediately — persist the profile.
        await sbq.upsertTeacher(profile).catch(console.error)
        setTeacher(profile)
        await loadLocalData(userId)
      }

      await db.teachers.put(profile)
      localStorage.setItem('eduteach_teacher', JSON.stringify(profile))
      return { error: null, requiresEmailConfirmation: !data.session }
    } catch (e) {
      return { error: (e as Error).message ?? 'Registration failed.' }
    }
  }, [loadLocalData])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setTeacher(null)
    setClasses([]); setStudents([]); setTests([]); setMarks([])
    setMastery([]); setAttendance([]); setSessions([]); setSyllabusTopics([])
    setSyllabusSubTopics([])
    localStorage.removeItem('eduteach_teacher')
    const expired = 'path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict'
    document.cookie = `edu-session=; ${expired}`
    document.cookie = `edu-role=; ${expired}`
  }, [])

  // ─── Class actions ────────────────────────────────────────────────────────────

  const addClass = useCallback(async (data: { name: string; grade: string; section: string }) => {
    if (!teacher) return
    const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const classCode = Array.from({ length: 6 }, () => codeChars[Math.floor(Math.random() * codeChars.length)]).join('')
    const newClass: Class = {
      id: crypto.randomUUID(),
      teacherId: teacher.id,
      schoolName: teacher.schoolName,
      schoolId: teacher.schoolId,
      name: data.name.trim(),
      grade: data.grade,
      section: data.section.trim(),
      academicYear: new Date().getFullYear().toString(),
      createdAt: new Date().toISOString(),
      classCode,
    }
    await db.classes.add(newClass)
    setClasses(prev => [...prev, newClass])
    syncRecord('classes', newClass).catch(console.error)
  }, [teacher])

  const deleteClass = useCallback(async (id: string) => {
    await db.classes.delete(id)
    setClasses(prev => prev.filter(c => c.id !== id))
  }, [])

  // Bulk-assign a teacher to a list of class IDs (their school allotment).
  // Skips classes already assigned. Safe to call repeatedly.
  const assignClasses = useCallback(async (classIds: string[]) => {
    if (!teacher) return
    const existing = new Set(assignments.map(a => a.classId))
    const fresh: TeacherClassAssignment[] = classIds
      .filter(id => !existing.has(id))
      .map(id => ({ id: crypto.randomUUID(), teacherId: teacher.id, classId: id, createdAt: new Date().toISOString() }))
    if (!fresh.length) return
    await db.teacherClassAssignments.bulkPut(fresh)
    setAssignments(prev => [...prev, ...fresh])
    await Promise.all(fresh.map(a => syncRecord('teacherClassAssignments', a)))
  }, [teacher, assignments])

  const unassignClass = useCallback(async (classId: string) => {
    if (!teacher) return
    await db.teacherClassAssignments
      .where('teacherId').equals(teacher.id)
      .and(a => a.classId === classId)
      .delete()
    setAssignments(prev => prev.filter(a => a.classId !== classId))
    sbq.deleteAssignment(teacher.id, classId).catch(console.error)
  }, [teacher])

  const getClassStudents = useCallback((classId: string) =>
    studentsRef.current.filter(s => s.classId === classId && s.isActive), [])

  // ─── Domain hooks ─────────────────────────────────────────────────────────────

  const studentActions   = useStudentActions(teacher, studentsRef, setStudents)
  const marksActions     = useMarksActions(teacher, testsRef, marksRef, mastersRef, setTests, setMarks, setMastery)
  const attendanceActions = useAttendanceActions(teacher, sessionsRef, attendanceRef, mastersRef, syllabusRef, setSessions, setAttendance)
  const syllabusActions  = useSyllabusActions(teacher, syllabusRef, subTopicsRef, classesRef, setSyllabusTopics, setSyllabusSubTopics)
  const scheduleActions  = useScheduleActions(teacher, timetableEntries, catchupMaterials, setTimetableEntries, setCatchupMaterials)

  // ─── Admin actions ────────────────────────────────────────────────────────────

  const clearAllData = useCallback(async () => {
    if (!teacher) return
    const tid = teacher.id

    // Scope to owned classes (teacher_id === tid). In multi-teacher mode,
    // Teacher B may have zero owned classes — only their assignments.
    const [ownedClassIds, testIds] = await Promise.all([
      db.classes.where('teacherId').equals(tid).primaryKeys() as Promise<string[]>,
      db.tests.where('teacherId').equals(tid).primaryKeys() as Promise<string[]>,
    ])
    // Students in owned classes (school-shared roster, but teacher created these)
    const ownedStudentIds: string[] = ownedClassIds.length
      ? (await db.students.where('classId').anyOf(ownedClassIds).primaryKeys()) as string[]
      : []

    // ── IndexedDB ──────────────────────────────────────────────────────────
    await Promise.all([
      // Owned classes and their shared roster
      db.classes.where('teacherId').equals(tid).delete(),
      ownedClassIds.length ? db.students.where('classId').anyOf(ownedClassIds).delete() : Promise.resolve(),
      // Strictly private-per-teacher data (indexed by teacherId in v11/v12)
      db.tests.where('teacherId').equals(tid).delete(),
      db.sessions.where('teacherId').equals(tid).delete(),
      db.syllabusTopics.where('teacherId').equals(tid).delete(),
      db.syllabusSubTopics.where('teacherId').equals(tid).delete(),
      db.timetable.where('teacherId').equals(tid).delete(),
      db.catchupMaterials.where('teacherId').equals(tid).delete(),
      db.teacherClassAssignments.where('teacherId').equals(tid).delete(),
      // Dependents scoped to owned resources
      ownedClassIds.length ? db.attendance.where('classId').anyOf(ownedClassIds).delete() : Promise.resolve(),
      testIds.length       ? db.marks.where('testId').anyOf(testIds).delete()             : Promise.resolve(),
      ownedStudentIds.length ? db.topicMastery.where('studentId').anyOf(ownedStudentIds).delete() : Promise.resolve(),
      db.syncQueue.clear(),
    ])

    // ── Supabase (scoped — NEVER use .neq('id','') which deletes all rows) ─
    try {
      await Promise.all([
        supabase.from('classes').delete().eq('teacher_id', tid),
        ownedClassIds.length ? supabase.from('students').delete().in('class_id', ownedClassIds) : Promise.resolve(),
        supabase.from('tests').delete().eq('teacher_id', tid),
        supabase.from('sessions').delete().eq('teacher_id', tid),
        supabase.from('syllabus_topics').delete().eq('teacher_id', tid),
        supabase.from('syllabus_sub_topics').delete().eq('teacher_id', tid),
        supabase.from('timetable').delete().eq('teacher_id', tid),
        supabase.from('catchup_materials').delete().eq('teacher_id', tid),
        supabase.from('teacher_class_assignments').delete().eq('teacher_id', tid),
        testIds.length         ? supabase.from('marks').delete().in('test_id', testIds)                            : Promise.resolve(),
        ownedClassIds.length   ? supabase.from('attendance').delete().in('class_id', ownedClassIds)                : Promise.resolve(),
        ownedStudentIds.length ? supabase.from('student_topic_mastery').delete().in('student_id', ownedStudentIds) : Promise.resolve(),
      ])
    } catch { /* offline — local clear is enough */ }

    setClasses([]); setStudents([]); setTests([]); setMarks([])
    setAttendance([]); setSessions([]); setSyllabusTopics([]); setSyllabusSubTopics([])
    setMastery([]); setTimetableEntries([]); setCatchupMaterials([]); setAssignments([])
    try { localStorage.removeItem('eduteach_briefing_v7') } catch { /* ignore */ }
  }, [teacher])

  const updateTeacherSettings = useCallback(async (updates: { academicYearStart?: string; currentTerm?: string }) => {
    if (!teacher) return
    const updated = { ...teacher, ...updates }
    await db.teachers.put(updated)
    setTeacher(updated)
    try { await sbq.upsertTeacher(updated) } catch { /* offline */ }
  }, [teacher])

  // ─── Computed selectors ───────────────────────────────────────────────────────

  const getStudentMastery = useCallback((studentId: string) =>
    mastery.filter(m => m.studentId === studentId), [mastery])

  const getStudentMarks = useCallback((studentId: string): EnrichedMark[] =>
    marks.filter(m => m.studentId === studentId).map(m => {
      const t = tests.find(t => t.id === m.testId)
      return { ...m, totalMarks: t?.totalMarks ?? 10, topic: t?.topic ?? '', conductedOn: t?.conductedOn ?? '', term: t?.term }
    }), [marks, tests])

  const getStudentAttendanceRate = useCallback((studentId: string) => {
    const all = attendanceRef.current.filter(a => a.studentId === studentId)
    if (!all.length) return 1
    const bySession = new Map<string, typeof all[0]>()
    all.forEach(a => bySession.set(a.sessionId || a.id, a))
    const unique = [...bySession.values()]
    return unique.filter(a => a.status !== 'absent').length / unique.length
  }, [])

  const getStudentAvgMastery = useCallback((studentId: string) => {
    const sm = mastery.filter(m => m.studentId === studentId)
    return sm.length ? sm.reduce((a, b) => a + b.mastery, 0) / sm.length : 0
  }, [mastery])

  const getStudentWarnings = useCallback((studentId: string): Warning[] => {
    const sm = mastery.filter(m => m.studentId === studentId)
    return computeWarnings(studentId, sessionsRef.current, attendanceRef.current, marksRef.current, testsRef.current, sm)
  }, [mastery])

  const getStudentFingerprint = useCallback((studentId: string): Fingerprint => {
    return buildFingerprint(getStudentMarks(studentId), mastery.filter(m => m.studentId === studentId))
  }, [getStudentMarks, mastery])

  const getStudentPotential = useCallback((studentId: string): PotentialSignal | null => {
    const sm = mastery.filter(m => m.studentId === studentId)
    const em = getStudentMarks(studentId)
    const avgM = sm.length ? sm.reduce((a, b) => a + b.mastery, 0) / sm.length : 0
    const scores = em.map(m => m.score / m.totalMarks)
    const rate = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0
    return detectHiddenPotential(sm, avgM, rate, 0.05)
  }, [mastery, getStudentMarks])

  const getMasteryStats = useCallback(() => {
    let proficient = 0, developing = 0, struggling = 0
    students.filter(s => s.isActive).forEach(s => {
      const sm = mastery.filter(m => m.studentId === s.id)
      const avg = sm.length ? sm.reduce((a, b) => a + b.mastery, 0) / sm.length : 0
      if (avg >= 0.75) proficient++
      else if (avg >= 0.5) developing++
      else struggling++
    })
    return { proficient, developing, struggling }
  }, [students, mastery])

  const getBriefingFindings = useCallback((): BriefingFinding[] => {
    const now = new Date()
    const getScore = (m: Mark) => { const t = tests.find(t => t.id === m.testId); return t ? m.score / t.totalMarks : 0 }
    const thisWeek = marks.filter(m => (now.getTime() - new Date(m.enteredAt).getTime()) / 86400000 < 7)
    const lastWeek = marks.filter(m => { const d = (now.getTime() - new Date(m.enteredAt).getTime()) / 86400000; return d >= 7 && d < 14 })
    const activeStudents = students.filter(s => s.isActive)
    return computeBriefingFindings(mastery, activeStudents, thisWeek.map(getScore), lastWeek.map(getScore),
      activeStudents.map(s => ({ student: s, attendanceRate: getStudentAttendanceRate(s.id), masteryTrend: 'stable' as const })))
  }, [students, marks, mastery, tests, getStudentAttendanceRate])

  // Only return students from classes this teacher is actively assigned to
  const getActiveStudents = useCallback(() => {
    const assignedIds = new Set([
      ...(assignments ?? []).map(a => a.classId),
      ...(classes ?? []).filter(c => c.teacherId === teacher?.id).map(c => c.id),
    ])
    return students.filter(s => s.isActive && assignedIds.has(s.classId))
  }, [students, assignments, classes, teacher])

  const getBriefingData = useCallback((): ClassBriefingData[] => {
    // Only brief on classes this teacher is assigned to, not all school classes
    const assignedIds = new Set([
      ...(assignments ?? []).map(a => a.classId),
      ...(classes ?? []).filter(c => c.teacherId === teacher?.id).map(c => c.id),
    ])
    return (classes ?? []).filter(c => assignedIds.has(c.id)).map(cls => {
      const classStudents = students.filter(s => s.classId === cls.id && s.isActive)
      const classSyllabus = syllabusTopics
        .filter(t => t.classId === cls.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
      const classSessions = sessions
        .filter(s => s.classId === cls.id)
        .sort((a, b) => b.date.localeCompare(a.date))

      const nextTopicObj = classSyllabus.find(t => !t.isCompleted) ?? null
      const nextTopic = nextTopicObj?.topic ?? null
      const nextSubTopic = nextTopicObj
        ? (subTopicsRef.current
            .filter(s => s.topicId === nextTopicObj.id && !s.isCompleted)
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))[0]?.name ?? null)
        : null
      const lastSession = classSessions[0] ?? null

      // Last 3 completed subtopics under the last session's topic (by orderIndex)
      const lastTopicObj = lastSession
        ? classSyllabus.find(t => t.topic === lastSession.topic) ?? null
        : null
      const lastSubTopics = lastTopicObj
        ? subTopicsRef.current
            .filter(s => s.topicId === lastTopicObj.id && s.isCompleted)
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            .slice(-3)
            .map(s => s.name)
        : []

      let lastSessionAbsents: string[] = []
      if (lastSession) {
        const absentIds = [...new Set(
          attendance
            .filter(a => a.sessionId === lastSession.id && a.status === 'absent')
            .map(a => a.studentId)
        )]
        lastSessionAbsents = absentIds
          .map(id => students.find(st => st.id === id)?.name ?? '')
          .filter(Boolean)
      }

      const atRiskNames: string[] = []
      classStudents.forEach(student => {
        classSessions.slice(0, 10).forEach(session => {
          const att = attendance.find(a => a.sessionId === session.id && a.studentId === student.id)
          if (att?.status === 'absent') {
            const m = mastery.find(m => m.studentId === student.id && m.topic === session.topic)
            if (m && m.mastery < 0.5 && !atRiskNames.includes(student.name)) {
              atRiskNames.push(student.name)
            }
          }
        })
      })

      return {
        classId: cls.id,
        className: cls.name,
        grade: cls.grade,
        section: cls.section,
        studentCount: classStudents.length,
        nextTopic,
        nextSubTopic,
        lastSubTopics,
        lastSession: lastSession
          ? { topic: lastSession.topic, date: lastSession.date, absentCount: lastSessionAbsents.length, absentNames: lastSessionAbsents.slice(0, 4) }
          : null,
        atRiskCount: atRiskNames.length,
        atRiskNames: atRiskNames.slice(0, 4),
        completedTopics: classSyllabus.filter(t => t.isCompleted).length,
        totalTopics: classSyllabus.length,
      }
    })
  }, [classes, students, syllabusTopics, sessions, attendance, mastery])

  const forceSync = useCallback(async () => {
    if (!teacher) return
    setSyncStatus('syncing')
    localStorage.setItem('eduteach_last_sync', '0')
    await fetchAndMergeFromSupabase(teacher.id, teacher.schoolId, teacher.schoolName).catch(console.error)
    setSyncStatus(navigator.onLine ? 'online' : 'offline')
  }, [teacher, fetchAndMergeFromSupabase])

  return (
    <AppContext.Provider value={{
      teacher, classes, students, tests, marks, mastery, attendance, sessions, syllabusTopics,
      isLoading, syncStatus,
      signIn, signUp, logout,
      assignments, assignClasses, unassignClass,
      addClass, deleteClass, getClassStudents,
      ...studentActions,
      ...marksActions,
      ...attendanceActions,
      ...syllabusActions,
      ...scheduleActions,
      syllabusSubTopics, timetableEntries, catchupMaterials,
      clearAllData, updateTeacherSettings, forceSync,
      getStudentMastery, getStudentWarnings, getStudentMarks,
      getStudentFingerprint, getStudentAttendanceRate,
      getStudentAvgMastery, getStudentPotential,
      getMasteryStats, getBriefingFindings, getBriefingData, getActiveStudents,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
