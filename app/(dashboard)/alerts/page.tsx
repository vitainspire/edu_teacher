'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, CheckCircle2, AlertTriangle, Info,
  BookOpen, CheckCheck, ChevronDown, ChevronUp,
  UserX, TrendingDown, ArrowRight,
} from 'lucide-react'
import { useApp } from '@/lib/context'
import clsx from 'clsx'
import CatchupModal from '@/components/catchup/CatchupModal'
import ViewPlanModal from '@/components/catchup/ViewPlanModal'
import type { CatchupMaterial, Warning } from '@/lib/types'

const LEVEL_CONFIG = {
  critical: {
    icon: AlertTriangle,
    gradient: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
    rowBg: '#fff5f5',
    rowBorder: '#fecaca',
    icon_color: 'text-red-500',
    badge: 'bg-red-100 text-red-700',
    accentBar: '#ef4444',
  },
  watch: {
    icon: Bell,
    gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    rowBg: '#fffbeb',
    rowBorder: '#fde68a',
    icon_color: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    accentBar: '#f59e0b',
  },
  info: {
    icon: Info,
    gradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
    rowBg: '#eff6ff',
    rowBorder: '#bfdbfe',
    icon_color: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    accentBar: '#60a5fa',
  },
}

interface CatchupTarget {
  studentId: string
  studentName: string
  topic: string
  score?: number
}

interface StudentAlerts {
  student: { id: string; name: string; rollNumber: string }
  absenceWarnings: Warning[]
  lowMarkWarnings: Warning[]
}

interface ClassGroup {
  classId: string
  label: string
  students: StudentAlerts[]
  absenceCount: number
  lowMarkCount: number
  hasCritical: boolean
}

export default function AlertsPage() {
  const router = useRouter()
  const { classes, students, getStudentWarnings, getCatchupForStudent, updateCatchupStatus } = useApp()
  const [catchupTarget, setCatchupTarget] = useState<CatchupTarget | null>(null)
  const [viewPlan, setViewPlan]           = useState<CatchupMaterial | null>(null)
  const [expandedClass, setExpandedClass] = useState<string | null>(null)

  const classGroups = useMemo((): ClassGroup[] => {
    return classes
      .map(cls => {
        const classStudents = students.filter(s => s.classId === cls.id && s.isActive)
        const studentAlerts: StudentAlerts[] = classStudents
          .map(s => {
            const warnings = getStudentWarnings(s.id)
            return {
              student: { id: s.id, name: s.name, rollNumber: s.rollNumber },
              absenceWarnings: warnings.filter(w => w.category === 'absence'),
              lowMarkWarnings: warnings.filter(w => w.category === 'low_marks' || w.category === 'struggling'),
            }
          })
          .filter(sa => sa.absenceWarnings.length > 0 || sa.lowMarkWarnings.length > 0)

        const absenceCount = studentAlerts.filter(sa => sa.absenceWarnings.length > 0).length
        const lowMarkCount = studentAlerts.filter(sa => sa.lowMarkWarnings.length > 0).length
        const hasCritical  = studentAlerts.some(sa =>
          [...sa.absenceWarnings, ...sa.lowMarkWarnings].some(w => w.level === 'critical')
        )
        return {
          classId: cls.id,
          label: `Grade ${cls.grade}${cls.section ? ` · ${cls.section}` : ''}`,
          students: studentAlerts,
          absenceCount,
          lowMarkCount,
          hasCritical,
        }
      })
      .filter(g => g.students.length > 0)
      .sort((a, b) => (b.hasCritical ? 1 : 0) - (a.hasCritical ? 1 : 0))
  }, [classes, students, getStudentWarnings])

  const totalStudents   = classGroups.reduce((n, g) => n + g.students.length, 0)
  const criticalClasses = classGroups.filter(g => g.hasCritical).length

  return (
    <>
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>

      {/* Hero header */}
      <div
        className="px-5 pt-10 pb-20 relative overflow-hidden"
        style={{
          background: criticalClasses > 0
            ? 'linear-gradient(145deg, #881337 0%, #be123c 50%, #e11d48 100%)'
            : classGroups.length > 0
            ? 'linear-gradient(145deg, #92400e 0%, #b45309 50%, #d97706 100%)'
            : 'linear-gradient(145deg, #064e3b 0%, #065f46 50%, #059669 100%)',
        }}
      >
        <div className="absolute -right-8 -top-8 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)' }} />
        <p className={clsx(
          'text-xs font-black uppercase tracking-widest mb-2',
          criticalClasses > 0 ? 'text-red-300' : classGroups.length > 0 ? 'text-amber-300' : 'text-emerald-300'
        )}>
          Early Warnings
        </p>
        <h1 className="text-3xl font-black text-white leading-tight">
          {classGroups.length === 0
            ? 'All Clear!'
            : `${totalStudents} Need${totalStudents === 1 ? 's' : ''} Attention`}
        </h1>
        <p className={clsx(
          'text-sm mt-1.5 font-medium',
          criticalClasses > 0 ? 'text-red-200/80' : classGroups.length > 0 ? 'text-amber-200/80' : 'text-emerald-200/80'
        )}>
          {classGroups.length === 0
            ? 'No alerts right now — great work!'
            : `${classGroups.length} class${classGroups.length !== 1 ? 'es' : ''} affected${criticalClasses > 0 ? ` · ${criticalClasses} critical` : ''}`}
        </p>
      </div>

      <div className="-mt-10 px-4 pb-32 space-y-3 relative z-10">

        {/* ── All clear ── */}
        {classGroups.length === 0 && (
          <div className="bg-white rounded-3xl p-8 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}>
              <CheckCircle2 size={36} className="text-emerald-600" />
            </div>
            <p className="text-xl font-black text-slate-800">All students on track!</p>
            <p className="text-slate-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              No warnings right now. Keep up the great teaching work!
            </p>
          </div>
        )}

        {/* ── Class accordion cards ── */}
        {classGroups.map(group => {
          const isOpen = expandedClass === group.classId
          const accentColor = group.hasCritical ? '#ef4444' : '#f59e0b'

          return (
            <div
              key={group.classId}
              className="bg-white rounded-3xl overflow-hidden"
              style={{
                boxShadow: '0 2px 16px rgba(15,23,42,0.06), 0 1px 4px rgba(15,23,42,0.04)',
                border: `1px solid ${group.hasCritical ? '#fecaca' : '#fde68a'}`,
              }}
            >
              {/* Tap target — full class row */}
              <button
                type="button"
                onClick={() => setExpandedClass(isOpen ? null : group.classId)}
                className="w-full flex items-center gap-3 px-4 text-left active:bg-slate-50 transition-colors"
                style={{ minHeight: 64 }}
              >
                {/* Coloured accent bar */}
                <div className="w-1 self-stretch rounded-full my-3 flex-shrink-0"
                  style={{ background: accentColor }} />

                <div className="flex-1 min-w-0 py-3.5">
                  <p className="font-black text-slate-900 text-base leading-tight">{group.label}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {group.absenceCount > 0 && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        <UserX size={10} /> {group.absenceCount} absent
                      </span>
                    )}
                    {group.lowMarkCount > 0 && (
                      <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                        <TrendingDown size={10} /> {group.lowMarkCount} low marks
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100">
                  {isOpen
                    ? <ChevronUp size={16} className="text-slate-500" />
                    : <ChevronDown size={16} className="text-slate-500" />}
                </div>
              </button>

              {/* Expanded body */}
              {isOpen && (
                <div className="border-t border-slate-100">

                  {/* Absences section */}
                  {group.absenceCount > 0 && (
                    <div className="px-4 pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <UserX size={12} className="text-amber-700" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                          Absences · {group.absenceCount} student{group.absenceCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="space-y-2.5">
                        {group.students
                          .filter(sa => sa.absenceWarnings.length > 0)
                          .map(sa => (
                            <StudentWarningRow
                              key={sa.student.id + '-abs'}
                              sa={sa}
                              warnings={sa.absenceWarnings}
                              router={router}
                              getCatchupForStudent={getCatchupForStudent}
                              updateCatchupStatus={updateCatchupStatus}
                              onCatchup={setCatchupTarget}
                              onViewPlan={setViewPlan}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Divider between sections */}
                  {group.absenceCount > 0 && group.lowMarkCount > 0 && (
                    <div className="mx-4 border-t border-dashed border-slate-200 my-1" />
                  )}

                  {/* Low marks section */}
                  {group.lowMarkCount > 0 && (
                    <div className="px-4 pt-3 pb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                          <TrendingDown size={12} className="text-red-700" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-wider text-red-700">
                          Low Marks · {group.lowMarkCount} student{group.lowMarkCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="space-y-2.5">
                        {group.students
                          .filter(sa => sa.lowMarkWarnings.length > 0)
                          .map(sa => (
                            <StudentWarningRow
                              key={sa.student.id + '-low'}
                              sa={sa}
                              warnings={sa.lowMarkWarnings}
                              router={router}
                              getCatchupForStudent={getCatchupForStudent}
                              updateCatchupStatus={updateCatchupStatus}
                              onCatchup={setCatchupTarget}
                              onViewPlan={setViewPlan}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )
        })}


      </div>
    </div>

    {catchupTarget && (
      <CatchupModal
        studentId={catchupTarget.studentId}
        studentName={catchupTarget.studentName}
        topic={catchupTarget.topic}
        score={catchupTarget.score}
        onClose={() => setCatchupTarget(null)}
      />
    )}
    {viewPlan && (
      <ViewPlanModal plan={viewPlan} onClose={() => setViewPlan(null)} />
    )}
    </>
  )
}

// ── Student warning row ───────────────────────────────────────────────────────
function StudentWarningRow({
  sa, warnings, router, getCatchupForStudent, updateCatchupStatus, onCatchup, onViewPlan,
}: {
  sa: StudentAlerts
  warnings: Warning[]
  router: ReturnType<typeof useRouter>
  getCatchupForStudent: (id: string) => CatchupMaterial[]
  updateCatchupStatus: (id: string, status: CatchupMaterial['status']) => Promise<void>
  onCatchup: (t: CatchupTarget) => void
  onViewPlan: (p: CatchupMaterial) => void
}) {
  const topLevel = warnings.some(w => w.level === 'critical') ? 'critical'
    : warnings.some(w => w.level === 'watch') ? 'watch' : 'info'
  const cfg = LEVEL_CONFIG[topLevel]

  const STATUS_LABEL: Record<string, string>               = { approved: 'Plan ready', given: 'Given to student', done: 'Completed' }
  const STATUS_NEXT:  Record<string, string>               = { approved: 'Mark as Given', given: 'Mark as Done' }
  const STATUS_NEXT_VAL: Record<string, 'given' | 'done'> = { approved: 'given', given: 'done' }

  const hasDonePlan = getCatchupForStudent(sa.student.id).filter(m => warnings.some(w => w.topic === m.topic)).some(m => m.status === 'done')

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${cfg.rowBorder}`, background: cfg.rowBg }}
    >
      {/* Student header — taps to profile */}
      <button
        type="button"
        onClick={() => router.push(`/students/${sa.student.id}`)}
        className="w-full flex items-center gap-3 px-3.5 py-3 active:opacity-70 transition-opacity"
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-base flex-shrink-0"
          style={{ background: cfg.gradient }}
        >
          {(sa.student.name?.[0] ?? "?").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-bold text-slate-900 text-sm leading-tight truncate">{sa.student.name}</p>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Roll #{sa.student.rollNumber}</p>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 flex-shrink-0">
          Profile <ArrowRight size={12} />
        </div>
      </button>

      {/* Warnings */}
      <div className="px-3.5 pb-3 space-y-2.5 border-t border-black/5">
        {warnings.map((w, i) => {
          const wCfg    = LEVEL_CONFIG[w.level]
          const scoreMatch = /(\d+)%/.exec(w.action)
          const score   = scoreMatch ? parseInt(scoreMatch[1]) : undefined
          const existing = w.topic ? getCatchupForStudent(sa.student.id).find(m => m.topic === w.topic) : null

          return (
            <div key={i} className="pt-2.5">
              {/* Reason + date */}
              <div className="flex items-start gap-2 mb-2">
                <wCfg.icon size={13} className={clsx('mt-0.5 flex-shrink-0', wCfg.icon_color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800 leading-snug">{w.reason}</p>
                    {w.date && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70 text-slate-500 border border-slate-200">
                        {formatWarningDate(w.date)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{w.action}</p>
                </div>
              </div>

              {/* Action button — full width, large tap target */}
              {w.topic && (
                existing ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onViewPlan(existing)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center active:opacity-70 transition-opacity"
                      style={{
                        background: existing.status === 'done' ? '#d1fae5' : '#dbeafe',
                        color: existing.status === 'done' ? '#065f46' : '#1d4ed8',
                      }}
                    >
                      {STATUS_LABEL[existing.status]} — View Plan
                    </button>
                    {existing.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => { updateCatchupStatus(existing.id, STATUS_NEXT_VAL[existing.status]).catch(() => {}) }}
                        className="py-2.5 px-3 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 active:bg-slate-50"
                      >
                        {STATUS_NEXT[existing.status]}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCatchup({ studentId: sa.student.id, studentName: sa.student.name, topic: w.topic!, score })}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-blue-700 bg-white border border-blue-200 active:bg-blue-50 transition-colors"
                  >
                    <BookOpen size={13} /> Create Catch-up Plan
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>

      {/* Done badge */}
      {hasDonePlan && (
        <div className="flex items-center gap-1.5 px-3.5 py-2 border-t border-black/5 bg-emerald-50">
          <CheckCheck size={13} className="text-emerald-600" />
          <span className="text-xs font-bold text-emerald-700">Catch-up plan completed</span>
        </div>
      )}
    </div>
  )
}

function formatWarningDate(dateStr: string): string {
  const d     = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
