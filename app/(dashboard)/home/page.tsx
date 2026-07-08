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
import Modal from '@/components/ui/Modal'
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist'
import FeatureTour from '@/components/onboarding/FeatureTour'
import PageHeader from '@/components/theme/PageHeader'
import SubstituteBanner from '@/components/timetable/SubstituteBanner'
import AttendanceCircle from '@/components/home/AttendanceCircle'
import { Sticker, NotebookSticker } from '@/components/theme/StickerIcon'
import clsx from 'clsx'

const CLASS_COLORS = [
  { border: '#AACDEA', num: '#5B87AD' },
  { border: '#AAD6A0', num: '#5C8F52' },
  { border: '#F0A491', num: '#C46B54' },
  { border: '#EAC968', num: '#AD8A2C' },
  { border: '#C7B7E8', num: '#8069B0' },
  { border: '#F0AFC6', num: '#BD6D8B' },
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
  const [briefingOpen, setBriefingOpen] = useState(false)

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

  const handleLogout = async () => { await logout(); router.replace('/teacher/login') }
  const getStudentCount = (classId: string) =>
    students.filter(s => s.classId === classId && s.isActive).length
  const totalStudents = students.filter(s => s.isActive && assignedIds.has(s.classId)).length

  return (
    <div className="paper-page pb-28">

      {/* ── HEADER ──────────────────────────────────────────── */}
      <PageHeader
        eyebrow={greeting}
        title={teacher?.name?.split(' ')[0] ?? 'Teacher'}
        subtitle={`${teacher?.schoolName ?? 'Your School'}${teacher?.subject ? ` · ${teacher.subject}` : ''}`}
        back={false}
        action={
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-full text-xs font-semibold text-ink-soft" style={{ background: 'rgba(58,44,30,0.06)' }}>
              {dateStr}
            </div>
            <div className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
              syncStatus === 'online'  ? 'text-emerald-700' :
              syncStatus === 'offline' ? 'text-red-600' : 'text-ink-soft'
            )} style={{ background: 'rgba(58,44,30,0.06)' }}>
              {syncStatus === 'online'  ? <Wifi size={11} /> :
               syncStatus === 'offline' ? <WifiOff size={11} /> :
               <div className="w-2.5 h-2.5 border border-ink-faint border-t-transparent rounded-full animate-spin" />}
              <span className="capitalize">{syncStatus}</span>
            </div>
            <button onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
              style={{ background: 'rgba(58,44,30,0.06)' }}>
              <LogOut size={15} className="text-ink-soft" />
            </button>
          </div>
        }
      />

      <div className="px-5 relative z-10 mb-3 space-y-2">
        <SubstituteBanner />
      </div>

      <div className="px-5 relative z-10 flex items-center gap-2 flex-wrap mb-1">
        <span className="paper-pill flex items-center gap-1.5"><Users size={12} />{totalStudents} students</span>
        <span className="paper-pill flex items-center gap-1.5"><GraduationCap size={12} />{myClasses.length} classes</span>
        {teacher?.currentTerm && (
          <span className="paper-pill flex items-center gap-1.5"><TrendingUp size={12} />{teacher.currentTerm}</span>
        )}
      </div>

      {/* ── CONTENT ─────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-3 space-y-4 pb-28 md:pb-12 relative z-10 max-w-4xl md:mx-auto">

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


        {/* Classes section */}
        <div>
          {/* Editorial section header */}
          <div className="flex items-center gap-3 mb-3 px-1">
            <span className="text-[11px] font-bold text-ink-soft uppercase tracking-widest shrink-0">Your Classes</span>
            <div className="h-px flex-1" style={{ background: 'rgba(58,44,30,0.12)' }} />
            {hasAdmin ? (
              <span className="text-[11px] text-ink-faint shrink-0 italic">Managed by admin</span>
            ) : (
              <button onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-ink shrink-0">
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
              <div className="paper-card overflow-hidden">
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
                      className="w-full flex items-center gap-3 px-4 py-3.5 last:border-0 active:bg-black/[0.03] transition-colors text-left animate-fade-up"
                      style={{ borderLeft: `3px solid ${color.border}`, borderBottom: '1px solid rgba(58,44,30,0.08)', animationDelay: `${idx * 55}ms` }}
                    >
                      {/* Class info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-ink truncate">{cls.name}</span>
                          {cls.section && (
                            <span className="text-[11px] font-semibold text-ink-soft shrink-0">· {cls.section}</span>
                          )}
                        </div>
                        <p className="text-xs text-ink-soft">
                          {count} students · {lastDate ?? 'No sessions yet'}
                        </p>
                      </div>

                      {/* Progress — monospace data value */}
                      {total > 0 ? (
                        <div className="text-right shrink-0">
                          <p className="font-mono font-extrabold text-lg leading-none" style={{ color: color.num }}>
                            {pct}<span className="text-xs font-bold text-ink-faint ml-0.5">%</span>
                          </p>
                          <p className="text-[10px] text-ink-soft mt-0.5">{completed}/{total} topics</p>
                        </div>
                      ) : (
                        <p className="text-xs text-ink-soft shrink-0 italic">No syllabus</p>
                      )}

                      <ChevronRight size={13} className="text-ink-faint shrink-0" />
                    </button>
                  )
                })}
              </div>
              </ErrorBoundary>

              {/* Quick links — single toolbar */}
              <div className="paper-card overflow-hidden flex divide-x" style={{ borderColor: 'rgba(58,44,30,0.08)' }}>
                {[
                  { label: 'All Classes', icon: GraduationCap, href: '/classes',      color: '#5B87AD' },
                  { label: 'Alerts',      icon: CalendarCheck, href: '/alerts',       color: '#C46B54' },
                  { label: 'Year',        icon: Trophy,        href: '/year-summary', color: '#AD8A2C' },
                ].map(({ label, icon: Icon, href, color }) => (
                  <button key={href} type="button"
                    onClick={() => router.push(href)}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3.5 px-2 active:bg-black/[0.03] transition-colors">
                    <Icon size={16} style={{ color }} strokeWidth={2} />
                    <span className="text-[10px] font-bold text-ink-soft text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>

            </div>
          )}
        </div>
      </div>

      <CreateClassModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Floating attendance-status button — right above Morning Briefing */}
      {teacher && <AttendanceCircle />}

      {/* Floating Morning Briefing button */}
      {teacher && (
        <button
          onClick={() => setBriefingOpen(true)}
          className="fixed bottom-40 md:bottom-24 right-4 z-40 w-11 h-11 flex items-center justify-center rounded-full text-white active:scale-90 transition-transform"
          style={{ background: '#8069B0', border: '1.5px solid rgba(58,44,30,0.18)' }}
          title="Morning Briefing"
        >
          <Sparkles size={17} />
        </button>
      )}

      {/* Floating "?" guide button */}
      {showGuideBtn && teacher && (
        <button
          onClick={() => setShowTour(true)}
          className="fixed bottom-24 md:bottom-8 right-4 z-40 w-11 h-11 flex items-center justify-center rounded-full font-black text-white text-base active:scale-90 transition-transform"
          style={{ background: 'var(--ink)' }}
          title="Open App Guide"
        >
          ?
        </button>
      )}

      {/* Morning briefing modal */}
      <Modal open={briefingOpen} onClose={() => setBriefingOpen(false)} title="Morning Briefing">
        <ErrorBoundary label="daily briefing"><DailyBriefing /></ErrorBoundary>
      </Modal>

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
    <div className="paper-card px-6 py-14 text-center">
      <Sticker tone="cream" size={64} radius={20} style={{ margin: '0 auto 16px' }}>
        <NotebookSticker size={30} />
      </Sticker>
      {onCreate ? (
        <>
          <h3 className="font-display font-bold text-ink text-lg">Start your first class</h3>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-xs mx-auto">
            Add a class, enroll students, and let AI help you teach smarter every day.
          </p>
          <button onClick={onCreate} className="paper-btn-primary mt-6 inline-flex px-8">
            <Plus size={15} strokeWidth={2.5} /> Create Class
          </button>
        </>
      ) : (
        <>
          <h3 className="font-display font-bold text-ink text-lg">No classes yet</h3>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-xs mx-auto">
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
