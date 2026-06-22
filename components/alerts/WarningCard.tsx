import { AlertTriangle, Eye, Info } from 'lucide-react'
import type { Warning } from '@/lib/types'
import clsx from 'clsx'

interface Props {
  studentName: string
  rollNumber: string
  warnings: Warning[]
}

const LEVEL_CONFIG = {
  critical: {
    icon: AlertTriangle,
    bg: 'bg-red-50 border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    titleColor: 'text-red-800',
    actionColor: 'text-red-700',
    dot: 'bg-red-500',
  },
  watch: {
    icon: Eye,
    bg: 'bg-yellow-50 border-yellow-200',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    titleColor: 'text-yellow-800',
    actionColor: 'text-yellow-700',
    dot: 'bg-yellow-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-800',
    actionColor: 'text-blue-700',
    dot: 'bg-blue-500',
  },
}

export default function WarningCard({ studentName, rollNumber, warnings }: Props) {
  const topWarning = warnings.sort((a, b) => {
    const order = { critical: 0, watch: 1, info: 2 }
    return order[a.level] - order[b.level]
  })[0]

  const cfg = LEVEL_CONFIG[topWarning.level]
  const Icon = cfg.icon

  return (
    <div className={clsx('rounded-2xl border p-4', cfg.bg)}>
      <div className="flex items-start gap-3">
        <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', cfg.iconBg)}>
          <Icon size={20} className={cfg.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx('font-bold text-base', cfg.titleColor)}>{studentName}</span>
            <span className="text-xs text-gray-500">#{rollNumber}</span>
            {warnings.length > 1 && (
              <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded-full text-white', cfg.dot)}>
                +{warnings.length - 1}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 font-medium">{topWarning.reason}</p>
          <p className={clsx('text-sm mt-1.5 font-semibold', cfg.actionColor)}>
            → {topWarning.action}
          </p>
        </div>
      </div>

      {warnings.length > 1 && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20 space-y-2">
          {warnings.slice(1).map((w, i) => {
            const c2 = LEVEL_CONFIG[w.level]
            return (
              <div key={i} className="flex gap-2">
                <span className={clsx('w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0', c2.dot)} />
                <p className="text-xs text-gray-600">{w.reason}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
