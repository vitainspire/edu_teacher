'use client'
import { useMemo } from 'react'
import { Clock, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import clsx from 'clsx'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function nowHHMM() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

export default function TodaySchedule() {
  const router = useRouter()
  const { classes, getTodaySchedule, getCurrentPeriod } = useApp()

  const todayEntries = useMemo(() => getTodaySchedule(), [getTodaySchedule])
  const currentPeriod = useMemo(() => getCurrentPeriod(), [getCurrentPeriod])

  if (todayEntries.length === 0) return null

  const hhmm = nowHHMM()
  const dayName = DAYS[new Date().getDay()]

  return (
    <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
            <Clock size={13} className="text-blue-600" />
          </div>
          <p className="font-black text-sm text-slate-800">{dayName}&apos;s Schedule</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/settings')}
          className="text-xs font-bold text-blue-600 flex items-center gap-0.5"
        >
          Edit <ChevronRight size={12} />
        </button>
      </div>

      {/* Period rows */}
      <div className="divide-y divide-slate-50">
        {todayEntries.map(entry => {
          const cls = classes.find(c => c.id === entry.classId)
          const isCurrent = entry.startTime <= hhmm && entry.endTime > hhmm
          const isPast = entry.endTime <= hhmm

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => cls && router.push(`/classes/${cls.id}/attendance`)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                isCurrent ? 'bg-blue-50' : 'active:bg-slate-50',
              )}
            >
              {/* Time */}
              <div className="w-14 shrink-0">
                <p className={clsx('text-xs font-bold', isCurrent ? 'text-blue-600' : isPast ? 'text-slate-300' : 'text-slate-500')}>
                  {entry.startTime}
                </p>
                <p className="text-[10px] text-slate-300">{entry.endTime}</p>
              </div>

              {/* Period badge */}
              <div className={clsx(
                'w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0',
                isCurrent ? 'bg-blue-600 text-white' : isPast ? 'bg-slate-100 text-slate-300' : 'bg-blue-100 text-blue-700',
              )}>
                {entry.periodNumber}
              </div>

              {/* Class name */}
              <div className="flex-1 min-w-0">
                <p className={clsx(
                  'text-sm font-bold truncate',
                  isCurrent ? 'text-blue-900' : isPast ? 'text-slate-300' : 'text-slate-800',
                )}>
                  {cls?.name ?? 'Unknown class'}
                </p>
                {isCurrent && (
                  <p className="text-[10px] font-bold text-blue-500 mt-0.5">NOW — tap to take attendance</p>
                )}
              </div>

              {isCurrent && <ChevronRight size={14} className="text-blue-400 shrink-0" />}
            </button>
          )
        })}
      </div>

      {currentPeriod && (
        <div className="px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={() => {
              const cls = classes.find(c => c.id === currentPeriod.classId)
              if (cls) router.push(`/classes/${cls.id}/attendance`)
            }}
            className="w-full py-2.5 rounded-2xl text-sm font-bold text-white text-center"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}
          >
            Take attendance for current period →
          </button>
        </div>
      )}
    </div>
  )
}
