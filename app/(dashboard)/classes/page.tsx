'use client'
import { useState, useEffect } from 'react'
import {
  Plus, Users, GraduationCap, ChevronRight, Clock,
  BookOpen, Activity, School, PlayCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import CreateClassModal from '@/components/classes/CreateClassModal'
import ClassSelectionScreen from '@/components/classes/ClassSelectionScreen'
import clsx from 'clsx'

const CLASS_PALETTE = [
  { gradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)', bar: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', shadow: 'rgba(37,99,235,0.3)' },
]

function formatRelativeDate(dateStr: string): string {
  const d     = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return `${diff}d ago`
  if (diff < 30) return `${Math.round(diff / 7)}w ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function ClassesPage() {
  const router = useRouter()
  const { teacher, classes, students, assignments, getClassSyllabus, getClassSessions } = useApp()
  const [createOpen, setCreateOpen] = useState(false)
  const [hasAdmin, setHasAdmin] = useState(false)

  useEffect(() => {
    if (!teacher?.schoolId) return
    fetch(`/api/school/has-admin?schoolId=${teacher.schoolId}`)
      .then(r => r.json())
      .then(d => setHasAdmin(!!d.hasAdmin))
      .catch(() => {})
  }, [teacher?.schoolId])

  // "My classes" = classes this teacher created OR has an explicit assignment for
  // "School classes" = school classes with no assignment yet (shown in selection screen)
  const assignedIds   = new Set([
    ...(assignments ?? []).map(a => a.classId),
    ...(classes ?? []).filter(c => c.teacherId === teacher?.id).map(c => c.id),
  ])
  const myClasses     = classes.filter(cls => assignedIds.has(cls.id))
  const schoolClasses = classes.filter(cls => !assignedIds.has(cls.id))

  // Show class selection screen when teacher has no assignments and school has available classes
  const showSelectionScreen =
    assignments.length === 0 &&
    !classes.some(c => c.teacherId === teacher?.id) &&
    schoolClasses.length > 0

  const totalStudents = students.filter(s => s.isActive && assignedIds.has(s.classId)).length

  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>

      {/* Header */}
      <div className="gradient-header px-4 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)' }} />
          <div className="absolute right-10 top-16 w-24 h-24 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10 flex items-end justify-between">
          <div>
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">My Classes</p>
            <h1 className="text-2xl font-black text-white leading-none">
              {myClasses.length > 0 ? `${myClasses.length} Class${myClasses.length !== 1 ? 'es' : ''}` : 'Classes'}
            </h1>
            {totalStudents > 0 && (
              <p className="text-blue-200/60 text-sm font-medium mt-1">{totalStudents} active students</p>
            )}
          </div>
          {!hasAdmin && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 font-black px-4 py-2.5 rounded-2xl text-sm active:scale-95 transition-transform"
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              }}
            >
              <Plus size={15} strokeWidth={2.5} /> New Class
            </button>
          )}
        </div>
      </div>

      <div className="-mt-10 px-4 pb-28 space-y-3 relative z-10">

        {myClasses.length === 0 && schoolClasses.length === 0 ? (
          /* ── No classes anywhere in the school ─────────────────────────── */
          <div
            className="bg-white rounded-3xl px-6 py-14 text-center mt-2"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)' }}>
              <GraduationCap size={34} className="text-indigo-500" />
            </div>
            {hasAdmin ? (
              <>
                <h3 className="font-black text-slate-800 text-xl">No classes assigned yet</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                  Your school admin will assign classes to you. Once assigned, they will appear here automatically.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-black text-slate-800 text-xl">No classes yet</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                  Create your first class to start tracking students, attendance, and progress.
                </p>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 text-white font-black px-8 py-3.5 rounded-2xl text-sm active:scale-95 transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
                  }}
                >
                  <Plus size={16} /> Create Class
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── My Classes ────────────────────────────────────────────────── */}
            {myClasses.map((cls, idx) => {
              const palette     = CLASS_PALETTE[idx % CLASS_PALETTE.length]
              const count       = students.filter(s => s.classId === cls.id && s.isActive).length
              const syllabus    = getClassSyllabus(cls.id)
              const clsSessions = getClassSessions(cls.id)
              const completed   = syllabus.filter(t => t.isCompleted).length
              const totalTopics = syllabus.length
              const pct         = totalTopics > 0 ? Math.round((completed / totalTopics) * 100) : 0
              const lastSession = clsSessions[0]

              return (
                <div
                  key={cls.id}
                  className="bg-white rounded-3xl overflow-hidden"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <button
                    onClick={() => router.push(`/classes/${cls.id}/students`)}
                    className="w-full flex items-stretch text-left active:bg-slate-50 transition-colors"
                  >
                    <div className="w-1.5 shrink-0" style={{ background: palette.gradient }} />
                    <div className="flex-1 p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="rounded-2xl flex items-center justify-center font-black text-xl text-white shrink-0"
                          style={{
                            width: 52, height: 52,
                            background: palette.gradient,
                            boxShadow: `0 4px 12px ${palette.shadow}`,
                          }}
                        >
                          {cls.grade}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 text-base leading-tight truncate">{cls.name}</p>
                            {cls.section && (
                              <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full shrink-0', palette.light, palette.text)}>
                                {cls.section}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-500 font-semibold">{teacher?.subject ?? 'Subject'}</span>
                            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                              <Users size={10} /> {count} student{count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {totalTopics > 0 ? (
                            <div className="mt-2.5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-400 font-medium">{completed}/{totalTopics} topics done</span>
                                <span className={clsx('text-[11px] font-bold', palette.text)}>{pct}%</span>
                              </div>
                              <div className="progress-track">
                                <div className={clsx('progress-fill', palette.bar)} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">No syllabus added yet</p>
                          )}
                          {lastSession && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <Clock size={10} className="text-slate-300" />
                              <span className="text-[11px] text-slate-400 truncate font-medium">
                                {formatRelativeDate(lastSession.date)} · {lastSession.topic}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
                      </div>
                    </div>
                  </button>

                  {/* Quick actions */}
                  <div className="px-4 pb-3 pt-0 space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/classes/${cls.id}/attendance`)}
                        className={clsx(
                          'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-transform',
                          palette.light, palette.text,
                        )}
                      >
                        <BookOpen size={12} /> Attendance
                      </button>
                      <button
                        onClick={() => router.push(`/classes/${cls.id}/pulse`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 active:scale-95 transition-transform"
                      >
                        <Activity size={12} /> Pulse
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* ── Available at School ────────────────────────────────────────── */}
            {schoolClasses.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <School size={14} className="text-slate-400" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Available at {teacher?.schoolName ?? 'your school'}
                  </p>
                </div>
                <div className="space-y-2">
                  {schoolClasses.map((cls, idx) => {
                    const palette = CLASS_PALETTE[(myClasses.length + idx) % CLASS_PALETTE.length]
                    const count   = students.filter(s => s.classId === cls.id && s.isActive).length

                    return (
                      <div
                        key={cls.id}
                        className="bg-white rounded-2xl overflow-hidden"
                        style={{ boxShadow: 'var(--shadow-card)' }}
                      >
                        <div className="flex items-center gap-3 p-4">
                          {/* Grade badge — slightly muted to distinguish from active */}
                          <div
                            className="rounded-xl flex items-center justify-center font-black text-lg text-white shrink-0"
                            style={{
                              width: 44, height: 44,
                              background: palette.gradient,
                              opacity: 0.7,
                            }}
                          >
                            {cls.grade}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-slate-700 text-sm leading-tight truncate">{cls.name}</p>
                              {cls.section && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                                  {cls.section}
                                </span>
                              )}
                            </div>
                            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium mt-0.5">
                              <Users size={10} /> {count} student{count !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Start Teaching button */}
                          <button
                            onClick={() => router.push(`/classes/${cls.id}/students`)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-white active:scale-95 transition-transform shrink-0"
                            style={{
                              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                              boxShadow: '0 2px 8px rgba(79,70,229,0.35)',
                            }}
                          >
                            <PlayCircle size={13} /> Start Teaching
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add another class — only when no admin manages the school */}
            {!hasAdmin && (
              <button
                onClick={() => setCreateOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm active:scale-[0.98] transition-all hover:border-indigo-200 hover:text-indigo-400"
              >
                <Plus size={16} strokeWidth={2.5} /> Add Another Class
              </button>
            )}
          </>
        )}
      </div>

      <CreateClassModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* First-time selection screen — shown when teacher has no assigned classes yet */}
      {showSelectionScreen && <ClassSelectionScreen schoolClasses={schoolClasses} />}
    </div>
  )
}
