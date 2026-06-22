'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import BottomNav from '@/components/nav/BottomNav'
import SideNav from '@/components/nav/SideNav'
import { GraduationCap } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { teacher, isLoading } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !teacher) {
      router.replace('/login')
    }
  }, [teacher, isLoading, router])

  if (isLoading || !teacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <GraduationCap size={32} className="text-white" />
          </div>
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold">Loading EduTeach…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen md:flex" style={{ background: '#f1f5f9' }}>
      <SideNav />
      <div className="flex-1 min-w-0 page-container">
        {children}
        <BottomNav />
      </div>
    </div>
  )
}
