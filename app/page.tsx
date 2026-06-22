'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { GraduationCap } from 'lucide-react'

export default function Root() {
  const { teacher, isLoading } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      router.replace(teacher ? '/home' : '/login')
    }
  }, [teacher, isLoading, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <GraduationCap size={32} className="text-white" />
        </div>
        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto" style={{ borderWidth: 3 }} />
      </div>
    </div>
  )
}
