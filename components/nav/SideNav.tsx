'use client'
import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Home, LayoutGrid, Bell, GraduationCap, LogOut, Settings2, PenLine, BookOpen } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/lib/context'
import { computeHomeAlerts } from '@/lib/logic/home-alerts'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/home',     label: 'Home',     Icon: Home },
  { href: '/today',    label: 'Today',    Icon: BookOpen },
  { href: '/classes',  label: 'Classes',  Icon: LayoutGrid },
  { href: '/tests',    label: 'Tests',    Icon: PenLine },
  { href: '/alerts',   label: 'Alerts',   Icon: Bell },
  { href: '/settings', label: 'Settings', Icon: Settings2 },
]

export default function SideNav() {
  const path = usePathname()
  const router = useRouter()
  const { teacher, classes, sessions, students, tests, marks, getStudentWarnings, logout } = useApp()

  const alertCount = useMemo(
    () => computeHomeAlerts(classes, sessions, students, getStudentWarnings).length,
    [classes, sessions, students, getStudentWarnings],
  )

  // Tests where marks have not been fully entered yet
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

  const handleLogout = async () => { await logout(); router.replace('/login') }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0 overflow-y-auto bg-white border-r border-slate-100"
      style={{ boxShadow: '1px 0 0 #f1f5f9' }}>

      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-100">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #07153a 0%, #1d4ed8 100%)' }}>
          <GraduationCap size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-black text-slate-900 text-base leading-none">EduTeach</p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">{teacher?.schoolName ?? ''}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active      = path === href || path.startsWith(href + '/')
          const isAlerts    = href === '/alerts'
          const isTests     = href === '/tests'
          const badge       = isAlerts ? alertCount : isTests ? pendingTestCount : 0

          return (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left',
                active ? 'text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
              )}
              style={active ? {
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                boxShadow: '0 2px 12px rgba(37,99,235,0.3)',
              } : {}}
            >
              <div className="relative shrink-0">
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center leading-none"
                    style={{ boxShadow: '0 1px 3px rgba(220,38,38,0.5)' }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
              {badge > 0 && !active && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
            {teacher?.name?.[0]?.toUpperCase() ?? 'T'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{teacher?.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{teacher?.subject}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  )
}
