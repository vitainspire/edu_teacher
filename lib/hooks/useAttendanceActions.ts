'use client'
import { useCallback } from 'react'
import type { RefObject, Dispatch, SetStateAction } from 'react'
import { db } from '../db'
import { syncRecord } from '../sync'
import { computeTopicCoverage } from '../logic/coverage'
import type { Teacher, Session, Attendance, TopicMastery, SyllabusTopic, TopicCoverageStatus } from '../types'

export function useAttendanceActions(
  teacher: Teacher | null,
  sessionsRef: RefObject<Session[]>,
  attendanceRef: RefObject<Attendance[]>,
  mastersRef: RefObject<TopicMastery[]>,
  syllabusRef: RefObject<SyllabusTopic[]>,
  setSessions: Dispatch<SetStateAction<Session[]>>,
  setAttendance: Dispatch<SetStateAction<Attendance[]>>,
) {
  const recordSession = useCallback(async (
    classId: string, date: string, syllabusTopicId: string, topic: string,
    entries: Array<{ studentId: string; status: 'present' | 'absent' | 'late' }>,
    sessionNote?: string,
  ) => {
    if (!teacher) return
    const existing = sessionsRef.current!.find(
      s => s.classId === classId && s.syllabusTopicId === syllabusTopicId && s.date === date
    )
    let session: Session
    if (existing) {
      session = { ...existing, sessionNote }
      await db.sessions.put(session)
      setSessions(prev => prev.map(s => s.id === session.id ? session : s))
      syncRecord('sessions', session).catch(console.error)
      const oldAtt = attendanceRef.current!.filter(a => a.sessionId === session.id)
      if (oldAtt.length) await db.attendance.bulkDelete(oldAtt.map(a => a.id))
    } else {
      session = {
        id: crypto.randomUUID(), classId, teacherId: teacher.id,
        syllabusTopicId, topic, date, createdAt: new Date().toISOString(),
        sessionNote,
      }
      await db.sessions.add(session)
      setSessions(prev => [...prev, session])
      syncRecord('sessions', session).catch(console.error)
    }
    const newRecords: Attendance[] = entries.map(e => ({
      id: crypto.randomUUID(), sessionId: session.id, studentId: e.studentId,
      classId, syllabusTopicId, date, status: e.status,
    }))
    await db.attendance.bulkAdd(newRecords)
    setAttendance(prev => [...prev.filter(a => a.sessionId !== session.id), ...newRecords])
    newRecords.forEach(a => syncRecord('attendance', a).catch(console.error))
  }, [teacher, sessionsRef, attendanceRef, setSessions, setAttendance])

  const getClassSessions = useCallback((classId: string) =>
    sessionsRef.current!.filter(s => s.classId === classId).sort((a, b) => b.date.localeCompare(a.date)),
  [sessionsRef])

  const getTopicSessions = useCallback((syllabusTopicId: string) =>
    sessionsRef.current!.filter(s => s.syllabusTopicId === syllabusTopicId).sort((a, b) => b.date.localeCompare(a.date)),
  [sessionsRef])

  const getClassAttendance = useCallback((classId: string, date?: string) =>
    attendanceRef.current!.filter(a => a.classId === classId && (!date || a.date === date)),
  [attendanceRef])

  const getStudentTopicCoverage = useCallback((studentId: string, syllabusTopicId: string): TopicCoverageStatus | null => {
    const topic = syllabusRef.current!.find(t => t.id === syllabusTopicId)
    if (!topic) return null
    return computeTopicCoverage(studentId, topic, sessionsRef.current!, attendanceRef.current!, mastersRef.current!)
  }, [syllabusRef, sessionsRef, attendanceRef, mastersRef])

  return { recordSession, getClassSessions, getTopicSessions, getClassAttendance, getStudentTopicCoverage }
}
