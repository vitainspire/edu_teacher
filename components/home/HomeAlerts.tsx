'use client'
import { useMemo } from 'react'
import { AlertTriangle, Bell, ChevronRight, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { computeHomeAlerts } from '@/lib/logic/home-alerts'
import clsx from 'clsx'

export default function HomeAlerts() {
  const router = useRouter()
  const { classes, sessions, students, getStudentWarnings } = useApp()

  const alerts = useMemo(
    () => computeHomeAlerts(classes, sessions, students, getStudentWarnings),
    [classes, sessions, students, getStudentWarnings],
  )

  if (classes.length === 0) return null

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-3xl px-4 py-3.5 flex items-center gap-3"
        style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }}>
          <CheckCircle2 size={15} className="text-emerald-600" />
        </div>
        <p className="text-sm font-bold text-emerald-800">All classes on track — no alerts</p>
      </div>
    )
  }

  const critCount = alerts.filter(a => a.level === 'critical').length

  return (
    <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      {/* Header strip */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background: critCount > 0
            ? 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)'
            : 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className={clsx(
            'w-7 h-7 rounded-xl flex items-center justify-center',
            critCount > 0 ? 'bg-red-100' : 'bg-amber-100',
          )}>
            <AlertTriangle size={13} className={critCount > 0 ? 'text-red-500' : 'text-amber-500'} />
          </div>
          <p className={clsx('font-black text-sm', critCount > 0 ? 'text-red-900' : 'text-amber-900')}>
            {alerts.length} Alert{alerts.length > 1 ? 's' : ''} Need Attention
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/alerts')}
          className={clsx(
            'text-xs font-bold flex items-center gap-0.5',
            critCount > 0 ? 'text-red-600' : 'text-amber-700',
          )}
        >
          View all <ChevronRight size={12} />
        </button>
      </div>

      {/* Alert rows */}
      <div className="divide-y divide-slate-50">
        {alerts.map(alert => (
          <button
            key={alert.id}
            type="button"
            onClick={() => router.push(alert.actionHref)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 transition-colors"
          >
            <Bell
              size={13}
              className={clsx(
                'shrink-0',
                alert.level === 'critical' ? 'text-red-500' :
                alert.level === 'watch'    ? 'text-amber-500' : 'text-blue-500',
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{alert.title}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{alert.subtitle}</p>
            </div>
            <ChevronRight size={13} className="text-slate-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
