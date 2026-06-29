'use client'
import { useCallback } from 'react'
import type { RefObject, Dispatch, SetStateAction } from 'react'
import * as sbq from '../supabase-queries'
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
    setStudents(prev => [...prev, student])
    sbq.upsertStudent(student).catch(console.error)
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
    setStudents(prev => [...prev, ...newStudents])
    newStudents.forEach(s => sbq.upsertStudent(s).catch(console.error))
  }, [teacher, studentsRef, setStudents])

  const toggleStudent = useCallback(async (id: string, active: boolean) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, isActive: active } : s))
    const existing = studentsRef.current!.find(s => s.id === id)
    if (existing) sbq.upsertStudent({ ...existing, isActive: active }).catch(console.error)
  }, [studentsRef, setStudents])

  const setStudentPin = useCallback(async (id: string, pin: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, pin } : s))
    const existing = studentsRef.current!.find(s => s.id === id)
    if (existing) sbq.upsertStudent({ ...existing, pin }).catch(console.error)
  }, [studentsRef, setStudents])

  return { addStudent, addStudentsBulk, toggleStudent, setStudentPin }
}
