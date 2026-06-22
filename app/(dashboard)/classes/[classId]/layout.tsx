'use client'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, CalendarCheck, PenLine, BookOpen, Activity } from 'lucide-react'
import { useApp } from '@/lib/context'
import clsx from 'clsx'

const TABS = [
  { label: 'Students',   Icon: Users,         path: 'students' },
  { label: 'Attendance', Icon: CalendarCheck,  path: 'attendance' },
  { label: 'Marks',      Icon: PenLine,        path: 'marks' },
  { label: 'Syllabus',   Icon: BookOpen,       path: 'syllabus' },
  { label: 'Class Report',      Icon: Activity,       path: 'pulse' },
]

const CLASS_GRADIENTS_STYLE = [
  'linear-gradient(145deg, #04091e 0%, #0e1a4a 30%, #1a237e 65%, #283593 100%)',
  'linear-gradient(145deg, #042f2e 0%, #064e3b 35%, #065f46 65%, #047857 100%)',
  'linear-gradient(145deg, #04091e 0%, #091836 30%, #0e2358 60%, #1338b0 100%)',
  'linear-gradient(145deg, #3b0000 0%, #7f1d1d 35%, #991b1b 65%, #b91c1c 100%)',
  'linear-gradient(145deg, #431407 0%, #7c2d12 35%, #9a3412 65%, #c2410c 100%)',
]

export default function ClassLayout({ children }: { children: React.ReactNode }) {
  const { classId } = useParams() as { classId: string }
  const pathname = usePathname()
  const router = useRouter()
  const { classes, students } = useApp()

  const clsIndex  = classes.findIndex(c => c.id === classId)
  const cls       = clsIndex >= 0 ? classes[clsIndex] : undefined
  const gradientStyle = CLASS_GRADIENTS_STYLE[clsIndex >= 0 ? clsIndex % CLASS_GRADIENTS_STYLE.length : 0]
  const studentCount = students.filter(s => s.classId === classId && s.isActive).length

  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-20" style={{ background: gradientStyle }}>
        {/* Back + class info */}
        <div className="px-4 pt-5 pb-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/classes')}
            className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white/20 flex-shrink-0 active:bg-white/30 transition-colors"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-white leading-tight truncate">
              {cls?.name ?? 'Class'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/60 text-xs font-medium">Grade {cls?.grade ?? '?'}</span>
              {cls?.section && <span className="text-white/40 text-xs">·</span>}
              {cls?.section && <span className="text-white/60 text-xs">Sec {cls.section}</span>}
              <span className="text-white/40 text-xs">·</span>
              <span className="text-white/60 text-xs flex items-center gap-1">
                <Users size={10} /> {studentCount}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable tab bar */}
        <div className="flex overflow-x-auto no-scrollbar border-t border-white/10">
          {TABS.map(tab => {
            const tabPath = `/classes/${classId}/${tab.path}`
            const active  = pathname === tabPath || pathname.startsWith(tabPath + '/')
            return (
              <Link
                key={tab.path}
                href={tabPath}
                className={clsx(
                  'flex-shrink-0 flex flex-col items-center gap-1 px-5 py-3 text-xs font-semibold transition-all border-b-2',
                  active
                    ? 'text-white border-white bg-white/10'
                    : 'text-white/50 border-transparent hover:text-white/70',
                )}
              >
                <tab.Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="pb-28">{children}</div>
    </div>
  )
}
