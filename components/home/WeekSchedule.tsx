'use client'
import { useState, useMemo } from 'react'
import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '@/lib/context'

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmt(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function WeekSchedule() {
  const { classes, timetableEntries } = useApp()
  const [open, setOpen] = useState(false)

  // JS getDay(): 0=Sun, 1=Mon…6=Sat — matches our dayOfWeek directly
  const todayDow = new Date().getDay()

  const { activeDays, periods, cellMap } = useMemo(() => {
    const daySet    = new Set<number>()
    const periodSet = new Set<number>()
    const cell: Record<number, Record<number, typeof timetableEntries[0]>> = {}

    for (const e of timetableEntries) {
      daySet.add(e.dayOfWeek)
      periodSet.add(e.periodNumber)
      if (!cell[e.periodNumber]) cell[e.periodNumber] = {}
      cell[e.periodNumber][e.dayOfWeek] = e
    }

    return {
      activeDays: [1, 2, 3, 4, 5, 6].filter(d => daySet.has(d)),
      periods:    [...periodSet].sort((a, b) => a - b),
      cellMap:    cell,
    }
  }, [timetableEntries])

  if (timetableEntries.length === 0) return null

  const getPeriodTime = (period: number) => {
    const entry = Object.values(cellMap[period] ?? {})[0]
    return entry ? fmt(entry.startTime) : ''
  }

  return (
    <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>

      {/* Header — tap to expand */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 active:bg-slate-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <CalendarDays size={15} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900">This Week</p>
          <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
            {activeDays.map(d => DAY_LABELS[d]).join(' · ')}
          </p>
        </div>
        {open
          ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
          : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
      </button>

      {/* Timetable grid */}
      {open && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 300 }}>
              {/* Day headers */}
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th className="px-4 py-2.5 text-left border-b border-slate-100 w-16">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Period</span>
                  </th>
                  {activeDays.map(dow => {
                    const isToday = dow === todayDow
                    return (
                      <th
                        key={dow}
                        className="px-2 py-2.5 text-center border-b border-slate-100"
                        style={isToday ? { background: '#eff6ff' } : {}}
                      >
                        <span className={`text-[11px] font-black uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                          {DAY_LABELS[dow]}
                        </span>
                        {isToday && (
                          <span className="block text-[8px] font-bold text-blue-400 normal-case tracking-normal leading-none mt-0.5">today</span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>

              {/* Period rows */}
              <tbody>
                {periods.map((period, idx) => (
                  <tr
                    key={period}
                    style={{ background: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}
                  >
                    {/* Period label + time */}
                    <td className="px-4 py-2.5 border-b border-slate-50">
                      <p className="text-xs font-black text-slate-600">P{period}</p>
                      <p className="text-[10px] text-slate-400 tabular-nums leading-tight mt-0.5">{getPeriodTime(period)}</p>
                    </td>

                    {/* Class cells */}
                    {activeDays.map(dow => {
                      const entry  = cellMap[period]?.[dow]
                      const cls    = entry ? classes.find(c => c.id === entry.classId) : null
                      const isToday = dow === todayDow
                      const label  = entry?.label ?? cls?.name

                      return (
                        <td
                          key={dow}
                          className="px-2 py-2.5 text-center border-b border-slate-50"
                          style={isToday ? { background: '#eff6ff' } : {}}
                        >
                          {label ? (
                            <span
                              className="text-xs font-semibold leading-tight block"
                              style={{ color: isToday ? '#1d4ed8' : '#475569' }}
                            >
                              {label}
                            </span>
                          ) : (
                            <span className="text-slate-200 text-sm leading-none">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
