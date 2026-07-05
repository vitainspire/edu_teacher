'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { GraduationCap, BookOpen, ScanLine, ShieldCheck } from 'lucide-react'

const PORTALS = [
  {
    label: 'Admin Portal',
    desc: 'School & timetable',
    href: '/admin/login',
    icon: ShieldCheck,
    gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
    glow: 'rgba(99,102,241,0.35)',
    badge: 'Desktop',
  },
  {
    label: 'Teacher Portal',
    desc: 'Classes & AI tools',
    href: '/login',
    icon: GraduationCap,
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
    glow: 'rgba(37,99,235,0.35)',
    badge: 'Mobile & Desktop',
  },
  {
    label: 'Student Portal',
    desc: 'Progress & plans',
    href: '/student/login',
    icon: BookOpen,
    gradient: 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
    glow: 'rgba(5,150,105,0.35)',
    badge: 'Mobile & Desktop',
  },
  {
    label: 'Scanner Staff',
    desc: 'Scan & grade papers',
    href: '/scanner',
    icon: ScanLine,
    gradient: 'linear-gradient(135deg, #1c1917 0%, #374151 100%)',
    glow: 'rgba(55,65,81,0.35)',
    badge: 'Mobile',
  },
]

export default function PortalsPage() {
  const { teacher, isLoading } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && teacher) router.replace('/home')
  }, [teacher, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (teacher) return null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>

      {/* Brand */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)', boxShadow: '0 8px 32px rgba(79,70,229,0.45)' }}>
          <GraduationCap size={30} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">EduTeach</h1>
        <p className="text-white/40 text-sm font-medium mt-1">Select your portal to continue</p>
      </div>

      {/* 2×2 portal grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {PORTALS.map(({ label, desc, href, icon: Icon, gradient, glow, badge }) => (
          <button
            key={label}
            onClick={() => router.push(href)}
            className="relative flex flex-col items-start p-4 rounded-3xl text-left transition-all active:scale-95 hover:scale-[1.02]"
            style={{ background: gradient, boxShadow: `0 8px 28px ${glow}`, cursor: 'pointer' }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Icon size={20} className="text-white" strokeWidth={2} />
            </div>
            <p className="text-[13px] font-black text-white leading-tight mb-1">{label}</p>
            <p className="text-[11px] text-white/55 leading-snug mb-3">{desc}</p>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
              {badge}
            </span>
          </button>
        ))}
      </div>

      <p className="text-white/20 text-xs mt-8 text-center">by vitainspire</p>
    </div>
  )
}
