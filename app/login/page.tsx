'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { Eye, EyeOff, GraduationCap, Zap, ScanLine, ArrowLeft, UserCheck, BookOpen, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'


type Portal = 'select' | 'teacher' | 'scanner' | 'student'

function setRoleCookie(role: 'teacher' | 'scanner') {
  document.cookie = `edu-role=${role}; path=/; SameSite=Strict; max-age=604800`
}

function setSessionCookie() {
  document.cookie = 'edu-session=1; path=/; SameSite=Strict; max-age=604800'
}

/* ── Portal selector ──────────────────────────────────────────── */
function PortalSelector({ onSelect }: { onSelect: (p: Portal) => void }) {
  const router = useRouter()

  const portals = [
    {
      label: 'Admin Portal',
      desc: 'School & timetable',
      icon: <Shield size={28} className="text-white" />,
      gradient: 'linear-gradient(135deg, #312e81, #4338ca)',
      glow: 'rgba(67,56,202,0.6)',
      onClick: () => router.push('/admin/login'),
    },
    {
      label: 'Teacher Portal',
      desc: 'Classes & AI tools',
      icon: <GraduationCap size={28} className="text-white" strokeWidth={1.8} />,
      gradient: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
      glow: 'rgba(37,99,235,0.6)',
      onClick: () => onSelect('teacher'),
    },
    {
      label: 'Student Portal',
      desc: 'Progress & plans',
      icon: <BookOpen size={28} className="text-white" />,
      gradient: 'linear-gradient(135deg, #059669, #10b981)',
      glow: 'rgba(5,150,105,0.5)',
      onClick: () => router.push('/student/login'),
    },
    {
      label: 'Scanner Staff',
      desc: 'Scan & grade papers',
      icon: <ScanLine size={28} className="text-blue-300" />,
      gradient: 'linear-gradient(135deg, #0d1b3e, #1e3a8a)',
      glow: 'rgba(30,58,138,0.6)',
      onClick: () => onSelect('scanner'),
    },
  ]

  return (
    <div className="w-full max-w-sm relative z-10">
      <div className="text-center mb-8">
        <div className="relative inline-block mb-5">
          <div className="absolute inset-0 rounded-3xl blur-xl" style={{ background: 'rgba(37,99,235,0.55)', transform: 'scale(1.3)' }} />
          <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-2xl" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}>
            <GraduationCap size={38} className="text-white" strokeWidth={1.8} />
          </div>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight leading-none">EduTeach</h1>
        <p className="text-blue-200 mt-2 text-sm font-medium">AI Companion for Schools</p>
        <div className="flex items-center justify-center mt-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/70" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <Zap size={10} /> AI Powered
          </div>
        </div>
      </div>

      <p className="text-center text-blue-200/70 text-sm font-semibold mb-5 tracking-wide">Select your portal to continue</p>

      <div className="grid grid-cols-2 gap-3">
        {portals.map((p) => (
          <button
            key={p.label}
            onClick={p.onClick}
            className="rounded-3xl overflow-hidden active:scale-[0.96] transition-transform text-center"
            style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)' }}
          >
            <div className="p-5 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-lg" style={{ background: p.glow, transform: 'scale(1.2)' }} />
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: p.gradient }}>
                  {p.icon}
                </div>
              </div>
              <div>
                <p className="text-sm font-black text-gray-900 leading-snug">{p.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium leading-tight">{p.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-center text-blue-200/40 text-xs mt-8 font-medium tracking-wide">by vitainspire</p>
    </div>
  )
}

/* ── Teacher form — sign in only (accounts created by admin) ────── */
function TeacherForm({ onBack }: { onBack: () => void }) {
  const { signIn } = useApp()
  const router = useRouter()

  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSignIn = async () => {
    setError('')
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      const { error: err } = await signIn(email.trim(), password)
      if (err) { setError(err); return }
      setRoleCookie('teacher')
      router.replace('/home')
    } catch (e) {
      setError((e as Error).message ?? 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm relative z-10">
      <div className="text-center mb-6">
        <div className="relative inline-block mb-4">
          <div className="absolute inset-0 rounded-3xl blur-xl" style={{ background: 'rgba(37,99,235,0.55)', transform: 'scale(1.3)' }} />
          <div className="relative w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-2xl" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}>
            <GraduationCap size={30} className="text-white" strokeWidth={1.8} />
          </div>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Teacher Portal</h1>
        <p className="text-blue-200 mt-1.5 text-sm font-medium">EduTeach · AI Companion</p>
      </div>

      <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)' }}>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-2xl">{error}</div>}

          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <UserCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 font-medium">Your account is created by your school admin. Use the credentials they gave you.</p>
          </div>

          <div>
            <label className="label">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSignIn()}
              placeholder="you@school.edu.in" className="input-field" autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void handleSignIn()}
                placeholder="••••••••" className="input-field pr-11" />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 min-h-0">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button onClick={() => void handleSignIn()} disabled={!email || !password || loading} className="btn-primary w-full mt-2">
            {loading ? <Spinner /> : 'Sign In →'}
          </button>
        </div>
      </div>

      <button onClick={onBack} className="mt-5 w-full flex items-center justify-center gap-2 text-blue-200/60 hover:text-blue-200 text-sm font-medium transition-colors py-2">
        <ArrowLeft size={14} /> Back to portal selection
      </button>
    </div>
  )
}

/* ── Scanner staff form — sign in only (account created by admin) ── */
function ScannerForm({ onBack }: { onBack: () => void }) {
  const router  = useRouter()
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [email,   setEmail]   = useState('')
  const [password, setPassword] = useState('')

  const handleSignIn = async () => {
    setError('')
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authErr) { setError(authErr.message); return }

      // Fetch the scanner profile to get school_id — admin must have created this
      const res = await fetch('/api/scanner/profile')
      if (!res.ok) {
        const d = await res.json()
        await supabase.auth.signOut()
        setError(d.error ?? 'No scanner account found. Ask your school admin.')
        return
      }

      const profile = await res.json()
      // Store school in localStorage so the connect page can use it immediately
      localStorage.setItem('scanner_school_id',   profile.schoolId)
      localStorage.setItem('scanner_school_name', profile.schoolName)

      setSessionCookie()
      setRoleCookie('scanner')
      router.replace('/scanner/connect')
    } catch (e) {
      setError((e as Error).message ?? 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm relative z-10">
      <div className="text-center mb-6">
        <div className="relative inline-block mb-4">
          <div className="absolute inset-0 rounded-3xl blur-xl" style={{ background: 'rgba(13,27,62,0.8)', transform: 'scale(1.3)' }} />
          <div className="relative w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-2xl" style={{ background: 'linear-gradient(135deg, #0d1b3e, #1e3a8a)' }}>
            <ScanLine size={30} className="text-blue-300" />
          </div>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Scanner Portal</h1>
        <p className="text-blue-200 mt-1.5 text-sm font-medium">EduTeach · Answer Sheet Grading</p>
      </div>

      <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)' }}>
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-2xl">
              {error}
            </div>
          )}

          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <UserCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 font-medium">
              Your account is created by your school admin. Use the credentials they gave you.
            </p>
          </div>

          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSignIn()}
              placeholder="you@school.edu.in"
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void handleSignIn()}
                placeholder="••••••••"
                className="input-field pr-11"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 min-h-0">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            onClick={() => void handleSignIn()}
            disabled={!email || !password || loading}
            className="w-full min-h-[52px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0d1b3e, #1e3a8a)', boxShadow: '0 4px 16px rgba(13,27,62,0.5)' }}
          >
            {loading ? <Spinner /> : 'Sign In →'}
          </button>
        </div>
      </div>

      <button onClick={onBack} className="mt-5 w-full flex items-center justify-center gap-2 text-blue-200/60 hover:text-blue-200 text-sm font-medium transition-colors py-2">
        <ArrowLeft size={14} /> Back to portal selection
      </button>
    </div>
  )
}

/* ── Root page ──────────────────────────────────────────────────── */
export default function LoginPage() {
  const [portal, setPortal] = useState<Portal>('select')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ background: '#07153a' }}>
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, #07153a 0%, #0d2260 55%, #112e7a 100%)' }} />
      <div className="absolute pointer-events-none" style={{ top: '-140px', right: '-100px', width: '480px', height: '480px', background: 'radial-gradient(circle, rgba(37,99,235,0.6) 0%, transparent 65%)', filter: 'blur(64px)' }} />
      <div className="absolute pointer-events-none" style={{ bottom: '-120px', left: '-100px', width: '420px', height: '420px', background: 'radial-gradient(circle, rgba(29,78,216,0.5) 0%, transparent 65%)', filter: 'blur(56px)' }} />
      <div className="absolute pointer-events-none" style={{ top: '38%', left: '-60px', width: '220px', height: '220px', background: 'radial-gradient(circle, rgba(56,189,248,0.22) 0%, transparent 70%)', filter: 'blur(36px)' }} />
      <div className="absolute pointer-events-none" style={{ top: '60px', left: '40px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)', filter: 'blur(24px)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="absolute pointer-events-none" style={{ top: '-120px', right: '-120px', width: '560px', height: '560px', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '50%' }} />
      <div className="absolute pointer-events-none" style={{ bottom: '-160px', left: '-160px', width: '440px', height: '440px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '50%' }} />
      <div className="absolute pointer-events-none" style={{ top: '-40px', right: '-40px', width: '300px', height: '300px', border: '1px solid rgba(59,130,246,0.18)', borderRadius: '50%' }} />

      {portal === 'select' && <PortalSelector onSelect={setPortal} />}
      {portal === 'teacher' && <TeacherForm onBack={() => setPortal('select')} />}
      {portal === 'scanner' && <ScannerForm onBack={() => setPortal('select')} />}
    </div>
  )
}

function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      Please wait…
    </span>
  )
}
