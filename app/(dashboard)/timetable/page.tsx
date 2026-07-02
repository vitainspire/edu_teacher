'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/lib/context'
import { CalendarDays, Clock, Coffee, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

const DAYS     = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function nowHHMM() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

function todayDayNum() {
  const d = new Date().getDay()
  return d === 0 ? 0 : d
}

export default function TimetablePage() {
  const { timetableEntries, classes } = useApp()
  const router = useRouter()
  const [showFullWeek, setShowFullWeek] = useState(false)

  const hhmm   = nowHHMM()
  const todayN = todayDayNum()

  const todayLabel = DAY_NAMES[new Date().getDay()]

  // Today's periods sorted by period number
  const todayEntries = useMemo(() =>
    timetableEntries
      .filter(e => e.dayOfWeek === todayN)
      .sort((a, b) => a.periodNumber - b.periodNumber),
  [timetableEntries, todayN])

  // All unique period slots for the weekly grid
  const periodSlots = useMemo(() => {
    const map = new Map<number, { periodNumber: number; startTime: string; endTime: string }>()
    timetableEntries.forEach(e => {
      if (!map.has(e.periodNumber)) {
        map.set(e.periodNumber, { periodNumber: e.periodNumber, startTime: e.startTime, endTime: e.endTime })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [timetableEntries])

  function entryAt(dayOfWeek: number, periodNumber: number) {
    return timetableEntries.find(e => e.dayOfWeek === dayOfWeek && e.periodNumber === periodNumber)
  }

  function getClassName(classId: string) {
    return classes.find(c => c.id === classId)?.name ?? '—'
  }

  function getClassColor(classId: string) {
    const idx = classes.findIndex(c => c.id === classId)
    return idx >= 0 ? CLASS_COLORS[idx % CLASS_COLORS.length] : CLASS_COLORS[0]
  }

  const isNowPeriod = (startTime: string, endTime: string) =>
    hhmm >= startTime && hhmm < endTime

  if (timetableEntries.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: '#f1f5f9' }}>
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
          <CalendarDays size={28} className="text-blue-600" />
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-2">No Timetable Yet</h2>
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
          Your school admin hasn&apos;t published your timetable yet. Once they do, your full weekly schedule will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28 md:pb-8" style={{ background: '#f1f5f9' }}>

      {/* Header */}
      <div className="gradient-header px-4 pt-10 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />
        <div className="relative z-10">
          <p className="text-blue-300/70 text-[11px] font-semibold tracking-widest uppercase mb-2">
            {todayLabel}
          </p>
          <h1 className="text-3xl font-black text-white leading-none flex items-center gap-3">
            <CalendarDays size={28} className="opacity-80" />
            Today&apos;s Schedule
          </h1>
          <p className="text-blue-200/60 text-sm font-medium mt-1.5">
            {todayEntries.length > 0
              ? `${todayEntries.length} class${todayEntries.length !== 1 ? 'es' : ''} today`
              : 'No classes scheduled today'}
          </p>
        </div>
      </div>

      <div className="-mt-8 px-3 md:px-6 relative z-10 max-w-2xl md:mx-auto space-y-3">

        {/* Today's class list */}
        {todayEntries.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100">
            <Coffee size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-500">No classes on {todayLabel}</p>
            <p className="text-xs text-slate-400 mt-1">Use the button below to check your full week</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {todayEntries.map(entry => {
              const isNow  = isNowPeriod(entry.startTime, entry.endTime)
              const color  = getClassColor(entry.classId)
              const cls    = classes.find(c => c.id === entry.classId)

              return (
                <button
                  key={entry.id}
                  onClick={() => router.push(`/classes/${entry.classId}/attendance`)}
                  className="w-full text-left bg-white rounded-2xl overflow-hidden shadow-sm border transition-all active:scale-[0.98] hover:shadow-md"
                  style={{
                    borderColor: isNow ? '#3b82f6' : '#e2e8f0',
                    boxShadow: isNow ? '0 0 0 2px #bfdbfe' : undefined,
                  }}
                >
                  <div className="flex items-stretch">
                    {/* Color strip */}
                    <div className="w-1.5 shrink-0" style={{ background: color.text }} />

                    {/* Period badge */}
                    <div className="flex flex-col items-center justify-center px-4 py-4 border-r border-slate-100"
                      style={{ background: isNow ? '#eff6ff' : '#f8fafc', minWidth: 64 }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black mb-1"
                        style={isNow
                          ? { background: '#2563eb', color: '#fff' }
                          : { background: color.bg, color: color.text }}>
                        {entry.periodNumber}
                      </div>
                      {isNow && (
                        <span className="text-[8px] font-black text-blue-500 animate-pulse tracking-wide">NOW</span>
                      )}
                    </div>

                    {/* Class info */}
                    <div className="flex-1 px-4 py-4">
                      <p className="font-black text-slate-800 text-base leading-none">
                        {getClassName(entry.classId)}
                      </p>
                      {entry.label && (
                        <p className="text-xs font-medium mt-0.5" style={{ color: color.text }}>{entry.label}</p>
                      )}
                    </div>

                    {/* Time */}
                    <div className="flex flex-col items-end justify-center px-4 py-4 shrink-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Clock size={10} className="text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-500">{entry.startTime}</span>
                      </div>
                      <span className="text-[11px] text-slate-300">{entry.endTime}</span>
                      {isNow && (
                        <span className="text-[9px] font-bold text-blue-500 mt-1">Tap → Attend</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* View Full Week toggle */}
        <button
          onClick={() => setShowFullWeek(v => !v)}
          className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 mt-1"
          style={{
            background: showFullWeek ? '#eff6ff' : '#fff',
            border: `1.5px solid ${showFullWeek ? '#3b82f6' : '#e2e8f0'}`,
            color: showFullWeek ? '#2563eb' : '#64748b',
          }}
        >
          <CalendarDays size={15} />
          {showFullWeek ? 'Hide Full Week' : 'View Full Week'}
          {showFullWeek ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {/* Full weekly grid — shown only when toggled */}
        {showFullWeek && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Weekly Timetable</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th className="w-20 px-3 py-3 text-left border-b border-slate-100" style={{ background: '#f8fafc' }}>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Time</span>
                      </div>
                    </th>
                    {DAYS.map((day, i) => {
                      const dayNum = i + 1
                      const isToday = dayNum === todayN
                      return (
                        <th key={day} className="px-2 py-3 text-center border-b border-slate-100"
                          style={{ background: isToday ? '#eff6ff' : '#f8fafc', minWidth: 90 }}>
                          <p className={`text-xs font-black ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>{DAY_SHORT[i]}</p>
                          <p className={`text-[10px] font-medium ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>{day}</p>
                          {isToday && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black text-white"
                              style={{ background: '#2563eb' }}>TODAY</span>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                <tbody>
                  {periodSlots.map((slot, idx) => {
                    const isNow = isNowPeriod(slot.startTime, slot.endTime)
                    return (
                      <tr key={idx} className={isNow ? '' : 'hover:bg-slate-50 transition-colors'}
                        style={isNow ? { background: '#eff6ff' } : {}}>

                        <td className="px-3 py-3 border-b border-slate-100 align-middle" style={{ background: isNow ? '#dbeafe' : '#f8fafc' }}>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0`}
                              style={isNow
                                ? { background: '#2563eb', color: '#fff' }
                                : { background: '#ede9fe', color: '#6d28d9' }}>
                              {slot.periodNumber}
                            </div>
                          </div>
                          <p className={`text-[9px] font-medium mt-1 ${isNow ? 'text-blue-700' : 'text-slate-400'}`}>{slot.startTime}</p>
                          <p className="text-[9px] text-slate-300">{slot.endTime}</p>
                          {isNow && <p className="text-[8px] font-black text-blue-500 mt-0.5 animate-pulse">NOW</p>}
                        </td>

                        {DAYS.map((_, di) => {
                          const dayNum = di + 1
                          const entry  = entryAt(dayNum, slot.periodNumber)
                          const isToday   = dayNum === todayN
                          const isCurrent = isToday && isNow
                          const color = entry ? getClassColor(entry.classId) : null

                          return (
                            <td key={dayNum} className="px-2 py-2 border-b border-slate-100 align-middle"
                              style={{ background: isCurrent ? '#dbeafe' : isToday ? '#f0f7ff' : undefined }}>
                              {entry ? (
                                <button
                                  onClick={() => router.push(`/classes/${entry.classId}/attendance`)}
                                  className="w-full text-left rounded-xl p-2 transition-all hover:shadow-sm active:scale-95"
                                  style={{
                                    background: color?.bg ?? '#f0fdf4',
                                    border: `1px solid ${color?.border ?? '#bbf7d0'}`,
                                    boxShadow: isCurrent ? '0 0 0 2px #3b82f6' : undefined,
                                  }}>
                                  <p className="text-[11px] font-black truncate leading-tight" style={{ color: color?.text ?? '#065f46' }}>
                                    {getClassName(entry.classId)}
                                  </p>
                                  {entry.label && (
                                    <p className="text-[9px] font-medium mt-0.5 truncate opacity-75" style={{ color: color?.text ?? '#065f46' }}>
                                      {entry.label}
                                    </p>
                                  )}
                                  {isCurrent && (
                                    <p className="text-[8px] font-black mt-0.5 text-blue-600">Tap → Attendance</p>
                                  )}
                                </button>
                              ) : (
                                <div className="h-10 rounded-xl border border-dashed border-slate-100 flex items-center justify-center">
                                  <span className="text-[10px] text-slate-200">—</span>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ background: '#dbeafe', border: '1px solid #3b82f6' }} />
                <span className="text-[10px] text-slate-500 font-medium">Current period</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }} />
                <span className="text-[10px] text-slate-500 font-medium">Today</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <Coffee size={11} className="text-slate-400" />
                <span className="text-[10px] text-slate-400">Tap any period to take attendance</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const CLASS_COLORS = [
  { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#cffafe', text: '#164e63', border: '#67e8f9' },
  { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  { bg: '#f0fdf4', text: '#14532d', border: '#86efac' },
]
