'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, LogIn } from 'lucide-react'

export default function StudentLoginPage() {
  const router = useRouter()
  const [classCode, setClassCode]   = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const handleLogin = async () => {
    setError('')
    if (!classCode.trim() || !rollNumber.trim()) {
      setError('Please enter your class code and roll number.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode: classCode.trim(), rollNumber: rollNumber.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed. Please try again.')
        return
      }
      localStorage.setItem('eduteach_student_session', JSON.stringify(data))
      router.push('/student/home')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #1e3a8a 0%, #1e40af 40%, #1d4ed8 100%)' }}>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center">
          <BookOpen size={24} className="text-white" />
        </div>
        <div>
          <p className="text-white font-black text-xl leading-none">EduTeach</p>
          <p className="text-blue-300 text-xs font-semibold mt-0.5">Student Portal</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Welcome!</h1>
          <p className="text-sm text-slate-400 mt-1">Enter your class code and roll number to continue</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
              Class Code
            </label>
            <input
              type="text"
              value={classCode}
              onChange={e => setClassCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="e.g. ABC123"
              maxLength={8}
              className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-bold text-lg tracking-widest uppercase focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-slate-400 mt-1">Ask your teacher for this code</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
              Roll Number
            </label>
            <input
              type="text"
              value={rollNumber}
              onChange={e => setRollNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="e.g. 01"
              className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-bold text-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 text-white active:scale-95 transition-all disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}
        >
          {loading
            ? <span className="animate-pulse">Signing in…</span>
            : <><LogIn size={18} /> Sign In</>
          }
        </button>
      </div>

      <p className="text-blue-300/60 text-xs mt-8 text-center">
        Government School Learning Platform
      </p>
    </div>
  )
}
