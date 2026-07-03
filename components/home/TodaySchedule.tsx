'use client'
import { useMemo, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { CalendarX, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function nowHHMM() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

export default function TodaySchedule() {
  const router = useRouter()
  const { classes, getTodaySchedule, getCurrentPeriod } = useApp()
  const [hhmm, setHhmm] = useState(nowHHMM)

  useEffect(() => {
    const t = setInterval(() => setHhmm(nowHHMM()), 60_000)
    return () => clearInterval(t)
  }, [])

  const todayEntries  = useMemo(() => getTodaySchedule(), [getTodaySchedule])
  const currentPeriod = useMemo(() => getCurrentPeriod(),  [getCurrentPeriod])
  const dayName = DAYS[new Date().getDay()]
  const isWeekend = [0, 6].includes(new Date().getDay())

  if (todayEntries.length === 0) {
    return (
      <div className="bg-white rounded-3xl px-6 py-10 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
        <CalendarX className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-400">
          {isWeekend ? 'Enjoy your weekend!' : 'No schedule set for today'}
        </p>
        <button
          onClick={() => router.push('/settings')}
          className="mt-3 text-xs font-bold text-blue-500"
        >
          Set up timetable →
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-50">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Today</p>
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-black text-slate-900">{dayName}&apos;s Schedule</h2>
          {currentPeriod && (
            <span className="flex items-center gap-1.5 text-[11px] font-black text-blue-500 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Period {currentPeriod.periodNumber} live
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 pt-4 pb-2">
        {todayEntries.map((entry, idx) => {
          const cls       = classes.find(c => c.id === entry.classId)
          const isCurrent = entry.startTime <= hhmm && entry.endTime > hhmm
          const isPast    = entry.endTime <= hhmm
          const isLast    = idx === todayEntries.length - 1

          return (
            <div key={entry.id} className="flex gap-3">

              {/* Timeline spine */}
              <div className="flex flex-col items-center" style={{ width: 18, paddingTop: 14 }}>
                <div className={clsx(
                  'w-2.5 h-2.5 rounded-full shrink-0 z-10 transition-all',
                  isCurrent
                    ? 'bg-blue-600 ring-[3px] ring-blue-100'
                    : isPast
                    ? 'bg-slate-200'
                    : 'bg-slate-300 ring-2 ring-white',
                )} />
                {!isLast && <div className="w-px flex-1 mt-1.5" style={{ background: '#e2e8f0', minHeight: 20 }} />}
              </div>

              {/* Period card */}
              <button
                type="button"
                onClick={() => cls && router.push(`/classes/${cls.id}/attendance`)}
                disabled={!cls}
                className={clsx(
                  'flex-1 flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-2.5 text-left transition-all',
                  isCurrent
                    ? 'shadow-sm'
                    : isPast
                    ? 'opacity-50'
                    : 'hover:bg-slate-50 active:bg-slate-50',
                )}
                style={isCurrent ? {
                  background: '#eff6ff',
                  border: '1.5px solid #bfdbfe',
                } : {
                  background: '#f8fafc',
                  border: '1.5px solid #f1f5f9',
                }}
              >
                {/* Time column */}
                <div className="shrink-0 w-11">
                  <p className={clsx(
                    'text-[11px] font-black tabular-nums leading-tight',
                    isCurrent ? 'text-blue-600' : isPast ? 'text-slate-300' : 'text-slate-500',
                  )}>
                    {entry.startTime}
                  </p>
                  <p className="text-[10px] tabular-nums text-slate-300 leading-tight">{entry.endTime}</p>
                </div>

                {/* Period number badge */}
                <div className={clsx(
                  'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0',
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : isPast
                    ? 'bg-slate-100 text-slate-300'
                    : 'bg-slate-100 text-slate-500',
                )}>
                  {entry.periodNumber}
                </div>

                {/* Class info */}
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'text-sm font-bold leading-tight truncate',
                    isCurrent ? 'text-blue-900' : isPast ? 'text-slate-400' : 'text-slate-800',
                  )}>
                    {cls?.name ?? '—'}
                  </p>
                  {isCurrent ? (
                    <p className="text-[10px] font-black text-blue-500 mt-0.5 uppercase tracking-wide">
                      Now · Tap to take attendance
                    </p>
                  ) : !isPast && cls ? (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Grade {cls.grade}{cls.section ? ` · Sec ${cls.section}` : ''}
                    </p>
                  ) : null}
                </div>

                {isCurrent && <ChevronRight size={14} className="text-blue-400 shrink-0" />}
              </button>
            </div>
          )
        })}
      </div>

      {/* Attendance CTA for current period */}
      {currentPeriod && (
        <div className="px-4 pb-4 pt-0">
          <button
            type="button"
            onClick={() => {
              const cls = classes.find(c => c.id === currentPeriod.classId)
              if (cls) router.push(`/classes/${cls.id}/attendance`)
            }}
            className="w-full py-3 rounded-2xl text-sm font-black text-white tracking-wide"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
              boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
            }}
          >
            Take attendance now →
          </button>
        </div>
      )}
    </div>
  )
}
