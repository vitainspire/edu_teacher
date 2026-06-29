'use client'
import { useApp } from '@/lib/context'

function relativeDate(dateStr: string): string {
  const d    = new Date(dateStr)
  const now  = new Date()
  const diff = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function DailyBriefing({ dark = false }: { dark?: boolean }) {
  const { teacher, getBriefingData } = useApp()
  const classes = getBriefingData()

  const muted = dark ? 'text-blue-200/50' : 'text-slate-400'
  const card  = dark ? 'bg-white/8' : 'bg-slate-50 border border-slate-100'
  const label = dark ? 'text-blue-300/80' : 'text-indigo-600'

  return (
    <div className="space-y-1.5">
      {/* Simple greeting — no AI needed */}
      <p className={`text-sm font-medium mb-3 ${dark ? 'text-blue-100/70' : 'text-slate-500'}`}>
        Good morning, {teacher?.name?.split(' ')[0] ?? 'Teacher'}! Here&apos;s a quick look at your classes.
      </p>

      {classes.length === 0 && (
        <p className={`text-sm ${dark ? 'text-white/30' : 'text-slate-400'}`}>
          Add classes and record sessions to see your briefing here.
        </p>
      )}

      {classes.map(c => (
        <div key={c.classId} className={`rounded-2xl px-3 py-2.5 ${card}`}>
          <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${label}`}>
            Grade {c.grade}{c.section ? ` · ${c.section}` : ''}
          </p>

          {!c.lastSession ? (
            <p className={`text-xs ${muted}`}>No sessions recorded yet</p>
          ) : (
            <div className="space-y-0.5">
              <p className={`text-sm ${dark ? 'text-blue-100/85' : 'text-slate-700'}`}>
                <span className={`font-semibold ${muted}`}>Last class: </span>
                {c.lastSession.topic}
                <span className={`ml-1 text-[11px] ${muted}`}>· {relativeDate(c.lastSession.date)}</span>
                {c.lastSession.absentCount > 0 && (
                  <span className={`ml-1.5 text-xs font-semibold ${dark ? 'text-amber-300' : 'text-amber-600'}`}>
                    · {c.lastSession.absentCount} absent
                  </span>
                )}
              </p>
              {c.atRiskCount > 0 && (
                <p className={`text-xs font-semibold ${dark ? 'text-red-300' : 'text-red-500'}`}>
                  ⚠ {c.atRiskCount} student{c.atRiskCount > 1 ? 's' : ''} need attention
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
