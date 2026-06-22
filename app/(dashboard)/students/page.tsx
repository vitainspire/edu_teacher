'use client'
import { useState, useMemo } from 'react'
import { Search, ChevronRight, AlertTriangle, Users } from 'lucide-react'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import { getMasteryColor, getMasteryLabel } from '@/lib/logic/mastery'
import clsx from 'clsx'

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #059669 0%, #34d399 100%)',
  'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
  'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #e11d48 0%, #fb7185 100%)',
  'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #c084fc 100%)',
  'linear-gradient(135deg, #dc2626 0%, #f87171 100%)',
]

function avatarGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

export default function StudentsPage() {
  const { students, getStudentAvgMastery, getStudentWarnings } = useApp()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students
      .filter(s => s.isActive)
      .filter(s => s.name.toLowerCase().includes(q) || s.rollNumber.includes(q))
  }, [students, search])

  const activeCount = students.filter(s => s.isActive).length
  const criticalCount = useMemo(() =>
    students.filter(s => s.isActive && getStudentWarnings(s.id).some(w => w.level === 'critical')).length,
  [students, getStudentWarnings])

  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>

      {/* Header with gradient */}
      <div className="gradient-header px-4 pt-8 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10">
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">Students</p>
          <h1 className="text-2xl font-black text-white leading-none">{activeCount} Enrolled</h1>
          <p className="text-blue-200/60 text-sm mt-1 font-medium">Manage via individual class pages</p>
          {criticalCount > 0 && (
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-bold text-red-200"
              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertTriangle size={11} /> {criticalCount} critical alert{criticalCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="-mt-8 px-4 space-y-3 pb-28 relative z-10">
        {/* Search bar */}
        <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ boxShadow: 'var(--shadow-card)' }}>
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or roll number…"
            className="flex-1 text-sm font-medium text-slate-800 placeholder:text-slate-400 bg-transparent border-0 outline-none"
          />
        </div>

        {/* Empty */}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)' }}>
              <Users size={28} className="text-indigo-400" />
            </div>
            <p className="font-bold text-slate-700 text-lg">
              {search ? 'No students found' : 'No students yet'}
            </p>
            {search && <p className="text-sm text-slate-400 mt-1">Try a different search term</p>}
          </div>
        )}

        {/* Student cards */}
        {filtered.map(student => {
          const avgMastery = getStudentAvgMastery(student.id)
          const warnings   = getStudentWarnings(student.id)
          const hasCritical = warnings.some(w => w.level === 'critical')
          const hasWatch    = !hasCritical && warnings.some(w => w.level === 'watch')

          return (
            <Link
              key={student.id}
              href={`/students/${student.id}`}
              className="flex items-center gap-3.5 bg-white rounded-2xl p-4 active:scale-[0.98] transition-all block"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base"
                  style={{
                    background: hasCritical
                      ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
                      : avatarGradient(student.name),
                    boxShadow: hasCritical
                      ? '0 4px 12px rgba(220,38,38,0.35)'
                      : '0 3px 10px rgba(79,70,229,0.25)',
                  }}
                >
                  {student.name[0].toUpperCase()}
                </div>
                {hasCritical && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <AlertTriangle size={9} className="text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 truncate">{student.name}</p>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Roll #{student.rollNumber}</p>

                {/* Mastery bar */}
                {avgMastery > 0 && (
                  <div className="mt-2">
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.round(avgMastery * 100)}%`,
                          background: avgMastery >= 0.75
                            ? 'linear-gradient(90deg, #059669, #34d399)'
                            : avgMastery >= 0.5
                            ? 'linear-gradient(90deg, #d97706, #fbbf24)'
                            : 'linear-gradient(90deg, #dc2626, #f87171)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right side */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {avgMastery > 0 ? (
                  <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full', getMasteryColor(avgMastery))}>
                    {getMasteryLabel(avgMastery)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300 font-semibold">No data</span>
                )}
                {warnings.length > 0 && (
                  <span className={clsx(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    hasCritical ? 'bg-red-50 text-red-600' :
                    hasWatch    ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                  )}>
                    {warnings.length} alert{warnings.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <ChevronRight size={16} className="text-slate-200 shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
