'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AdminProvider } from '@/lib/admin-context'
import AdminSideNav from '@/components/admin/AdminSideNav'
import { Loader2 } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/admin/login'); return }
      const role = document.cookie.split('; ').find(r => r.startsWith('edu-role='))?.split('=')[1]
      if (role !== 'admin') { router.replace('/login'); return }
      setReady(true)
    })
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f1f5f9' }}>
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <AdminProvider>
      <div className="min-h-screen md:flex" style={{ background: '#f8fafc' }}>
        <AdminSideNav />
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </AdminProvider>
  )
}
