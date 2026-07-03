'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, RotateCcw, BookOpen } from 'lucide-react'
import type { Student, Class, CatchupMaterial } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuizQuestion {
  text: string
  options: string[]
  answerIndex: number
  explanation: string
}
type QuizPhase = 'idle' | 'loading' | 'active' | 'done'
interface QuizState {
  phase: QuizPhase
  topic: string
  subject: string
  questions: QuizQuestion[]
  current: number
  selected: (number | null)[]
  score: number
}

interface SubjectTab {
  classId: string
  studentId: string
  teacherId?: string
  label: string
}

interface PlanRow extends Omit<CatchupMaterial, 'teacherId'> {
  teacherId?: string
  subjectLabel: string
  classId: string
  studentId: string
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BLUE_BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 8, padding: '13px 24px', borderRadius: 14,
  background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
  border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit', width: '100%',
}

const LBL: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: '#94a3b8',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentPlansPage() {
  const router = useRouter()

  const [student,      setStudent]      = useState<Student | null>(null)
  const [cls,          setCls]          = useState<Class | null>(null)
  const [subjects,     setSubjects]     = useState<SubjectTab[]>([])
  const [plans,        setPlans]        = useState<PlanRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)
  const [quiz, setQuiz] = useState<QuizState>({
    phase: 'idle', topic: '', subject: '', questions: [], current: 0, selected: [], score: 0,
  })
  const [showExpl, setShowExpl] = useState(false)

  const initDone   = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // ── Auth + init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    if (!localStorage.getItem('eduteach_student_session')) { router.replace('/student/login'); return }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    try {
      const res = await fetch('/api/student/init')
      if (!res.ok) { router.replace('/student/login'); return }
      const data = await res.json()
      setStudent(data.student)
      setCls(data.primaryClass)

      const tabs: SubjectTab[] = (data.tabs as { classId: string; studentId: string; subject: string; teacherId?: string }[])
        .map(t => ({ classId: t.classId, studentId: t.studentId, teacherId: t.teacherId, label: t.subject }))
      setSubjects(tabs)

      // Fetch catchup materials for all subjects in parallel
      const results = await Promise.all(
        tabs.map(async tab => {
          const params = new URLSearchParams({ classId: tab.classId, studentId: tab.studentId })
          if (tab.teacherId) params.set('teacherId', tab.teacherId)
          const r = await fetch(`/api/student/tab-data?${params}`)
          if (!r.ok) return [] as PlanRow[]
          const d = await r.json()
          return (d.catchupMaterials as CatchupMaterial[])
            .filter(c => c.status !== 'done')
            .map(c => ({ ...c, subjectLabel: tab.label, classId: tab.classId, studentId: tab.studentId, teacherId: tab.teacherId }))
        })
      )

      const allPlans = results.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setPlans(allPlans)
      // Auto-expand the first plan
      if (allPlans[0]) setExpandedIds(new Set([allPlans[0].id]))
    } catch {
      router.replace('/student/login')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('eduteach_student_session')
    document.cookie = 'edu-student-id=; path=/; max-age=0'
    router.replace('/student/login')
  }

  function togglePlan(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────────

  async function startQuiz(topic: string, subject: string) {
    setErrorMsg(null)
    setQuiz({ phase: 'loading', topic, subject, questions: [], current: 0, selected: [], score: 0 })
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const res = await fetch('/api/practice-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, subject, grade: cls?.grade ?? '', interests: student?.interests ?? [] }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Server error (${res.status})`)
      }
      const d = await res.json()
      if (!Array.isArray(d.questions) || d.questions.length === 0)
        throw new Error('No questions returned — please try again.')
      setQuiz({ phase: 'active', topic, subject, questions: d.questions, current: 0,
        selected: new Array(d.questions.length).fill(null), score: 0 })
      setShowExpl(false)
    } catch (err) {
      setQuiz(q => ({ ...q, phase: 'idle' }))
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load quiz. Please try again.')
    }
  }

  function selectAnswer(oi: number) {
    if (quiz.phase !== 'active') return
    const q = quiz.questions[quiz.current]
    if (!q || quiz.selected[quiz.current] !== null) return
    const sel = [...quiz.selected]; sel[quiz.current] = oi
    setQuiz(p => ({ ...p, selected: sel, score: p.score + (oi === q.answerIndex ? 1 : 0) }))
    setShowExpl(true)
  }

  function nextQuestion() {
    const next = quiz.current + 1
    if (next >= quiz.questions.length) setQuiz(q => ({ ...q, phase: 'done' }))
    else { setQuiz(q => ({ ...q, current: next })); setShowExpl(false) }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(
    () => activeFilter === 'all' ? plans : plans.filter(p => p.subjectLabel === activeFilter),
    [plans, activeFilter],
  )

  // ── Loading screen ────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="animate-spin" style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid #bfdbfe', borderTopColor: '#2563eb', margin: '0 auto 12px' }} />
        <p style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500 }}>Loading your plans…</p>
      </div>
    </div>
  )

  if (!student || !cls) return null

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#eff6ff', fontFamily: 'var(--font-jakarta), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>

      {/* ════ TOP BAR ════ */}
      <header style={{ background: '#fff', borderBottom: '2px solid #e0ecff', display: 'flex', alignItems: 'center', padding: '0 28px', height: 68, flexShrink: 0, gap: 16, boxShadow: '0 2px 12px rgba(37,99,235,0.07)' }}>

        {/* Back to home */}
        <button onClick={() => router.push('/student/home')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 20, border: '2px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#64748b', fontFamily: 'inherit', flexShrink: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2563eb'; (e.currentTarget as HTMLButtonElement).style.color = '#2563eb' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}>
          <ArrowLeft size={14} /> Home
        </button>

        <div style={{ width: 1, height: 32, background: '#e2e8f0', flexShrink: 0 }} />

        {/* Page identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #ea580c, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={18} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>Study Plans</p>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {plans.length === 0 ? 'All caught up!' : `${plans.length} plan${plans.length !== 1 ? 's' : ''} from your teacher`}
            </p>
          </div>
        </div>

        {/* Subject filter tabs — only if multiple subjects have plans */}
        {subjects.length > 1 && (
          <>
            <div style={{ width: 1, height: 32, background: '#e2e8f0', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
              {[
                { label: 'All', value: 'all', count: plans.length },
                ...subjects
                  .filter(s => plans.some(p => p.subjectLabel === s.label))
                  .map(s => ({ label: s.label, value: s.label, count: plans.filter(p => p.subjectLabel === s.label).length })),
              ].map(tab => {
                const isAct = activeFilter === tab.value
                return (
                  <button key={tab.value} onClick={() => setActiveFilter(tab.value)}
                    style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 24, border: isAct ? 'none' : '2px solid #e2e8f0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, transition: 'all .15s', background: isAct ? 'linear-gradient(135deg, #ea580c, #d97706)' : '#f8fafc', color: isAct ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', gap: 6, boxShadow: isAct ? '0 2px 8px rgba(234,88,12,.25)' : 'none' }}>
                    {tab.label}
                    {tab.count > 0 && (
                      <span style={{ background: isAct ? 'rgba(255,255,255,.25)' : '#e2e8f0', color: isAct ? '#fff' : '#64748b', borderRadius: 10, padding: '1px 6px', fontSize: 10.5, fontWeight: 900 }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Profile + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>
              {(student.name?.trim()?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{student.name}</p>
              <p style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>Gr {cls.grade}{cls.section ?? ''}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#94a3b8', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#fca5a5' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0' }}>
            Sign out
          </button>
        </div>
      </header>

      {/* ════ MAIN CONTENT ════ */}
      <div ref={contentRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '28px 36px 60px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Error toast */}
          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 14, background: '#fef2f2', border: '1.5px solid #fca5a5' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#991b1b', lineHeight: 1.5 }}>{errorMsg}</p>
              <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 18, lineHeight: 1, padding: 0, fontFamily: 'inherit' }}>✕</button>
            </div>
          )}

          {/* ── QUIZ (shown when active) ── */}
          {quiz.phase !== 'idle' && (
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, flex: 1 }}>Quiz — {quiz.topic}</span>
                {quiz.phase === 'active' && (
                  <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.15)', padding: '3px 12px', borderRadius: 20 }}>
                    {quiz.current + 1} / {quiz.questions.length}
                  </span>
                )}
                <button onClick={() => setQuiz(q => ({ ...q, phase: 'idle' }))}
                  style={{ background: 'rgba(255,255,255,.15)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 8, fontFamily: 'inherit' }}>
                  ✕ Exit
                </button>
              </div>

              <div style={{ padding: '24px 24px' }}>
                {quiz.phase === 'loading' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: '#2563eb' }} />
                    <p style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>Preparing your questions…</p>
                  </div>
                )}

                {quiz.phase === 'active' && quiz.questions[quiz.current] && (() => {
                  const q   = quiz.questions[quiz.current]
                  const sel = quiz.selected[quiz.current]
                  const answered = sel !== null
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <p style={{ fontWeight: 700, color: '#1e293b', fontSize: 16, lineHeight: 1.7 }}>{q.text}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {q.options.map((opt, oi) => {
                          let bg = '#f8fafc', border = '#e2e8f0', col = '#475569'
                          if (answered) {
                            if (oi === q.answerIndex)           { bg = '#ecfdf5'; border = '#6ee7b7'; col = '#065f46' }
                            else if (oi === sel)                { bg = '#fef2f2'; border = '#fca5a5'; col = '#991b1b' }
                            else                                { col = '#cbd5e1' }
                          }
                          return (
                            <button key={oi} onClick={() => !answered && selectAnswer(oi)} disabled={answered}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderRadius: 14, border: `2px solid ${border}`, background: bg, color: col, fontSize: 14, fontWeight: 600, textAlign: 'left', cursor: answered ? 'default' : 'pointer', transition: 'all .12s', fontFamily: 'inherit' }}>
                              <span style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0, ...(answered && oi === q.answerIndex ? { background: '#059669', borderColor: '#059669', color: '#fff' } : {}), ...(answered && oi === sel && oi !== q.answerIndex ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff' } : {}) }}>
                                {String.fromCharCode(65 + oi)}
                              </span>
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                      {showExpl && (
                        <div style={{ borderRadius: 14, padding: '14px 18px', background: sel === q.answerIndex ? '#ecfdf5' : '#fef2f2', border: `1px solid ${sel === q.answerIndex ? '#a7f3d0' : '#fca5a5'}` }}>
                          <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 5, color: sel === q.answerIndex ? '#065f46' : '#991b1b' }}>
                            {sel === q.answerIndex ? '✓ Correct!' : '✗ Incorrect'}
                          </p>
                          <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7 }}>{q.explanation}</p>
                        </div>
                      )}
                      {answered && (
                        <button onClick={nextQuestion} style={{ ...BLUE_BTN, width: 'auto', alignSelf: 'flex-start', padding: '11px 28px' }}>
                          {quiz.current + 1 < quiz.questions.length ? 'Next Question →' : 'See Results'}
                        </button>
                      )}
                    </div>
                  )
                })()}

                {quiz.phase === 'done' && (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <p style={{ fontSize: 60 }}>{quiz.score === quiz.questions.length ? '🎉' : quiz.score >= quiz.questions.length / 2 ? '👍' : '💪'}</p>
                    <p style={{ fontSize: 40, fontWeight: 900, color: '#1e293b', marginTop: 12, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{quiz.score}/{quiz.questions.length}</p>
                    <p style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>
                      {quiz.score === quiz.questions.length ? 'Perfect! Every answer correct.' : quiz.score >= quiz.questions.length / 2 ? 'Good effort! Keep practising.' : "Keep going — you'll get there!"}
                    </p>
                    <button onClick={() => setQuiz(q => ({ ...q, phase: 'idle' }))}
                      style={{ marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 14, background: '#f1f5f9', border: 'none', fontSize: 14, fontWeight: 700, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <RotateCcw size={14} /> Back to plans
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EMPTY STATE ── */}
          {quiz.phase === 'idle' && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center', background: '#fff', borderRadius: 24 }}>
              <span style={{ fontSize: 64 }}>🎉</span>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 18 }}>All caught up!</p>
              <p style={{ fontSize: 15, color: '#64748b', marginTop: 8, lineHeight: 1.7, maxWidth: 360 }}>
                {activeFilter === 'all'
                  ? 'No study plans right now. Keep attending classes and doing your best!'
                  : `No plans for ${activeFilter} right now.`}
              </p>
              <button onClick={() => router.push('/student/home')}
                style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 30px', borderRadius: 14, background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <ArrowLeft size={15} /> Back to Home
              </button>
            </div>
          )}

          {/* ── PLANS LIST ── */}
          {quiz.phase === 'idle' && filtered.map(plan => {
            const isOpen = expandedIds.has(plan.id)
            return (
              <div key={plan.id} style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>

                {/* Header row — click to expand */}
                <div
                  onClick={() => togglePlan(plan.id)}
                  role="button"
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', cursor: 'pointer', background: isOpen ? '#f8fafc' : '#fff', transition: 'background .12s' }}>

                  <div style={{ width: 50, height: 50, borderRadius: 14, background: plan.reason === 'absent' ? '#fff7ed' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                    {plan.reason === 'absent' ? '🏫' : '📉'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 800 }}>{plan.subjectLabel}</span>
                      <span style={{ padding: '3px 10px', borderRadius: 20, background: plan.reason === 'absent' ? '#fff7ed' : '#fef2f2', color: plan.reason === 'absent' ? '#d97706' : '#dc2626', fontSize: 11, fontWeight: 700 }}>
                        {plan.reason === 'absent' ? 'Missed class' : 'Low score'}
                      </span>
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{plan.topic}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      Added {new Date(plan.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); startQuiz(plan.topic, plan.subjectLabel) }}
                      style={{ padding: '9px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      Practice Quiz
                    </button>
                    <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 700, transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform .2s', userSelect: 'none' }}>▾</span>
                  </div>
                </div>

                {/* Expanded plan content */}
                {isOpen && (
                  <div style={{ padding: '4px 24px 26px', display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid #f1f5f9' }}>

                    {plan.subject && plan.subjectLabel !== plan.subject && null}

                    {/* Interests personalisation note */}
                    {student?.interests && student.interests.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', marginTop: 12 }}>
                        <span style={{ fontSize: 18 }}>✨</span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                          Personalised using your interests:{' '}
                          <span style={{ color: '#d97706' }}>{student.interests.slice(0, 3).join(', ')}</span>
                        </p>
                      </div>
                    )}

                    {/* Explanation */}
                    {plan.explanation && (
                      <div style={{ padding: '20px 22px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <p style={{ ...LBL, marginBottom: 12 }}>📖 Explanation</p>
                        <p style={{ fontSize: 15, color: '#334155', lineHeight: 1.9 }}>{plan.explanation}</p>
                      </div>
                    )}

                    {/* Practice questions */}
                    {plan.practiceQuestions?.length > 0 && (
                      <div>
                        <p style={{ ...LBL, marginBottom: 12 }}>✏️ Practice Questions</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {plan.practiceQuestions.map((q, qi) => (
                            <div key={qi} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }}>
                              <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{qi + 1}</span>
                              <p style={{ fontSize: 14.5, color: '#334155', lineHeight: 1.8 }}>{q}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Activity from teacher */}
                    {plan.activity && (
                      <div style={{ padding: '18px 20px', borderRadius: 16, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                        <p style={{ ...LBL, color: '#059669', marginBottom: 10 }}>🎯 Activity from Teacher</p>
                        <p style={{ fontSize: 15, color: '#065f46', lineHeight: 1.8 }}>{plan.activity}</p>
                      </div>
                    )}

                    {/* Focus note */}
                    {plan.focusNote && (
                      <div style={{ padding: '14px 18px', borderRadius: 14, background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                        <p style={{ fontSize: 14.5, color: '#7c3aed', fontWeight: 600, fontStyle: 'italic', lineHeight: 1.75 }}>💡 {plan.focusNote}</p>
                      </div>
                    )}

                    <button onClick={() => startQuiz(plan.topic, plan.subjectLabel)} style={BLUE_BTN}>
                      Start Practice Quiz for {plan.topic} →
                    </button>
                  </div>
                )}
              </div>
            )
          })}

        </div>
      </div>
    </div>
  )
}
