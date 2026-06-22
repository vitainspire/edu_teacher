'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { Eye, EyeOff, GraduationCap, Zap, Building2, ScanLine, ArrowLeft, UserCheck } from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'

const SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'EVS', 'Computer', 'Physical Education', 'Arts']
const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'hindi',   label: 'हिंदी' },
  { value: 'telugu',  label: 'తెలుగు' },
  { value: 'tamil',   label: 'தமிழ்' },
  { value: 'kannada', label: 'ಕನ್ನಡ' },
]

type Portal = 'select' | 'teacher' | 'scanner'

function setRoleCookie(role: 'teacher' | 'scanner') {
  document.cookie = `edu-role=${role}; path=/; SameSite=Strict; max-age=604800`
}

function setSessionCookie() {
  document.cookie = 'edu-session=1; path=/; SameSite=Strict; max-age=604800'
}

/* ── Portal selector ──────────────────────────────────────────── */
function PortalSelector({ onSelect }: { onSelect: (p: Portal) => void }) {
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

      <div className="space-y-4">
        <button
          onClick={() => onSelect('teacher')}
          className="w-full rounded-3xl overflow-hidden text-left active:scale-[0.98] transition-transform"
          style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)' }}
        >
          <div className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
              <GraduationCap size={26} className="text-white" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-gray-900">Teacher Portal</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Create classes, tests & track progress</p>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </div>
        </button>

        <button
          onClick={() => onSelect('scanner')}
          className="w-full rounded-3xl overflow-hidden text-left active:scale-[0.98] transition-transform"
          style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)' }}
        >
          <div className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg" style={{ background: 'linear-gradient(135deg, #0d1b3e, #1e3a8a)' }}>
              <ScanLine size={26} className="text-blue-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-gray-900">Scanner Staff Portal</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Scan & AI-grade answer papers</p>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </div>
        </button>
      </div>

      <p className="text-center text-blue-200/40 text-xs mt-8 font-medium tracking-wide">by vitainspire</p>
    </div>
  )
}

/* ── Teacher form (unchanged behaviour) ─────────────────────────── */
function TeacherForm({ onBack }: { onBack: () => void }) {
  const { signIn, signUp } = useApp()
  const router = useRouter()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')

  const [name, setName]           = useState('')
  const [school, setSchool]       = useState('')
  const [subject, setSubject]     = useState('Mathematics')
  const [phone, setPhone]         = useState('')
  const [lang, setLang]           = useState('english')
  const [suEmail, setSuEmail]     = useState('')
  const [suPassword, setSuPassword] = useState('')
  const [confirm, setConfirm]     = useState('')

  const handleSignIn = async () => {
    setError('')
    if (!siEmail.trim() || !siPassword) return
    setLoading(true)
    try {
      const { error: err } = await signIn(siEmail.trim(), siPassword)
      if (err) { setError(err); return }
      setRoleCookie('teacher')
      router.replace('/home')
    } catch (e) {
      setError((e as Error).message ?? 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    setError('')
    if (!name.trim())          return setError('Please enter your name.')
    if (!school.trim())        return setError('Please enter your school name.')
    if (!suEmail.trim())       return setError('Please enter your email.')
    if (suPassword.length < 6) return setError('Password must be at least 6 characters.')
    if (suPassword !== confirm) return setError('Passwords do not match.')

    setLoading(true)
    try {
      const { error: err, requiresEmailConfirmation } = await signUp(suEmail.trim(), suPassword, {
        name,
        schoolName: school.trim(),
        subject, grade: '', phone, languagePreference: lang,
      })
      if (err) { setError(err); return }
      if (requiresEmailConfirmation) {
        setSuccess('Account created! Check your inbox and click the confirmation link, then sign in here.')
      } else {
        setSuccess('Account created! Sign in below to continue.')
      }
      setMode('signin')
      setSiEmail(suEmail)
    } catch (e) {
      setError((e as Error).message ?? 'Registration failed.')
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
        <div className="p-3 pb-0">
          <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#f1f5f9' }}>
            {(['signin', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className={clsx('flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200', mode === m ? 'text-white shadow-sm' : 'text-slate-500')}
                style={mode === m ? { background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)', boxShadow: '0 2px 8px rgba(37,99,235,0.45)' } : {}}>
                {m === 'signin' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 pt-4">
          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-2xl">{error}</div>}
          {success && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-3 rounded-2xl">{success}</div>}

          {mode === 'signin' ? (
            <div className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <input type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void handleSignIn()}
                  placeholder="you@school.edu.in" className="input-field" autoFocus />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={siPassword}
                    onChange={e => setSiPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && void handleSignIn()}
                    placeholder="••••••••" className="input-field pr-11" />
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 min-h-0">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button onClick={() => void handleSignIn()} disabled={!siEmail || !siPassword || loading} className="btn-primary w-full mt-2">
                {loading ? <Spinner /> : 'Sign In →'}
              </button>
              <p className="text-center text-sm text-slate-500">No account?{' '}
                <button onClick={() => setMode('signup')} className="font-bold min-h-0" style={{ color: '#1d4ed8' }}>Register free</button>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Full Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunita Sharma" className="input-field" autoFocus />
                </div>
                <div className="col-span-2">
                  <label className="label">School *</label>
                  <div className="relative">
                    <input type="text" value={school} onChange={e => setSchool(e.target.value)} placeholder="e.g. St. Mary's High School" className="input-field pr-9" autoComplete="off" />
                    <Building2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Subject *</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SUBJECTS.map(s => (
                    <button key={s} type="button" onClick={() => setSubject(s)}
                      className={clsx('px-3 py-1.5 rounded-2xl text-xs font-bold border-2 transition-all min-h-0', subject === s ? 'text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-100')}
                      style={subject === s ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', borderColor: 'transparent' } : {}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit" className="input-field" />
                </div>
                <div>
                  <label className="label">Language</label>
                  <select value={lang} onChange={e => setLang(e.target.value)} className="input-field">
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div>
                  <label className="label">Email *</label>
                  <input type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)} placeholder="you@school.edu.in" className="input-field" />
                </div>
                <div>
                  <label className="label">Password * (min 6 chars)</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={suPassword} onChange={e => setSuPassword(e.target.value)} placeholder="••••••••" className="input-field pr-11" />
                    <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 min-h-0">
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirm Password *</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
                    className={clsx('input-field', confirm && confirm !== suPassword ? 'border-red-300 bg-red-50' : '')} />
                </div>
              </div>
              <button onClick={() => void handleSignUp()} disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner /> : 'Create Account →'}
              </button>
              <p className="text-center text-sm text-slate-500">Already registered?{' '}
                <button onClick={() => setMode('signin')} className="font-bold min-h-0" style={{ color: '#1d4ed8' }}>Sign in</button>
              </p>
            </div>
          )}
        </div>
      </div>

      <button onClick={onBack} className="mt-5 w-full flex items-center justify-center gap-2 text-blue-200/60 hover:text-blue-200 text-sm font-medium transition-colors py-2">
        <ArrowLeft size={14} /> Back to portal selection
      </button>
    </div>
  )
}

/* ── Scanner staff form ──────────────────────────────────────────── */
function ScannerForm({ onBack }: { onBack: () => void }) {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // sign-in
  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')

  // sign-up
  const [staffName, setStaffName] = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPassword, setSuPassword] = useState('')

  const handleSignIn = async () => {
    setError('')
    if (!siEmail.trim() || !siPassword) return
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: siEmail.trim(), password: siPassword })
      if (err) { setError(err.message); return }
      setSessionCookie()
      setRoleCookie('scanner')
      router.replace('/scanner/connect')
    } catch (e) {
      setError((e as Error).message ?? 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    setError('')
    if (!staffName.trim()) return setError('Please enter your name.')
    if (!suEmail.trim()) return setError('Please enter your email.')
    if (suPassword.length < 6) return setError('Password must be at least 6 characters.')

    setLoading(true)
    try {
      const { data, error: err } = await supabase.auth.signUp({ email: suEmail.trim(), password: suPassword, options: { data: { name: staffName.trim(), role: 'scanner' } } })
      if (err) { setError(err.message); return }

      // Staff enter the teacher's code on the next screen — no school code needed.
      localStorage.setItem('scanner_staff_name', staffName.trim())

      const needsConfirm = !data.session
      if (needsConfirm) {
        setSuccess('Account created! Check your email and click the confirmation link. Then come back and sign in.')
        setMode('signin')
        setSiEmail(suEmail)
      } else {
        // No email confirmation — register immediately
        setSessionCookie()
        setRoleCookie('scanner')
        router.replace('/scanner/connect')
      }
    } catch (e) {
      setError((e as Error).message ?? 'Registration failed.')
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
        <h1 className="text-3xl font-black text-white tracking-tight">Scanner Staff</h1>
        <p className="text-blue-200 mt-1.5 text-sm font-medium">EduTeach · Answer Sheet Grading</p>
      </div>

      <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)' }}>
        <div className="p-3 pb-0">
          <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#f1f5f9' }}>
            {(['signin', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className={clsx('flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200', mode === m ? 'text-white shadow-sm' : 'text-slate-500')}
                style={mode === m ? { background: 'linear-gradient(135deg, #0d1b3e, #1e3a8a)', boxShadow: '0 2px 8px rgba(13,27,62,0.45)' } : {}}>
                {m === 'signin' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 pt-4">
          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-2xl">{error}</div>}
          {success && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-3 rounded-2xl">{success}</div>}

          {mode === 'signin' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                <UserCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 font-medium">For non-teaching staff only — peons, office staff who scan answer sheets for AI grading.</p>
              </div>
              <div>
                <label className="label">Email Address</label>
                <input type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void handleSignIn()}
                  placeholder="you@school.edu.in" className="input-field" autoFocus />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={siPassword}
                    onChange={e => setSiPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && void handleSignIn()}
                    placeholder="••••••••" className="input-field pr-11" />
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 min-h-0">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button onClick={() => void handleSignIn()} disabled={!siEmail || !siPassword || loading}
                className="w-full min-h-[52px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #0d1b3e, #1e3a8a)', boxShadow: '0 4px 16px rgba(13,27,62,0.5)' }}>
                {loading ? <Spinner /> : 'Sign In →'}
              </button>
              <p className="text-center text-sm text-slate-500">New staff?{' '}
                <button onClick={() => setMode('signup')} className="font-bold min-h-0" style={{ color: '#1e3a8a' }}>Register here</button>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label">Your Full Name *</label>
                <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="e.g. Ramesh Kumar" className="input-field" autoFocus />
                <p className="text-[11px] text-slate-400 mt-1">After signing in, you&apos;ll enter the teacher&apos;s code to load their classes.</p>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div>
                  <label className="label">Email *</label>
                  <input type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)} placeholder="you@school.edu.in" className="input-field" />
                </div>
                <div>
                  <label className="label">Password * (min 6 chars)</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={suPassword} onChange={e => setSuPassword(e.target.value)} placeholder="••••••••" className="input-field pr-11" />
                    <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 min-h-0">
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={() => void handleSignUp()} disabled={loading}
                className="w-full min-h-[52px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #0d1b3e, #1e3a8a)', boxShadow: '0 4px 16px rgba(13,27,62,0.5)' }}>
                {loading ? <Spinner /> : 'Create Account →'}
              </button>
              <p className="text-center text-sm text-slate-500">Already registered?{' '}
                <button onClick={() => setMode('signin')} className="font-bold min-h-0" style={{ color: '#1e3a8a' }}>Sign in</button>
              </p>
            </div>
          )}
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
