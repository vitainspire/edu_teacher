'use client'
import { useState, useMemo } from 'react'
import { Users, CheckCircle2, Circle, School, BookOpen } from 'lucide-react'
import { useApp } from '@/lib/context'
import type { Class } from '@/lib/types'

const GRADE_COLORS: Record<string, string> = {
  '1': '#7c3aed', '2': '#7c3aed',
  '3': '#2563eb', '4': '#2563eb',
  '5': '#059669', '6': '#059669',
  '7': '#d97706', '8': '#d97706',
  '9': '#e11d48', '10': '#e11d48',
  '11': '#0891b2', '12': '#0891b2',
}
function gradeColor(grade: string) {
  return GRADE_COLORS[grade] ?? '#6366f1'
}

interface Props {
  schoolClasses: Class[]
}

export default function ClassSelectionScreen({ schoolClasses }: Props) {
  const { teacher, students, assignClasses } = useApp()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const toggle = (classId: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(classId) ? next.delete(classId) : next.add(classId)
      return next
    })

  const handleConfirm = async () => {
    if (!selected.size) return
    setSaving(true)
    await assignClasses([...selected])
    setSaving(false)
  }

  const studentCountFor = useMemo(() =>
    (classId: string) => students.filter(s => s.classId === classId && s.isActive).length,
  [students])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}
      >
        {/* Header */}
        <div className="px-6 pt-7 pb-4" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <School size={16} className="text-white" />
            </div>
            <span className="text-indigo-200 text-xs font-bold uppercase tracking-widest">
              {teacher?.schoolName}
            </span>
          </div>
          <h2 className="text-white text-xl font-black leading-tight">Which classes do you teach?</h2>
          <p className="text-indigo-300 text-sm mt-1">
            Select the classes you&apos;re assigned to for <span className="text-white font-bold">{teacher?.subject}</span>
          </p>
        </div>

        {/* Class list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {schoolClasses.map(cls => {
            const isSelected = selected.has(cls.id)
            const count = studentCountFor(cls.id)
            const color = gradeColor(cls.grade)

            return (
              <button
                key={cls.id}
                onClick={() => toggle(cls.id)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all active:scale-[0.98]"
                style={{
                  background: isSelected ? `${color}12` : '#f8fafc',
                  border: `2px solid ${isSelected ? color : 'transparent'}`,
                }}
              >
                {/* Grade badge */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg text-white shrink-0"
                  style={{ background: color, opacity: isSelected ? 1 : 0.55 }}
                >
                  {cls.grade}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-800 text-sm">{cls.name}</span>
                    {cls.section && (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {cls.section}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-slate-400 font-medium mt-0.5">
                    <Users size={10} /> {count} student{count !== 1 ? 's' : ''}
                  </span>
                </div>

                {isSelected
                  ? <CheckCircle2 size={22} style={{ color }} className="shrink-0" />
                  : <Circle size={22} className="text-slate-200 shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 pb-6 pt-3 border-t border-slate-100">
          {selected.size === 0 && (
            <p className="text-center text-xs text-slate-400 font-medium mb-3">
              Tick at least one class to continue
            </p>
          )}
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
          >
            <BookOpen size={15} />
            {saving ? 'Saving…' : `Confirm ${selected.size > 0 ? `(${selected.size} class${selected.size !== 1 ? 'es' : ''})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
