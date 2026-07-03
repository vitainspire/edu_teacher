'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, LogOut, Loader2, CheckCircle2, RotateCcw, CalendarClock, Pencil, X, Check as CheckIcon } from 'lucide-react'
import type {
  Student, TopicMastery, Mark, Attendance, CatchupMaterial,
  Class, Session, SyllabusTopic, TimetableEntry, TopicPoll, Test,
} from '@/lib/types'

// ── Badge definitions ─────────────────────────────────────────────────────────

interface BadgeDef {
  id: string
  icon: string
  name: string
  description: string
  hint: string
  color: string
  bg: string
  border: string
}

const BADGE_DEFS: BadgeDef[] = [
  { id: 'perfect',      icon: '⭐', name: 'Perfect Score',    description: 'Scored 100% on a test',             hint: 'Score full marks on any test',              color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 'sharpshooter', icon: '🎯', name: 'Sharpshooter',    description: 'Scored 90%+ on a test',             hint: 'Score 90% or above on any test',            color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { id: 'streak3',      icon: '🔥', name: 'Hat-Trick',       description: 'Attended 3 classes in a row',       hint: 'Attend 3 classes without missing one',      color: '#ea580c', bg: '#fff7ed', border: '#fde68a' },
  { id: 'streak7',      icon: '🔥🔥', name: 'Week Warrior', description: 'Attended 7 classes in a row',       hint: 'Attend 7 classes in a row',                 color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { id: 'attendance',   icon: '📅', name: 'Attendance Star', description: 'Over 90% overall attendance',      hint: 'Keep attendance above 90%',                 color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'improving',    icon: '📈', name: 'On the Rise',     description: 'Improved since last test',          hint: 'Score higher than your previous test',      color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'noweakspot',   icon: '💪', name: 'All Rounder',     description: 'No weak topics — all 60%+',         hint: 'Get 60%+ mastery in all tested topics',     color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  { id: 'topicmaster',  icon: '🏆', name: 'Topic Master',    description: '80%+ mastery in a topic',           hint: 'Reach 80%+ mastery in any topic',           color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
  { id: 'halfway',      icon: '🎓', name: 'Halfway Hero',    description: 'Completed 50% of the syllabus',    hint: 'Complete at least half the syllabus',       color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
  { id: 'comeback',     icon: '🚀', name: 'Comeback Kid',    description: 'Bounced back from a low score',    hint: 'Score above 60% after scoring below 50%',   color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
]

function computeAllBadges(data: SubjectData): (BadgeDef & { earned: boolean })[] {
  const marks = data.recentMarks
  return BADGE_DEFS.map(def => {
    let earned = false
    switch (def.id) {
      case 'perfect':
        earned = marks.some(m => m.totalMarks > 0 && m.score === m.totalMarks)
        break
      case 'sharpshooter':
        earned = marks.some(m => m.totalMarks > 0 && m.score / m.totalMarks >= 0.9)
        break
      case 'streak3':
        earned = data.attendanceStreak >= 3
        break
      case 'streak7':
        earned = data.attendanceStreak >= 7
        break
      case 'attendance':
        earned = data.attendanceRate >= 0.9
        break
      case 'improving':
        if (marks.length >= 2 && marks[0].totalMarks > 0 && marks[1].totalMarks > 0)
          earned = (marks[0].score / marks[0].totalMarks) > (marks[1].score / marks[1].totalMarks)
        break
      case 'noweakspot':
        earned = data.weakTopics.length === 0 && marks.length > 0
        break
      case 'topicmaster':
        earned = data.strongTopics.some(t => t.mastery >= 0.8)
        break
      case 'halfway':
        earned = data.syllabusTopics.length > 0 &&
          data.syllabusTopics.filter(t => t.isCompleted).length / data.syllabusTopics.length >= 0.5
        break
      case 'comeback': {
        if (marks.length >= 2 && marks[0].totalMarks > 0 && marks[1].totalMarks > 0) {
          const prev = marks[1].score / marks[1].totalMarks
          const curr = marks[0].score / marks[0].totalMarks
          earned = prev < 0.5 && curr >= 0.6
        }
        break
      }
    }
    return { ...def, earned }
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubjectTab {
  classId: string
  studentId: string
  teacherId?: string
  label: string
  color: string
}

interface UpcomingTest {
  id: string
  topic: string
  conductedOn: string
  totalMarks: number
  subject: string
}

interface SubjectData {
  attendanceRate: number
  totalSessions: number
  presentCount: number
  attendanceStreak: number
  recentMarks: (Mark & { topic: string; totalMarks: number; conductedOn: string })[]
  weakTopics: TopicMastery[]
  strongTopics: TopicMastery[]
  catchupPlans: CatchupMaterial[]
  syllabusTopics: SyllabusTopic[]
  timetable: TimetableEntry[]
  polls: TopicPoll[]
  upcomingTests: UpcomingTest[]
}

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
  questions: QuizQuestion[]
  current: number
  selected: (number | null)[]
  score: number
}

type PriorityState = 'catchup' | 'practice' | 'poll' | 'good'

// ── Constants ─────────────────────────────────────────────────────────────────

const TAB_COLORS = ['#4f46e5','#059669','#dc2626','#d97706','#0891b2','#7c3aed','#e11d48']

const PRESET_INTERESTS = [
  '🏏 Cricket', '⚽ Football', '🏀 Basketball', '🏸 Badminton',
  '🎵 Music', '🎨 Drawing', '💃 Dance', '🎬 Movies',
  '🍳 Cooking', '📚 Reading', '🚀 Space', '🌿 Nature',
  '🐾 Animals', '🎮 Gaming', '🤖 Robots', '🧩 Puzzles',
]

const PS_COLOR: Record<PriorityState, string> = {
  catchup:  '#d97706',
  practice: '#dc2626',
  poll:     '#2563eb',
  good:     '#059669',
}

const PS_BORDER: Record<PriorityState, string> = {
  catchup:  '#fde68a',
  practice: '#fecaca',
  poll:     '#bfdbfe',
  good:     '#a7f3d0',
}

const FOCUS_TAG: Record<PriorityState, string> = {
  catchup:  '🏫 Missed Class',
  practice: '📝 Needs Practice',
  poll:     '🧠 Quick Check-In',
  good:     '🎯 On Track',
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 24,
  border: '1px solid #f1f5f9',
  boxShadow: '0 2px 24px rgba(15,23,42,0.07)',
  padding: '20px 22px',
  display: 'flex', flexDirection: 'column', gap: 12,
}

const LBL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: '#94a3b8',
}

const BLUE_BTN: React.CSSProperties = {
  width: '100%', padding: '12px 20px', borderRadius: 14,
  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
  boxShadow: '0 3px 12px rgba(37,99,235,0.35)',
  border: 'none', fontSize: 13.5, fontWeight: 800,
  color: '#fff', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function formatTestDate(dateStr: string): string {
  const d = daysUntil(dateStr)
  if (d === 0) return 'Today!'
  if (d === 1) return 'Tomorrow'
  if (d <= 7)  return `In ${d} days`
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function buildSubjectData(raw: {
  attendance: Attendance[]
  sessions: Session[]
  marks: (Mark & { topic: string; totalMarks: number; conductedOn: string })[]
  mastery: TopicMastery[]
  catchupMaterials: CatchupMaterial[]
  syllabusTopics: SyllabusTopic[]
  timetable: TimetableEntry[]
  polls: TopicPoll[]
  tests: Test[]
}): SubjectData {
  // Attendance rate
  const bySession = new Map<string, Attendance>()
  raw.attendance.forEach(a => bySession.set(a.sessionId || a.id, a))
  const unique       = [...bySession.values()]
  const presentCount = unique.filter(a => a.status !== 'absent').length
  const attendanceRate = unique.length > 0 ? presentCount / unique.length : 0

  // Attendance streak — count consecutive present sessions from most recent
  const sortedSessions = [...raw.sessions].sort((a, b) => b.date.localeCompare(a.date))
  let attendanceStreak = 0
  for (const session of sortedSessions) {
    const record = raw.attendance.find(a => a.sessionId === session.id)
    if (record && record.status !== 'absent') attendanceStreak++
    else break
  }

  const recentMarks = [...raw.marks]
    .sort((a, b) => b.conductedOn.localeCompare(a.conductedOn)).slice(0, 4)

  const sorted      = [...raw.mastery].sort((a, b) => a.mastery - b.mastery)
  const weakTopics  = sorted.filter(m => m.mastery < 0.6).slice(0, 4)
  const strongTopics = sorted.filter(m => m.mastery >= 0.75).slice(-3).reverse()

  const catchupPlans = raw.catchupMaterials
    .filter(c => c.status !== 'done')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // Upcoming tests — future tests the student hasn't been marked for
  const markedTestIds = new Set(raw.marks.map(m => m.testId))
  const today = new Date().toISOString().split('T')[0]
  const upcomingTests = raw.tests
    .filter(t => t.conductedOn >= today && !markedTestIds.has(t.id))
    .sort((a, b) => a.conductedOn.localeCompare(b.conductedOn))
    .slice(0, 3) as UpcomingTest[]

  return {
    attendanceRate, totalSessions: raw.sessions.length,
    presentCount, attendanceStreak,
    recentMarks, weakTopics, strongTopics, catchupPlans,
    syllabusTopics: [...raw.syllabusTopics].sort((a, b) => a.orderIndex - b.orderIndex),
    timetable: raw.timetable,
    polls: raw.polls,
    upcomingTests,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentHomePage() {
  const router = useRouter()
  const [student,     setStudent]     = useState<Student | null>(null)
  const [cls,         setCls]         = useState<Class | null>(null)
  const [subjects,    setSubjects]    = useState<SubjectTab[]>([])
  const [activeIdx,   setActiveIdx]   = useState(0)
  const [subjectData, setSubjectData] = useState<SubjectData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [quiz, setQuiz] = useState<QuizState>({
    phase: 'idle', topic: '', questions: [], current: 0, selected: [], score: 0,
  })
  const [showExpl,      setShowExpl]      = useState(false)
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)
  const [loadError,     setLoadError]     = useState(false)
  const [showInterests, setShowInterests] = useState(false)
  const [draftInterests, setDraftInterests] = useState<string[]>([])
  const [customInput,   setCustomInput]   = useState('')
  const [savingInterests, setSavingInterests] = useState(false)
  const initDone       = useRef(false)
  const contentPaneRef = useRef<HTMLDivElement>(null)

  const dateStr = useMemo(() => new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }), [])

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
      setStudent(data.student); setCls(data.primaryClass)
      const tabs: SubjectTab[] = data.tabs.map(
        (t: { classId: string; studentId: string; subject: string; teacherId?: string }, i: number) => ({
          classId: t.classId, studentId: t.studentId,
          teacherId: t.teacherId,
          label: t.subject, color: TAB_COLORS[i % TAB_COLORS.length],
        })
      )
      setSubjects(tabs)
      if (tabs.length > 0) await loadData(tabs[0])
    } catch { router.replace('/student/login') }
    finally { setLoading(false) }
  }

  async function loadData(tab: SubjectTab) {
    setDataLoading(true)
    setLoadError(false)
    try {
      const params = new URLSearchParams({ classId: tab.classId, studentId: tab.studentId })
      if (tab.teacherId) params.set('teacherId', tab.teacherId)
      const res = await fetch(`/api/student/tab-data?${params}`)
      if (!res.ok) { setLoadError(true); return }
      setSubjectData(buildSubjectData(await res.json()))
    } catch {
      setLoadError(true)
    } finally { setDataLoading(false) }
  }

  async function handleSelect(idx: number) {
    setActiveIdx(idx)
    setSubjectData(null)
    setLoadError(false)
    setErrorMsg(null)
    setQuiz({ phase: 'idle', topic: '', questions: [], current: 0, selected: [], score: 0 })
    await loadData(subjects[idx])
  }

  function handleLogout() {
    localStorage.removeItem('eduteach_student_session')
    document.cookie = 'edu-student-id=; path=/; max-age=0'
    router.replace('/student/login')
  }

  function openInterestsEditor() {
    setDraftInterests(student?.interests ?? [])
    setCustomInput('')
    setShowInterests(true)
  }

  function togglePreset(label: string) {
    setDraftInterests(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    )
  }

  function addCustom() {
    const v = customInput.trim()
    if (!v || draftInterests.includes(v)) { setCustomInput(''); return }
    setDraftInterests(prev => [...prev, v])
    setCustomInput('')
  }

  async function saveInterests() {
    setSavingInterests(true)
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: draftInterests }),
      })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      setStudent(prev => prev ? { ...prev, interests: data.interests } : prev)
      setShowInterests(false)
    } catch {
      setErrorMsg('Could not save preferences — please try again.')
    }
    setSavingInterests(false)
  }

  async function startQuiz(topic: string) {
    setErrorMsg(null)
    setQuiz({ phase: 'loading', topic, questions: [], current: 0, selected: [], score: 0 })
    contentPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const res = await fetch('/api/practice-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic, subject: subjects[activeIdx]?.label ?? '',
          grade: cls?.grade ?? '', interests: student?.interests ?? [],
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error (${res.status})`)
      }
      const data = await res.json()
      if (!Array.isArray(data.questions) || data.questions.length === 0)
        throw new Error('No questions returned — please try again.')
      setQuiz({ phase: 'active', topic, questions: data.questions, current: 0,
        selected: new Array(data.questions.length).fill(null), score: 0 })
      setShowExpl(false)
    } catch (err) {
      setQuiz(q => ({ ...q, phase: 'idle' }))
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load quiz. Please try again.')
      contentPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function selectAnswer(oi: number) {
    if (quiz.phase !== 'active') return
    const q = quiz.questions[quiz.current]
    if (!q) return
    // Guard: never score a question that's already been answered
    if (quiz.selected[quiz.current] !== null) return
    const sel = [...quiz.selected]; sel[quiz.current] = oi
    setQuiz(p => ({ ...p, selected: sel, score: p.score + (oi === q.answerIndex ? 1 : 0) }))
    setShowExpl(true)
  }

  function nextQuestion() {
    const next = quiz.current + 1
    if (next >= quiz.questions.length) setQuiz(q => ({ ...q, phase: 'done' }))
    else { setQuiz(q => ({ ...q, current: next })); setShowExpl(false) }
  }

  function submitPoll(syllabusTopicId: string, topic: string, response: 'understood' | 'partial' | 'confused') {
    const tab = subjects[activeIdx]; if (!tab) return
    // Snapshot current polls for rollback
    const prevPolls = subjectData?.polls ?? []
    setSubjectData(prev => {
      if (!prev) return prev
      const idx = prev.polls.findIndex(p => p.syllabusTopicId === syllabusTopicId)
      if (idx >= 0) {
        const updated = [...prev.polls]
        updated[idx] = { ...updated[idx], response, respondedAt: new Date().toISOString() }
        return { ...prev, polls: updated }
      }
      return { ...prev, polls: [...prev.polls, {
        id: crypto.randomUUID(), studentId: tab.studentId, classId: tab.classId,
        syllabusTopicId, topic, subject: tab.label, response, respondedAt: new Date().toISOString(),
      }]}
    })
    fetch('/api/student/poll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: tab.classId, syllabusTopicId, topic, subject: tab.label, response }),
    }).then(res => {
      if (!res.ok) throw new Error('Poll save failed')
    }).catch(() => {
      // Rollback optimistic update on failure
      setSubjectData(prev => prev ? { ...prev, polls: prevPolls } : prev)
      setErrorMsg('Could not save your response — please try again.')
    })
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const active = subjects[activeIdx]

  const pollMap = useMemo(
    () => new Map((subjectData?.polls ?? []).map(p => [p.syllabusTopicId, p.response])),
    [subjectData],
  )

  const priorityState = useMemo<PriorityState>(() => {
    if (!subjectData) return 'good'
    if (subjectData.catchupPlans.length > 0) return 'catchup'
    if (subjectData.weakTopics.length > 0) return 'practice'
    if (subjectData.syllabusTopics.some(t => t.isCompleted && !pollMap.has(t.id))) return 'poll'
    return 'good'
  }, [subjectData, pollMap])

  const unpolled = useMemo(
    () => subjectData?.syllabusTopics.filter(t => t.isCompleted && !pollMap.has(t.id)).slice(-2) ?? [],
    [subjectData, pollMap],
  )

  const completedCount = subjectData?.syllabusTopics.filter(t => t.isCompleted).length ?? 0
  const totalCount     = subjectData?.syllabusTopics.length ?? 0
  const attendPct      = subjectData ? Math.round(subjectData.attendanceRate * 100) : 0
  const attendColor    = attendPct >= 90 ? '#059669' : attendPct >= 75 ? '#f97316' : '#dc2626'
  const ps             = priorityState

  // Auto-scroll to study plans when catchup state is active
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // ── All badges (earned + locked) ──────────────────────────────────────────

  const allBadges = useMemo(
    () => subjectData ? computeAllBadges(subjectData) : [],
    [subjectData],
  )


  // ── Loading screen ─────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="animate-spin" style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid #bfdbfe', borderTopColor: '#2563eb', margin: '0 auto 12px' }} />
        <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>Loading your dashboard…</p>
      </div>
    </div>
  )
  if (!student || !cls) return null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#eff6ff', fontFamily: 'var(--font-jakarta), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>

      {/* ════ TOP BAR ════ */}
      <header style={{ background: '#fff', borderBottom: '2px solid #e0ecff', display: 'flex', alignItems: 'center', padding: '0 28px', height: 68, flexShrink: 0, gap: 20, boxShadow: '0 2px 12px rgba(37,99,235,0.07)' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #07153a 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={20} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>EduTeach</p>
            <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>Student Portal</p>
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: '#e2e8f0', flexShrink: 0 }} />

        {/* Subject tabs */}
        <div style={{ flex: 1, display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0' }}>
          {subjects.map((sub, idx) => {
            const isAct = idx === activeIdx
            return (
              <button key={sub.classId} onClick={() => handleSelect(idx)}
                style={{ flexShrink: 0, padding: '8px 20px', borderRadius: 24, border: isAct ? 'none' : '2px solid #e2e8f0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, transition: 'all .15s', background: isAct ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' : '#f8fafc', color: isAct ? '#fff' : '#64748b', boxShadow: isAct ? '0 2px 10px rgba(37,99,235,0.25)' : 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                {sub.label}
                {isAct && dataLoading && <Loader2 size={12} className="animate-spin" style={{ color: 'rgba(255,255,255,.7)' }} />}
              </button>
            )
          })}
        </div>

        {/* Profile area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={openInterestsEditor}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: '2px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#64748b', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2563eb'; (e.currentTarget as HTMLButtonElement).style.color = '#2563eb' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}>
            <Pencil size={12} />
            My Interests
            {student?.interests && student.interests.length > 0
              ? <span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: 10, padding: '1px 7px', fontSize: 10.5, fontWeight: 900 }}>{student.interests.length}</span>
              : <span style={{ fontSize: 10.5, color: '#f59e0b', fontWeight: 700 }}>Set!</span>
            }
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
              {(student.name?.trim()?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{student.name}</p>
              <p style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>Roll #{student.rollNumber} · Gr {cls.grade}{cls.section ?? ''}</p>
            </div>
          </div>

          <button onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#94a3b8', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#fca5a5' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0' }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      {/* ════ MAIN CONTENT ════ */}
      <div ref={contentPaneRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '28px 36px 60px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Welcome row */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>{dateStr}</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: -0.5 }}>
            Hello, {student.name?.split(' ')[0]}! 👋
          </h1>
          <p style={{ fontSize: 15, color: '#64748b', marginTop: 4 }}>
            Here&apos;s how you&apos;re doing in <span style={{ fontWeight: 800, color: '#2563eb' }}>{active?.label}</span>
          </p>
        </div>

          {/* ── Error toast ── */}
          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 14, background: '#fef2f2', border: '1.5px solid #fca5a5' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#991b1b', lineHeight: 1.5 }}>{errorMsg}</p>
              <button onClick={() => setErrorMsg(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 18, lineHeight: 1, padding: 0, fontFamily: 'inherit' }}>✕</button>
            </div>
          )}

          {dataLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {[1,2,3,4].map(i => <div key={i} className="animate-pulse" style={{ height: 116, borderRadius: 20, background: '#dce8ff' }} />)}
              </div>
              <div className="animate-pulse" style={{ height: 100, borderRadius: 20, background: '#dce8ff' }} />
              <div className="animate-pulse" style={{ height: 220, borderRadius: 24, background: '#dce8ff' }} />
            </div>

          ) : loadError ? (
            <div style={{ ...CARD, alignItems: 'center', justifyContent: 'center', padding: '72px 20px', textAlign: 'center' }}>
              <span style={{ fontSize: 48 }}>⚠️</span>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 14 }}>Could not load data</p>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 5, lineHeight: 1.6, maxWidth: 340 }}>Check your connection and try again!</p>
              <button onClick={() => { const tab = subjects[activeIdx]; if (tab) loadData(tab) }}
                style={{ marginTop: 18, padding: '12px 32px', borderRadius: 14, background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Try Again
              </button>
            </div>
          ) : !subjectData ? (
            <div style={{ ...CARD, alignItems: 'center', justifyContent: 'center', padding: '72px 20px', textAlign: 'center' }}>
              <span style={{ fontSize: 52 }}>📚</span>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 14 }}>Nothing here yet for {active?.label}!</p>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 5, lineHeight: 1.6, maxWidth: 340 }}>Once your teacher adds lessons and tests, your progress will appear here.</p>
            </div>

          ) : (
            <>
              {/* ── STATS ROW ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {([
                  {
                    icon: '📅',
                    label: 'Classes Attended',
                    value: subjectData.presentCount > 0 ? String(subjectData.presentCount) : '—',
                    sub: attendPct >= 90 ? 'Amazing! Keep it up 🌟' : attendPct >= 75 ? 'Good job! Keep coming 👍' : attendPct > 0 ? 'Try to come more 💪' : 'No classes yet',
                    bg: '#eff6ff', valueColor: '#1d4ed8', border: '#bfdbfe',
                  },
                  {
                    icon: '📖',
                    label: 'Topics Done',
                    value: completedCount > 0 ? String(completedCount) : '0',
                    sub: totalCount > 0
                      ? completedCount === totalCount ? `All ${totalCount} done! 🎉` : `out of ${totalCount} topics`
                      : 'Topics coming soon',
                    bg: '#f0fdf4', valueColor: '#16a34a', border: '#bbf7d0',
                  },
                  {
                    icon: subjectData.attendanceStreak >= 2 ? '🔥' : '💫',
                    label: 'Class Streak',
                    value: subjectData.attendanceStreak >= 2 ? String(subjectData.attendanceStreak) : '—',
                    sub: subjectData.attendanceStreak >= 7 ? 'Week Warrior! 🔥🔥' : subjectData.attendanceStreak >= 3 ? 'On fire! Keep going!' : subjectData.attendanceStreak >= 2 ? 'Great start! 👏' : 'Attend more to build one',
                    bg: '#fff7ed', valueColor: '#ea580c', border: '#fed7aa',
                  },
                  subjectData.recentMarks[0]
                    ? (() => {
                        const m = subjectData.recentMarks[0]
                        const pct = m.totalMarks > 0 ? Math.round((m.score / m.totalMarks) * 100) : 0
                        return {
                          icon: pct >= 90 ? '🌟' : pct >= 70 ? '✅' : pct >= 50 ? '📝' : '💪',
                          label: 'Last Test',
                          value: `${m.score}/${m.totalMarks}`,
                          sub: pct >= 90 ? 'Brilliant work! 🌟' : pct >= 70 ? 'Well done!' : pct >= 50 ? 'Getting better!' : 'Keep practising!',
                          bg: pct >= 70 ? '#f0fdf4' : pct >= 50 ? '#fff7ed' : '#fef2f2',
                          valueColor: pct >= 70 ? '#16a34a' : pct >= 50 ? '#ea580c' : '#dc2626',
                          border: pct >= 70 ? '#bbf7d0' : pct >= 50 ? '#fed7aa' : '#fecaca',
                        }
                      })()
                    : { icon: '✏️', label: 'Last Test', value: '—', sub: 'No tests yet', bg: '#f8fafc', valueColor: '#94a3b8', border: '#e2e8f0' },
                ] as { icon: string; label: string; value: string; sub: string; bg: string; valueColor: string; border: string }[]).map((stat, i) => (
                  <div key={i} style={{ background: stat.bg, borderRadius: 20, border: `2px solid ${stat.border}`, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 22, lineHeight: 1 }}>{stat.icon}</span>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>{stat.label}</p>
                    </div>
                    <p style={{ fontSize: 34, fontWeight: 900, color: stat.valueColor, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stat.value}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#64748b', lineHeight: 1.4 }}>{stat.sub}</p>
                  </div>
                ))}
              </div>

              {/* ── TODAY'S FOCUS / QUIZ ── */}
              {quiz.phase !== 'idle' ? (

                <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 14, flex: 1 }}>Quiz — {quiz.topic}</span>
                    {quiz.phase === 'active' && (
                      <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.15)', padding: '3px 12px', borderRadius: 20 }}>
                        {quiz.current + 1} / {quiz.questions.length}
                      </span>
                    )}
                    <button onClick={() => setQuiz(q => ({ ...q, phase: 'idle' }))}
                      style={{ background: 'rgba(255,255,255,.15)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 8, fontFamily: 'inherit' }}>
                      ✕ Exit
                    </button>
                  </div>
                  <div style={{ padding: '24px 22px' }}>
                    {quiz.phase === 'loading' && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                        <Loader2 size={28} className="animate-spin" style={{ color: '#2563eb' }} />
                        <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Preparing your questions…</p>
                      </div>
                    )}
                    {quiz.phase === 'active' && quiz.questions[quiz.current] && (() => {
                      const q = quiz.questions[quiz.current]
                      const sel = quiz.selected[quiz.current]
                      const answered = sel !== null
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <p style={{ fontWeight: 700, color: '#1e293b', fontSize: 15, lineHeight: 1.65 }}>{q.text}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {q.options.map((opt, oi) => {
                              let bg = '#f8fafc', border = '#e2e8f0', col = '#475569'
                              if (answered) {
                                if (oi === q.answerIndex) { bg = '#ecfdf5'; border = '#6ee7b7'; col = '#065f46' }
                                else if (oi === sel)      { bg = '#fef2f2'; border = '#fca5a5'; col = '#991b1b' }
                                else                      { col = '#cbd5e1' }
                              }
                              return (
                                <button key={oi} onClick={() => !answered && selectAnswer(oi)} disabled={answered}
                                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, border: `2px solid ${border}`, background: bg, color: col, fontSize: 13, fontWeight: 600, textAlign: 'left', cursor: answered ? 'default' : 'pointer', transition: 'all .12s', fontFamily: 'inherit' }}>
                                  <span style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0, ...(answered && oi === q.answerIndex ? { background: '#059669', borderColor: '#059669', color: '#fff' } : {}), ...(answered && oi === sel && oi !== q.answerIndex ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff' } : {}) }}>
                                    {String.fromCharCode(65 + oi)}
                                  </span>
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                          {showExpl && (
                            <div style={{ borderRadius: 14, padding: '14px 16px', background: sel === q.answerIndex ? '#ecfdf5' : '#fef2f2', border: `1px solid ${sel === q.answerIndex ? '#a7f3d0' : '#fca5a5'}` }}>
                              <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 5, color: sel === q.answerIndex ? '#065f46' : '#991b1b' }}>
                                {sel === q.answerIndex ? '✓ Correct!' : '✗ Incorrect'}
                              </p>
                              <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.7 }}>{q.explanation}</p>
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
                        <p style={{ fontSize: 56 }}>{quiz.score === quiz.questions.length ? '🎉' : quiz.score >= quiz.questions.length / 2 ? '👍' : '💪'}</p>
                        <p style={{ fontSize: 36, fontWeight: 900, color: '#1e293b', marginTop: 10, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{quiz.score}/{quiz.questions.length}</p>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                          {quiz.score === quiz.questions.length ? 'Perfect! Every answer correct.' : quiz.score >= quiz.questions.length / 2 ? 'Good effort! Keep practising.' : "Keep going — you'll get there!"}
                        </p>
                        <button onClick={() => setQuiz(q => ({ ...q, phase: 'idle' }))}
                          style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 14, background: '#f1f5f9', border: 'none', fontSize: 13, fontWeight: 700, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
                          <RotateCcw size={14} /> Back to dashboard
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              ) : (
                /* ── FOCUS CARD ── */
                <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${PS_BORDER[ps]}`, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: PS_COLOR[ps], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {ps === 'catchup' ? '📋' : ps === 'practice' ? '✏️' : ps === 'poll' ? '🧠' : '🎉'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PS_COLOR[ps], marginBottom: 4 }}>
                      {FOCUS_TAG[ps]}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                      {ps === 'catchup'  && `Your teacher prepared ${subjectData.catchupPlans.length} study plan${subjectData.catchupPlans.length > 1 ? 's' : ''} just for you`}
                      {ps === 'practice' && `${subjectData.weakTopics[0]?.topic} needs work — you're at ${Math.round((subjectData.weakTopics[0]?.mastery ?? 0) * 100)}% mastery`}
                      {ps === 'poll'     && 'Quick check-in: Did you understand the last topics?'}
                      {ps === 'good'     && "You're fully on track — great attendance and strong topics!"}
                    </p>
                    {ps === 'catchup' && student?.interests && student.interests.length > 0 && (
                      <p style={{ fontSize: 11, color: '#d97706', marginTop: 4, fontWeight: 600 }}>
                        ✨ Explained using your interests: {student.interests.slice(0, 2).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Right action — go to plans page */}
                  {ps === 'catchup' && (
                    <button
                      onClick={() => router.push('/student/plans')}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 12, background: 'linear-gradient(135deg, #ea580c, #d97706)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      View Plans →
                    </button>
                  )}
                </div>
              )}

              {/* Practice topics — shown below focus banner when in practice state */}
              {quiz.phase === 'idle' && ps === 'practice' && (
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #fde68a', padding: '18px 20px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#d97706', marginBottom: 12 }}>Choose a topic to practise</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {subjectData.weakTopics.map((t, i) => (
                      <button key={i} onClick={() => startQuiz(t.topic)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1.5px solid #fde68a', background: '#fff7ed', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13.5, fontWeight: 700, color: '#92400e' }}>{t.topic}</p>
                          <p style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>{Math.round(t.mastery * 100)}% mastery — needs improvement</p>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#d97706', padding: '5px 14px', borderRadius: 8, flexShrink: 0 }}>Practice →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Poll form — shown below focus banner when in poll state */}
              {quiz.phase === 'idle' && ps === 'poll' && (
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #bfdbfe', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 0 }}>Your response is anonymous</p>
                  {unpolled.map(topic => (
                    <div key={topic.id} style={{ padding: '14px 16px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>{topic.topic}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { r: 'understood' as const, label: '✅ I got it',  bg: '#ecfdf5', activeBorder: '#059669', activeColor: '#065f46' },
                          { r: 'partial'    as const, label: '🤔 Sort of',   bg: '#fffbeb', activeBorder: '#d97706', activeColor: '#92400e' },
                          { r: 'confused'   as const, label: '❌ Not yet',   bg: '#fef2f2', activeBorder: '#dc2626', activeColor: '#991b1b' },
                        ]).map(({ r, label, bg, activeBorder, activeColor }) => {
                          const isSel = pollMap.get(topic.id) === r
                          return (
                            <button key={r} onClick={() => submitPoll(topic.id, topic.topic, r)}
                              style={{ flex: 1, padding: '11px 6px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', transition: 'all .12s', background: isSel ? bg : '#fff', border: `2px solid ${isSel ? activeBorder : '#e2e8f0'}`, color: isSel ? activeColor : '#94a3b8' }}>
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── STUDY PLANS ── */}
              {subjectData.catchupPlans.length > 0 && (
                <button
                  onClick={() => router.push('/student/plans')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', borderRadius: 20, border: '1.5px solid #fed7aa', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background .12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff7ed' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #ea580c, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    📚
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Study Plans from Your Teacher</p>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 3 }}>
                      {subjectData.catchupPlans.length} plan{subjectData.catchupPlans.length !== 1 ? 's' : ''} waiting — explanations, practice questions &amp; quizzes
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ padding: '5px 14px', borderRadius: 20, background: '#fff7ed', color: '#ea580c', border: '1px solid #fde68a', fontSize: 13, fontWeight: 800 }}>
                      {subjectData.catchupPlans.length} active
                    </span>
                    <span style={{ fontSize: 18, color: '#d97706', fontWeight: 700 }}>→</span>
                  </div>
                </button>
              )}

              {/* ── UPCOMING TESTS ── */}
              {subjectData.upcomingTests.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #bfdbfe', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 22px', borderBottom: '1px solid #eff6ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarClock size={16} style={{ color: '#2563eb' }} />
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>Upcoming Tests</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {subjectData.upcomingTests.map((t, i) => {
                      const d = daysUntil(t.conductedOn)
                      const urgent = d <= 2
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px', borderBottom: i < subjectData.upcomingTests.length - 1 ? '1px solid #f1f5f9' : 'none', background: urgent ? '#fffbeb' : '#fff' }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: urgent ? '#fde68a' : '#eff6ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 18, fontWeight: 900, color: urgent ? '#d97706' : '#2563eb', lineHeight: 1 }}>{d === 0 ? '!' : d}</span>
                            <span style={{ fontSize: 8, fontWeight: 700, color: urgent ? '#d97706' : '#2563eb', textTransform: 'uppercase', letterSpacing: '.05em' }}>{d === 0 ? 'Today' : 'days'}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{t.topic}</p>
                            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                              {new Date(t.conductedOn + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · Max marks: {t.totalMarks}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: urgent ? '#ea580c' : '#2563eb', marginBottom: 6 }}>{formatTestDate(t.conductedOn)}</p>
                            <button onClick={() => startQuiz(t.topic)}
                              style={{ padding: '7px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Practise →
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── 2-COL: RECENT TESTS | SYLLABUS PROGRESS ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ ...LBL }}>Recent Test Scores</p>
                  {subjectData.recentMarks.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>No tests recorded yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {subjectData.recentMarks.slice(0, 4).map((m, i) => {
                        const pct   = m.totalMarks > 0 ? Math.round((m.score / m.totalMarks) * 100) : 0
                        const color = pct >= 70 ? '#059669' : pct >= 50 ? '#f97316' : '#dc2626'
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.topic}</p>
                                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                  {new Date(m.conductedOn + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{ fontSize: 15, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color }}>{m.score}/{m.totalMarks}</p>
                                <p style={{ fontSize: 11, fontWeight: 700, color, marginTop: 1 }}>{pct}%</p>
                              </div>
                            </div>
                            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: color, transition: 'width .4s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ ...LBL }}>Syllabus Progress</p>
                    {totalCount > 0 && <p style={{ fontSize: 13, fontWeight: 800, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>{Math.round((completedCount / totalCount) * 100)}%</p>}
                  </div>
                  {totalCount === 0 ? (
                    <p style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>No syllabus added yet</p>
                  ) : (
                    <>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{completedCount} of {totalCount} topics</span>
                        </div>
                        <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 6, width: `${Math.round((completedCount / totalCount) * 100)}%`, background: 'linear-gradient(90deg, #1d4ed8, #2563eb)', transition: 'width .4s' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {subjectData.syllabusTopics.filter(t => t.isCompleted).slice(-5).reverse().map((t, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CheckCircle2 size={14} style={{ color: '#059669', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.topic}</span>
                          </div>
                        ))}
                        {completedCount > 5 && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>+ {completedCount - 5} more completed</p>}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── 2-COL: PRACTICE TOPICS | STRONG TOPICS ── */}
              {(subjectData.weakTopics.length > 0 || subjectData.strongTopics.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ ...LBL }}>Needs More Practice</p>
                    {subjectData.weakTopics.length === 0
                      ? <p style={{ fontSize: 13, color: '#94a3b8' }}>No weak topics — great work! 🎉</p>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {subjectData.weakTopics.map((t, i) => (
                            <button key={i} onClick={() => startQuiz(t.topic)}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fde68a', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{t.topic}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: '#c2410c', background: '#fde68a', padding: '2px 10px', borderRadius: 10 }}>{Math.round(t.mastery * 100)}%</span>
                                <span style={{ fontSize: 11, color: '#d97706', fontWeight: 700 }}>Practice →</span>
                              </div>
                            </button>
                          ))}
                        </div>
                    }
                  </div>
                  <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ ...LBL }}>Doing Well In</p>
                    {subjectData.strongTopics.length === 0
                      ? <p style={{ fontSize: 13, color: '#94a3b8' }}>Keep studying — strong topics will appear here.</p>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {subjectData.strongTopics.map((t, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                              <CheckCircle2 size={15} style={{ color: '#059669', flexShrink: 0 }} />
                              <p style={{ fontSize: 13, fontWeight: 700, color: '#065f46', flex: 1 }}>{t.topic}</p>
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#059669', background: '#a7f3d0', padding: '2px 10px', borderRadius: 10 }}>{Math.round(t.mastery * 100)}%</span>
                            </div>
                          ))}
                        </div>
                    }
                  </div>
                </div>
              )}

              {/* ── BADGES SECTION ── */}
              {allBadges.length > 0 && (() => {
                const earned = allBadges.filter(b => b.earned)
                const locked = allBadges.filter(b => !b.earned)
                const earnedCount = earned.length
                return (
                  <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', borderBottom: earnedCount > 0 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22 }}>🏆</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>Your Badges</p>
                        <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>
                          {earnedCount === 0 ? 'Start attending and taking tests to earn badges!' : earnedCount === allBadges.length ? 'You earned all the badges! Amazing! 🎉' : `${earnedCount} of ${allBadges.length} badges earned — keep going!`}
                        </p>
                      </div>
                      {earnedCount > 0 && (
                        <div style={{ padding: '6px 16px', borderRadius: 20, background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff', fontSize: 13, fontWeight: 800 }}>
                          {earnedCount}/{allBadges.length}
                        </div>
                      )}
                    </div>
                    {earnedCount > 0 && (
                      <div style={{ padding: '16px 24px', borderBottom: locked.length > 0 ? '1px solid #f8fafc' : 'none' }}>
                        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#059669', marginBottom: 12 }}>✓ Earned</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                          {earned.map(b => (
                            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: b.bg, border: `1.5px solid ${b.border}` }}>
                              <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{b.icon}</span>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 800, color: b.color, lineHeight: 1 }}>{b.name}</p>
                                <p style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>{b.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {locked.length > 0 && (
                      <div style={{ padding: '16px 24px' }}>
                        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>🔒 Locked — earn these next!</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                          {locked.map(b => (
                            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: '#f8fafc', border: '1.5px solid #e2e8f0', opacity: 0.8 }}>
                              <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, filter: 'grayscale(1)', opacity: 0.4 }}>{b.icon}</span>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#94a3b8', lineHeight: 1 }}>{b.name}</p>
                                <p style={{ fontSize: 11, color: '#cbd5e1', marginTop: 3, lineHeight: 1.4 }}>{b.hint}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

            </>
          )}
        </div>{/* end maxWidth container */}
      </div>{/* end main scrollable */}

      {/* ════ INTERESTS MODAL ════ */}
      {showInterests && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowInterests(false) }}>
          <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 480, margin: '0 16px', boxShadow: '0 24px 80px rgba(15,23,42,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Pencil size={16} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>My Interests</p>
                <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>Pick topics and AI will use them in your practice and catch-up plans</p>
              </div>
              <button onClick={() => setShowInterests(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={15} color="#64748b" />
              </button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Preset chips */}
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>Choose your hobbies</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PRESET_INTERESTS.map(label => {
                    const sel = draftInterests.includes(label)
                    return (
                      <button key={label} onClick={() => togglePreset(label)}
                        style={{ padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s', border: `2px solid ${sel ? '#2563eb' : '#e2e8f0'}`, background: sel ? '#eff6ff' : '#f8fafc', color: sel ? '#1d4ed8' : '#64748b' }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Custom input */}
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>Add your own</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustom()}
                    placeholder="e.g. Kabaddi, Painting…"
                    style={{ flex: 1, border: '2px solid #e2e8f0', borderRadius: 12, padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', color: '#1e293b', outline: 'none' }}
                  />
                  <button onClick={addCustom}
                    style={{ padding: '9px 18px', borderRadius: 12, background: '#1d4ed8', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    Add
                  </button>
                </div>
              </div>

              {/* Selected list */}
              {draftInterests.length > 0 && (
                <div>
                  <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>Selected ({draftInterests.length})</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {draftInterests.map(i => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: '#eff6ff', border: '1.5px solid #bfdbfe', fontSize: 12.5, fontWeight: 700, color: '#1d4ed8' }}>
                        {i}
                        <button onClick={() => setDraftInterests(prev => prev.filter(x => x !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#93c5fd' }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setShowInterests(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: '2px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={saveInterests} disabled={savingInterests}
                style={{ flex: 2, padding: '12px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: savingInterests ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: savingInterests ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {savingInterests ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><CheckIcon size={14} /> Save Preferences</>}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
