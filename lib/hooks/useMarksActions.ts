'use client'
import { useCallback } from 'react'
import type { RefObject, Dispatch, SetStateAction } from 'react'
import { db } from '../db'
import { syncRecord } from '../sync'
import { calculateMastery } from '../logic/mastery'
import type { Teacher, Test, Mark, TopicMastery } from '../types'

export function useMarksActions(
  teacher: Teacher | null,
  testsRef: RefObject<Test[]>,
  marksRef: RefObject<Mark[]>,
  mastersRef: RefObject<TopicMastery[]>,
  setTests: Dispatch<SetStateAction<Test[]>>,
  setMarks: Dispatch<SetStateAction<Mark[]>>,
  setMastery: Dispatch<SetStateAction<TopicMastery[]>>,
) {
  const createTest = useCallback(async (data: Omit<Test, 'id' | 'teacherId'>): Promise<string> => {
    if (!teacher) return ''
    const test: Test = { ...data, id: crypto.randomUUID(), teacherId: teacher.id }
    await db.tests.add(test)
    setTests(prev => [...prev, test])
    syncRecord('tests', test).catch(console.error)
    return test.id
  }, [teacher, setTests])

  const saveMarks = useCallback(async (
    testId: string,
    entries: Array<{ studentId: string; score: number; feedback?: string; source?: string }>,
  ) => {
    const test = testsRef.current!.find(t => t.id === testId)
    if (!test) return

    const existingByStudent = new Map(
      marksRef.current!.filter(m => m.testId === testId).map(m => [m.studentId, m])
    )
    const newMarks: Mark[] = entries.map(e => ({
      id: existingByStudent.get(e.studentId)?.id ?? crypto.randomUUID(),
      testId, studentId: e.studentId, score: e.score,
      feedback: e.feedback?.trim() || undefined,
      breakdown: existingByStudent.get(e.studentId)?.breakdown,
      enteredAt: new Date().toISOString(),
      source: (e.source as Mark['source']) ?? undefined,
    }))
    await db.marks.bulkPut(newMarks)
    const updatedStudentIds = new Set(entries.map(e => e.studentId))
    const updatedMarks = [
      ...marksRef.current!.filter(m => !(m.testId === testId && updatedStudentIds.has(m.studentId))),
      ...newMarks,
    ]
    setMarks(updatedMarks)

    const masteryUpdates: TopicMastery[] = []
    for (const entry of entries) {
      const studentTopicMarks = updatedMarks.filter(m => {
        const t = testsRef.current!.find(t => t.id === m.testId)
        return m.studentId === entry.studentId && t?.topic === test.topic
      })
      const scores = studentTopicMarks.map(m => m.score)
      const totals = studentTopicMarks.map(m => testsRef.current!.find(t => t.id === m.testId)?.totalMarks ?? 10)
      const newMastery = calculateMastery(scores, totals)
      const existing = mastersRef.current!.find(m => m.studentId === entry.studentId && m.topic === test.topic)
      if (existing) {
        const updated = { ...existing, mastery: newMastery, attempts: studentTopicMarks.length, lastUpdated: new Date().toISOString() }
        await db.topicMastery.put(updated)
        masteryUpdates.push(updated)
      } else {
        const record: TopicMastery = {
          id: crypto.randomUUID(), studentId: entry.studentId, topic: test.topic, subject: test.subject,
          mastery: newMastery, attempts: studentTopicMarks.length, lastUpdated: new Date().toISOString(),
        }
        await db.topicMastery.add(record)
        masteryUpdates.push(record)
      }
    }
    setMastery(prev => {
      const ids = new Set(masteryUpdates.map(m => `${m.studentId}|${m.topic}`))
      return [...prev.filter(m => !ids.has(`${m.studentId}|${m.topic}`)), ...masteryUpdates]
    })
    newMarks.forEach(m => syncRecord('marks', m).catch(console.error))
    masteryUpdates.forEach(m => syncRecord('topicMastery', m).catch(console.error))
  }, [testsRef, marksRef, mastersRef, setMarks, setMastery])

  return { createTest, saveMarks }
}
