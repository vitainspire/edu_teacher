'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { useApp } from '@/lib/context'
import CreateClassModal from '@/components/classes/CreateClassModal'
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist'
import TodaySchedule from '@/components/home/TodaySchedule'
import WeekSchedule from '@/components/home/WeekSchedule'

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function HomePage() {
  const {
    teacher, classes, students, assignments,
    syllabusTopics, timetableEntries, getStudentWarnings,
  } = useApp()

  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [greeting,   setGreeting]   = useState('Good morning')
  const [dateStr,    setDateStr]    = useState('')
  const [hasAdmin,   setHasAdmin]   = useState(false)

  const allSetupDone =
    classes.length > 0 &&
    students.filter(s => s.isActive).length > 0 &&
    timetableEntries.length > 0 &&
    syllabusTopics.length > 0

  // Students needing attention (at least one warning)
  const alertCount = useMemo(() => {
    const ids = new Set([
      ...(assignments ?? []).map(a => a.classId),
      ...(classes ?? []).filter(c => c.teacherId === teacher?.id).map(c => c.id),
    ])
    return students
      .filter(s => s.isActive && ids.has(s.classId))
      .filter(s => getStudentWarnings(s.id).length > 0)
      .length
  }, [students, assignments, classes, teacher, getStudentWarnings])

  useEffect(() => {
    const now  = new Date()
    const hour = now.getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
    setDateStr(`${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`)
  }, [])

  useEffect(() => {
    if (!teacher?.schoolId) return
    fetch(`/api/school/has-admin?schoolId=${teacher.schoolId}`)
      .then(r => r.json())
      .then(d => setHasAdmin(!!d.hasAdmin))
      .catch(() => {})
  }, [teacher?.schoolId])

  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>

      {/* ── Header ── */}
      <div className="gradient-header relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative z-10 px-5 pt-10 pb-24 max-w-2xl mx-auto md:max-w-3xl">
          <p className="text-blue-300/60 text-[10px] font-bold uppercase tracking-widest mb-1">{greeting}</p>
          <h1
            className="text-white leading-none mb-2"
            style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 600, fontSize: '2.75rem' }}
          >
            {teacher?.name?.split(' ')[0] ?? 'Teacher'}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-white/35 text-xs font-medium truncate">
              {teacher?.schoolName ?? 'Your School'}
              {teacher?.subject ? ` · ${teacher.subject}` : ''}
            </p>
            <span className="text-white/20 text-xs">·</span>
            <p className="text-blue-300/40 text-xs shrink-0">{dateStr}</p>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="-mt-16 px-4 pb-28 md:pb-12 space-y-3 relative z-10 max-w-2xl mx-auto md:max-w-3xl">

        {/* Onboarding checklist — only until all steps are done */}
        {!allSetupDone && teacher && (
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

        {/* Today's timetable — primary content */}
        <TodaySchedule />

        {/* Full weekly timetable — collapsed by default */}
        <WeekSchedule />

        {/* Alert badge — students needing attention */}
        {alertCount > 0 && (
          <button
            type="button"
            onClick={() => router.push('/alerts')}
            className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 text-left transition-all active:bg-amber-50"
            style={{
              border: '1.5px solid #fef3c7',
              boxShadow: '0 2px 10px rgba(245,158,11,0.07)',
            }}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800">
                {alertCount} student{alertCount !== 1 ? 's' : ''} need{alertCount === 1 ? 's' : ''} attention
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Absent or scored low on a recent topic</p>
            </div>
            <span className="text-xs font-bold text-amber-500 shrink-0">View →</span>
          </button>
        )}

      </div>

      <CreateClassModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
