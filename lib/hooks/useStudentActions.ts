'use client'
import { useCallback } from 'react'
import type { RefObject, Dispatch, SetStateAction } from 'react'
import { db } from '../db'
import { syncRecord } from '../sync'
import type { Teacher, Student } from '../types'

export function useStudentActions(
  teacher: Teacher | null,
  studentsRef: RefObject<Student[]>,
  setStudents: Dispatch<SetStateAction<Student[]>>,
) {
  const addStudent = useCallback(async (
    classId: string,
    data: { name: string; rollNumber: string; interests: string[]; goal: string },
  ) => {
    if (!teacher) return
    const classStudents = studentsRef.current!.filter(s => s.classId === classId)
    const student: Student = {
      id: crypto.randomUUID(),
      teacherId: teacher.id,
      classId,
      name: data.name.trim(),
      rollNumber: data.rollNumber || String(classStudents.length + 1).padStart(2, '0'),
      isActive: true,
      interests: data.interests,
      goal: data.goal.trim(),
    }
    await db.students.add(student)
    setStudents(prev => [...prev, student])
    syncRecord('students', student).catch(console.error)
  }, [teacher, studentsRef, setStudents])

  const addStudentsBulk = useCallback(async (classId: string, names: string[]) => {
    if (!teacher) return
    const base = studentsRef.current!.filter(s => s.classId === classId).length
    const newStudents: Student[] = names.map(n => n.trim()).filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
      .map((name, i) => ({
      id: crypto.randomUUID(),
      teacherId: teacher.id,
      classId,
      name,
      rollNumber: String(base + i + 1).padStart(2, '0'),
      isActive: true,
      interests: [],
      goal: '',
    }))
    await db.students.bulkAdd(newStudents)
    setStudents(prev => [...prev, ...newStudents])
    newStudents.forEach(s => syncRecord('students', s).catch(console.error))
  }, [teacher, studentsRef, setStudents])

  const toggleStudent = useCallback(async (id: string, active: boolean) => {
    await db.students.update(id, { isActive: active })
    setStudents(prev => prev.map(s => s.id === id ? { ...s, isActive: active } : s))
    const existing = studentsRef.current!.find(s => s.id === id)
    if (existing) syncRecord('students', { ...existing, isActive: active }).catch(console.error)
  }, [studentsRef, setStudents])

  return { addStudent, addStudentsBulk, toggleStudent }
}
