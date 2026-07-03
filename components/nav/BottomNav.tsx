'use client'
import { useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Home, LayoutGrid, Settings2, BookOpen, PenLine } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/lib/context'
import { computeHomeAlerts } from '@/lib/logic/home-alerts'

const NAV_ITEMS = [
  { href: '/home',     label: 'Home',     Icon: Home },
  { href: '/today',    label: 'Today',    Icon: BookOpen },
  { href: '/classes',  label: 'Classes',  Icon: LayoutGrid },
  { href: '/tests',    label: 'Tests',    Icon: PenLine },
  { href: '/settings', label: 'Settings', Icon: Settings2 },
]

export default function BottomNav() {
  const path   = usePathname()
  const router = useRouter()
  const { teacher, classes, sessions, students, tests, marks, getStudentWarnings } = useApp()

  const alertCount = useMemo(
    () => computeHomeAlerts(classes, sessions, students, getStudentWarnings).length,
    [classes, sessions, students, getStudentWarnings],
  )

  const pendingTestCount = useMemo(() => {
    const myClassIds = new Set(
      classes.filter(c => c.teacherId === teacher?.id).map(c => c.id)
    )
    return tests.filter(t => {
      if (!t.classId || !myClassIds.has(t.classId)) return false
      const classStudentCount = students.filter(s => s.classId === t.classId && s.isActive).length
      const enteredCount = new Set(marks.filter(m => m.testId === t.id).map(m => m.studentId)).size
      return classStudentCount > 0 && enteredCount < classStudentCount
    }).length
  }, [tests, marks, classes, students, teacher])

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-bottom nav-blur">
      <div className="max-w-[480px] mx-auto flex items-center px-6 py-2">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active   = path === href || path.startsWith(href + '/')
          const isHome  = href === '/home'
          const isTests = href === '/tests'
          const badge   = isHome ? alertCount : isTests ? pendingTestCount : 0

          return (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200 min-h-[60px]"
            >
              <div className="relative">
                <div
                  className={clsx(
                    'w-12 h-8 flex items-center justify-center rounded-2xl transition-all duration-200',
                    active ? 'shadow-sm' : '',
                  )}
                  style={active ? {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                    boxShadow: '0 2px 10px rgba(37,99,235,0.4)',
                  } : {}}
                >
                  <Icon
                    size={active ? 19 : 21}
                    strokeWidth={active ? 2.5 : 1.8}
                    className={active ? 'text-white' : 'text-slate-400'}
                  />
                </div>

                {badge > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center leading-none"
                    style={{ boxShadow: '0 1px 4px rgba(220,38,38,0.5)' }}
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>

              <span
                className={clsx(
                  'text-[10px] font-bold transition-all duration-200',
                  active ? 'text-blue-600' : 'text-slate-400',
                )}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
