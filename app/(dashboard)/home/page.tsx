'use client'
import { useState, useEffect } from 'react'
import {
  Plus, Users, GraduationCap, Wifi, WifiOff,
  LogOut, CalendarCheck, ChevronRight,
  Sparkles, Trophy, TrendingUp,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import CreateClassModal from '@/components/classes/CreateClassModal'
import DailyBriefing from '@/components/briefing/DailyBriefing'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import TodaySchedule from '@/components/home/TodaySchedule'
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist'
import FeatureTour from '@/components/onboarding/FeatureTour'
import clsx from 'clsx'

const CLASS_COLORS = [
  { border: '#0ea5e9', num: '#0369a1' },
  { border: '#34d399', num: '#059669' },
  { border: '#60a5fa', num: '#2563eb' },
  { border: '#fb7185', num: '#be123c' },
  { border: '#fbbf24', num: '#b45309' },
]

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function HomePage() {
  const { teacher, classes, students, assignments, syncStatus, logout,
          syllabusTopics, timetableEntries,
          getClassSyllabus, getClassSessions } = useApp()

  const assignedIds = new Set([
    ...(assignments ?? []).map(a => a.classId),
    ...(classes ?? []).filter(c => c.teacherId === teacher?.id).map(c => c.id),
  ])
  const myClasses = classes.filter(cls => assignedIds.has(cls.id))
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [greeting, setGreeting]     = useState('Good morning')
  const [dateStr, setDateStr]       = useState('')
  const [showTour, setShowTour]         = useState(false)
  const [showGuideBtn, setShowGuideBtn] = useState(false)
  const [hasAdmin, setHasAdmin]         = useState(false)

  // All 4 setup steps complete
  const allSetupDone =
    classes.length > 0 &&
    students.filter(s => s.isActive).length > 0 &&
    timetableEntries.length > 0 &&
    syllabusTopics.length > 0

  useEffect(() => {
    const now  = new Date()
    const hour = now.getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
    setDateStr(`${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`)
  }, [])

  // Read localStorage preferences once teacher is known
  useEffect(() => {
    if (!teacher) return
    const hiddenKey = `eduteach_show_guide_btn_${teacher.id}`
    setShowGuideBtn(localStorage.getItem(hiddenKey) !== 'false')
  }, [teacher])

  // Check if school has an admin (hides class-creation controls for teachers)
  useEffect(() => {
    if (!teacher?.schoolId) return
    fetch(`/api/school/has-admin?schoolId=${teacher.schoolId}`)
      .then(r => r.json())
      .then(d => setHasAdmin(!!d.hasAdmin))
      .catch(() => {})
  }, [teacher?.schoolId])

  // Auto-trigger tour the first time all 4 setup steps are done
  useEffect(() => {
    if (!teacher || !allSetupDone) return
    const tourSeen = localStorage.getItem(`eduteach_tour_seen_${teacher.id}`) === 'true'
    if (!tourSeen) {
      const t = setTimeout(() => setShowTour(true), 420)
      return () => clearTimeout(t)
    }
  }, [teacher, allSetupDone])

  const handleLogout = async () => { await logout(); router.replace('/login') }
  const getStudentCount = (classId: string) =>
    students.filter(s => s.classId === classId && s.isActive).length
  const totalStudents = students.filter(s => s.isActive && assignedIds.has(s.classId)).length

  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>

      {/* â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="gradient-header px-4 pt-10 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />

        <div className="relative z-10">
          {/* Top row */}
          <div className="flex items-center justify-between mb-7">
            <div className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider text-white/60"
              style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
              {dateStr}
            </div>
            <div className="flex items-center gap-2">
              <div className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                syncStatus === 'online'  ? 'text-emerald-300' :
                syncStatus === 'offline' ? 'text-red-300' : 'text-white/50'
              )} style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                {syncStatus === 'online'  ? <Wifi size={11} /> :
                 syncStatus === 'offline' ? <WifiOff size={11} /> :
                 <div className="w-2.5 h-2.5 border border-white/50 border-t-transparent rounded-full animate-spin" />}
                <span className="capitalize">{syncStatus}</span>
              </div>
              <button onClick={handleLogout}
                className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                <LogOut size={15} className="text-white/70" />
              </button>
            </div>
          </div>

          {/* Teacher identity â€” serif italic name is the signature element */}
          <p className="text-blue-300/70 text-[11px] font-semibold tracking-widest uppercase mb-1">{greeting}</p>
          <h1 className="text-white leading-none mb-3"
            style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 600, fontSize: '3.25rem' }}>
            {teacher?.name?.split(' ')[0] ?? 'Teacher'}
          </h1>

          {/* School / subject divider strip */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px w-4 shrink-0 bg-white/20" />
            <p className="text-white/40 text-xs font-medium truncate">
              {teacher?.schoolName ?? 'Your School'}{teacher?.subject ? ` · ${teacher.subject}` : ''}
            </p>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Stat pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="stat-pill"><Users size={12} /><span>{totalStudents} students</span></div>
            <div className="stat-pill"><GraduationCap size={12} /><span>{myClasses.length} classes</span></div>
            {teacher?.currentTerm && (
              <div className="stat-pill"><TrendingUp size={12} /><span>{teacher.currentTerm}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ CONTENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="-mt-16 px-4 md:px-8 space-y-4 pb-28 md:pb-12 relative z-10 max-w-4xl md:mx-auto">

        <TodaySchedule />

        {teacher && (
          <OnboardingChecklist
            teacherId={teacher.id}
            classes={classes}
            students={students}
            syllabusTopics={syllabusTopics}
            timetableEntries={timetableEntries}
            onCreateClass={hasAdmin ? undefined : () => setCreateOpen(true)}
            hasAdmin={hasAdmin}
          />
        )}

        {/* Morning briefing â€” dark command panel */}
        <div className="rounded-3xl px-5 py-4"
          style={{ background: '#07153a', boxShadow: '0 4px 28px rgba(7,21,58,0.3)' }}>
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 mb-0.5">Morning Briefing</p>
              <p className="text-[11px] text-white/30 font-medium">Updates each day</p>
            </div>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Sparkles size={13} className="text-blue-300/70" />
            </div>
          </div>
          <ErrorBoundary label="daily briefing"><DailyBriefing dark /></ErrorBoundary>
        </div>

        {/* Classes section */}
        <div>
          {/* Editorial section header */}
          <div className="flex items-center gap-3 mb-3 px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Your Classes</span>
            <div className="h-px flex-1 bg-slate-200" />
            {hasAdmin ? (
              <span className="text-[11px] text-slate-400 shrink-0 italic">Managed by admin</span>
            ) : (
              <button onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-blue-600 shrink-0">
                <Plus size={11} strokeWidth={3} /> Add class
              </button>
            )}
          </div>

          {myClasses.length === 0 ? (
            <EmptyClasses onCreate={hasAdmin ? undefined : () => setCreateOpen(true)} />
          ) : (
            <div className="space-y-3">

              {/* Register-style class table */}
              <ErrorBoundary label="class list">
              <div className="bg-white overflow-hidden rounded-2xl" style={{ border: '1.5px solid #e2e8f0' }}>
                {myClasses.map((cls, idx) => {
                  const color      = CLASS_COLORS[idx % CLASS_COLORS.length]
                  const count      = getStudentCount(cls.id)
                  const syllabus   = getClassSyllabus(cls.id)
                  const sessions   = getClassSessions(cls.id)
                  const completed  = syllabus.filter(t => t.isCompleted).length
                  const total      = syllabus.length
                  const pct        = total > 0 ? Math.round((completed / total) * 100) : 0
                  const lastDate   = sessions[0] ? formatRelativeDate(sessions[0].date) : null

                  return (
                    <button key={cls.id} type="button"
                      onClick={() => router.push(`/classes/${cls.id}/students`)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 active:bg-slate-50 transition-colors text-left animate-fade-up"
                      style={{ borderLeft: `3px solid ${color.border}`, animationDelay: `${idx * 55}ms` }}
                    >
                      {/* Class info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-slate-900 truncate">{cls.name}</span>
                          {cls.section && (
                            <span className="text-[11px] font-semibold text-slate-400 shrink-0">· {cls.section}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {count} students · {lastDate ?? 'No sessions yet'}
                        </p>
                      </div>

                      {/* Progress â€” monospace data value */}
                      {total > 0 ? (
                        <div className="text-right shrink-0">
                          <p className="font-mono font-extrabold text-lg leading-none" style={{ color: color.num }}>
                            {pct}<span className="text-xs font-bold text-slate-300 ml-0.5">%</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{completed}/{total} topics</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 shrink-0 italic">No syllabus</p>
                      )}

                      <ChevronRight size={13} className="text-slate-300 shrink-0" />
                    </button>
                  )
                })}
              </div>
              </ErrorBoundary>

              {/* Quick links — single toolbar */}
              <div className="bg-white rounded-2xl overflow-hidden flex divide-x divide-slate-100"
                style={{ border: '1.5px solid #e2e8f0' }}>
                {[
                  { label: 'All Classes', icon: GraduationCap, href: '/classes',      color: '#2563eb' },
                  { label: 'Alerts',      icon: CalendarCheck, href: '/alerts',       color: '#d97706' },
                  { label: 'Year',        icon: Trophy,        href: '/year-summary', color: '#1d4ed8' },
                ].map(({ label, icon: Icon, href, color }) => (
                  <button key={href} type="button"
                    onClick={() => router.push(href)}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3.5 px-2 active:bg-slate-50 transition-colors">
                    <Icon size={16} style={{ color }} strokeWidth={2} />
                    <span className="text-[10px] font-bold text-slate-500 text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>

            </div>
          )}
        </div>
      </div>

      <CreateClassModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Floating "?" guide button */}
      {showGuideBtn && teacher && (
        <button
          onClick={() => setShowTour(true)}
          className="fixed bottom-24 md:bottom-8 right-4 z-40 w-11 h-11 flex items-center justify-center rounded-full font-black text-white text-base shadow-lg active:scale-90 transition-transform"
          style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)', boxShadow: '0 4px 18px rgba(29,78,216,0.45)' }}
          title="Open App Guide"
        >
          ?
        </button>
      )}

      {/* Feature tour modal */}
      {teacher && (
        <FeatureTour
          teacherId={teacher.id}
          open={showTour}
          onClose={() => setShowTour(false)}
        />
      )}
    </div>
  )
}

function EmptyClasses({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="bg-white rounded-2xl px-6 py-14 text-center" style={{ border: '1.5px solid #e2e8f0' }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: '#eff6ff' }}>
        <GraduationCap size={28} className="text-blue-600" />
      </div>
      {onCreate ? (
        <>
          <h3 className="font-bold text-slate-800 text-lg">Start your first class</h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
            Add a class, enroll students, and let AI help you teach smarter every day.
          </p>
          <button onClick={onCreate}
            className="mt-6 inline-flex items-center gap-2 text-white font-bold px-8 py-3 rounded-xl text-sm active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}>
            <Plus size={15} strokeWidth={2.5} /> Create Class
          </button>
        </>
      ) : (
        <>
          <h3 className="font-bold text-slate-800 text-lg">No classes yet</h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
            Classes are managed by your school admin. Once assigned, they will appear here.
          </p>
        </>
      )}
    </div>
  )
}

function formatRelativeDate(dateStr: string): string {
  const d     = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return `${diff} days ago`
  if (diff < 30) return `${Math.round(diff / 7)}w ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
