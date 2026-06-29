'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  PenLine, Plus, ChevronRight, GraduationCap, X, BookOpen,
  ArrowLeft, Sparkles, RefreshCw, ChevronDown, ChevronUp, Lock,
  FileText, Trash2, Printer,
} from 'lucide-react'
import { useApp } from '@/lib/context'
import MarkEntry from '@/components/marks/MarkEntry'
import CreateClassModal from '@/components/classes/CreateClassModal'
import { aiKey, getAiCache, setAiCache, TTL } from '@/lib/ai-cache'
import type { AiQuestion } from '@/lib/types'
import clsx from 'clsx'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'list' | 'new-test' | 'enter-marks' | 'worksheet-marks'
type TestMode = 'subjective' | 'worksheet'

interface WsRow { type: string; count: number; marksEach: number }
interface WsQuestion { text: string; options?: string[]; answer?: string }
interface WsSection { type: string; label: string; marksEach: number; questions: WsQuestion[] }
interface WsPreview { topic: string; sections: WsSection[]; totalMarks: number }

const WS_TEMPLATES = [
  {
    name: 'Quick Quiz', totalLabel: '10m',
    dist: [
      { type: 'mcq', count: 5, marksEach: 1 },
      { type: 'short-answer', count: 1, marksEach: 3 },
      { type: 'long-answer', count: 1, marksEach: 2 },
    ],
  },
  {
    name: 'Unit Test', totalLabel: '25m',
    dist: [
      { type: 'mcq', count: 10, marksEach: 1 },
      { type: 'fill-in-blank', count: 3, marksEach: 2 },
      { type: 'short-answer', count: 2, marksEach: 2 },
      { type: 'long-answer', count: 1, marksEach: 5 },
    ],
  },
  {
    name: 'Half Yearly', totalLabel: '50m',
    dist: [
      { type: 'mcq', count: 15, marksEach: 1 },
      { type: 'fill-in-blank', count: 5, marksEach: 1 },
      { type: 'short-answer', count: 5, marksEach: 3 },
      { type: 'long-answer', count: 3, marksEach: 5 },
    ],
  },
]

const DIFF_COLOR: Record<string, string> = {
  easy:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard:   'bg-red-100 text-red-700',
}

const CLASS_ACCENT = [
  'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #059669 0%, #34d399 100%)',
  'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
  'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #e11d48 0%, #fb7185 100%)',
  'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function TestsPage() {
  const router = useRouter()
  const {
    teacher, classes, students, tests, marks, assignments,
    getClassStudents, getClassSyllabus, getTopicSessions,
    createTest, saveMarks, forceSync, syncStatus,
    worksheets, saveWorksheet, updateWorksheetAnswerKey, removeWorksheet,
  } = useApp()

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep]                 = useState<Step>('list')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [currentTestId, setCurrentTestId]     = useState('')
  const [currentWorksheetId, setCurrentWorksheetId] = useState('')
  const [wsMarksData, setWsMarksData]         = useState<Array<{ studentId: string; score: number; feedback?: string; source?: string; imageUrl?: string }>>([])
  const [wsMarksLoading, setWsMarksLoading]   = useState(false)

  // ── New-test form state ──────────────────────────────────────────────────────
  const [topicId, setTopicId]           = useState('')
  const [customTopic, setCustomTopic]   = useState('')
  const [totalMarks, setTotalMarks]     = useState('10')
  const [conductedOn, setConductedOn]   = useState(new Date().toISOString().split('T')[0])
  const [examType, setExamType]         = useState<'unit' | 'term'>('unit')
  const [unitNumber, setUnitNumber]     = useState('1')
  const [unitTopic, setUnitTopic]       = useState('')
  const [selectedTerm, setSelectedTerm] = useState(teacher?.currentTerm ?? 'Term 1')
  const [blockedTopicId, setBlockedTopicId] = useState('')
  const [saving, setSaving]             = useState(false)

  // ── AI questions ────────────────────────────────────────────────────────────
  const [aiQuestions, setAiQuestions]   = useState<AiQuestion[]>([])
  const [aiQLoading, setAiQLoading]     = useState(false)
  const [aiQOpen, setAiQOpen]           = useState(false)
  const [paperOpen, setPaperOpen]             = useState(true)
  const [paperPreviewOpen, setPaperPreviewOpen] = useState(false)
  const [printPaperOpen, setPrintPaperOpen]   = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // ── Test mode (subjective / worksheet) ──────────────────────────────────────
  const [testMode, setTestMode]         = useState<TestMode>('subjective')
  const [wsTopic, setWsTopic]           = useState('')
  const [wsTemplate, setWsTemplate]     = useState<string | null>(null)
  const [wsDistribution, setWsDistribution] = useState<WsRow[]>([])
  const [wsGenerating, setWsGenerating] = useState(false)
  const [wsPreview, setWsPreview]       = useState<WsPreview | null>(null)
  const [wsAnswerKey, setWsAnswerKey]   = useState<Record<string, string>>({})

  // ── Analysis ────────────────────────────────────────────────────────────────
  const [analysisTestId, setAnalysisTestId]   = useState<string | null>(null)
  const [analysisData, setAnalysisData]       = useState<Record<string, { summary: string; topPerformers: string; needHelp: string; action: string }>>({})
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // ── Syncing ─────────────────────────────────────────────────────────────────
  const [syncing, setSyncing]           = useState(false)

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [classPicker, setClassPicker]       = useState(false)
  const [createClassOpen, setCreateClassOpen] = useState(false)

  // ── Derived data ────────────────────────────────────────────────────────────

  const myClasses = useMemo(() => {
    const assignedIds = new Set([
      ...(assignments ?? []).map((a: { classId: string }) => a.classId),
      ...classes.filter(c => c.teacherId === teacher?.id).map(c => c.id),
    ])
    return classes.filter(c => assignedIds.has(c.id))
  }, [classes, assignments, teacher])

  const selectedClass    = myClasses.find(c => c.id === selectedClassId)
  const classStudents    = selectedClassId ? getClassStudents(selectedClassId) : []
  const syllabus         = selectedClassId ? getClassSyllabus(selectedClassId) : []
  const selectedTopic    = syllabus.find(t => t.id === topicId)
  const effectiveTopic   = selectedTopic?.topic ?? customTopic.trim()

  // Groups: all classes with their tests
  const groups = useMemo(() => {
    return myClasses.map((cls, gi) => {
      const cs = students.filter(s => s.classId === cls.id && s.isActive)
      const classTests = tests
        .filter(t => t.classId === cls.id)
        .sort((a, b) => new Date(b.conductedOn).getTime() - new Date(a.conductedOn).getTime())
        .map(t => {
          const enteredCount = new Set(marks.filter(m => m.testId === t.id).map(m => m.studentId)).size
          const total        = cs.length
          const allDone      = total > 0 && enteredCount >= total
          const started      = enteredCount > 0 && !allDone
          return { ...t, enteredCount, total, allDone, started }
        })

      // Revision suggestions: weakest topics for this class
      const csIds = new Set(cs.map(s => s.id))
      const mastery = marks
        .filter(m => csIds.has(m.studentId))
        .reduce<Record<string, { total: number; count: number }>>((acc, m) => {
          const test = tests.find(t => t.id === m.testId)
          if (!test) return acc
          const pct = m.score / test.totalMarks
          if (!acc[test.topic]) acc[test.topic] = { total: 0, count: 0 }
          acc[test.topic].total += pct
          acc[test.topic].count += 1
          return acc
        }, {})
      const revisionTopics = Object.entries(mastery)
        .map(([topic, { total, count }]) => ({ topic, avg: total / count }))
        .filter(t => t.avg < 0.65)
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 3)

      return { cls, classTests, revisionTopics, accentIdx: gi }
    })
  }, [myClasses, tests, marks, students])

  const totalTests   = groups.reduce((s, g) => s + g.classTests.length, 0)
  const pendingCount = groups.reduce((s, g) => s + g.classTests.filter(t => !t.allDone).length, 0)

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Auto-sync when entering marks
  useEffect(() => {
    if (step === 'enter-marks') {
      setSyncing(true)
      forceSync().finally(() => setSyncing(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Auto-generate AI questions when topic or marks change
  useEffect(() => {
    if (!topicId || !selectedClassId) return
    const topic = syllabus.find(t => t.id === topicId)
    if (!topic) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(() => {
      fetchAiQuestions(topic.topic, totalMarks, controller.signal)
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, totalMarks, selectedClassId])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleNewTest() {
    if (myClasses.length === 0) { setCreateClassOpen(true); return }
    resetForm()
    if (myClasses.length === 1) {
      setSelectedClassId(myClasses[0].id)
      setStep('new-test')
    } else {
      setClassPicker(true)
    }
  }

  function pickClass(classId: string) {
    setSelectedClassId(classId)
    setClassPicker(false)
    resetForm()
    setStep('new-test')
  }

  function openEnterMarks(classId: string, testId: string) {
    setSelectedClassId(classId)
    setCurrentTestId(testId)
    setPaperOpen(true)
    setStep('enter-marks')
  }

  async function openWorksheetMarks(classId: string, worksheetId: string) {
    setSelectedClassId(classId)
    setCurrentWorksheetId(worksheetId)
    setWsMarksData([])
    setWsMarksLoading(true)
    setStep('worksheet-marks')
    try {
      const res = await fetch(`/api/worksheet-marks?worksheetId=${worksheetId}`)
      if (res.ok) {
        const data = await res.json() as { marks: Array<{ student_id: string; score: number; feedback?: string; source?: string; image_url?: string }> }
        setWsMarksData((data.marks ?? []).map(m => ({
          studentId: m.student_id,
          score: m.score,
          feedback: m.feedback,
          source: m.source,
          imageUrl: m.image_url,
        })))
      }
    } catch { /* ignore */ }
    setWsMarksLoading(false)
  }

  async function handleSaveWorksheetMarks(entries: Array<{ studentId: string; score: number; feedback?: string; source?: string }>) {
    await fetch('/api/worksheet-marks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worksheetId: currentWorksheetId, entries }),
    })
    setStep('list')
    setCurrentWorksheetId('')
  }

  function resetForm() {
    setTopicId(''); setCustomTopic(''); setTotalMarks('10')
    setConductedOn(new Date().toISOString().split('T')[0])
    setExamType('unit'); setUnitNumber('1'); setUnitTopic('')
    setSelectedTerm(teacher?.currentTerm ?? 'Term 1')
    setBlockedTopicId(''); setAiQuestions([]); setAiQOpen(false)
    setTestMode('subjective')
    setWsTopic(''); setWsTemplate(null); setWsDistribution([]); setWsGenerating(false); setWsPreview(null)
    setWsAnswerKey({})
  }

  async function handleCreateTest() {
    if (!effectiveTopic) return
    setSaving(true)
    const safeUnit   = unitNumber.trim() || '1'
    const termValue  = examType === 'term'
      ? selectedTerm
      : unitTopic.trim() ? `Unit ${safeUnit} — ${unitTopic.trim()}` : `Unit ${safeUnit}`
    await createTest({
      subject: teacher?.subject ?? '',
      topic: effectiveTopic,
      totalMarks: parseInt(totalMarks) || 10,
      conductedOn,
      classId: selectedClassId,
      term: termValue,
      questions: aiQuestions.length > 0 ? aiQuestions : undefined,
    })
    setSaving(false)
    resetForm()
    setStep('list')
  }

  async function handleSaveMarks(entries: Array<{ studentId: string; score: number; feedback?: string; source?: string }>) {
    await saveMarks(currentTestId, entries)
    setStep('list')
    setCurrentTestId('')
  }

  async function fetchAiQuestions(topicName?: string, marksVal?: string, signal?: AbortSignal) {
    const topic = topicName ?? selectedTopic?.topic
    if (!topic) return
    setAiQLoading(true); setAiQOpen(true); setAiQuestions([])
    try {
      const totalM = parseInt(marksVal ?? totalMarks) || 10
      const ck     = aiKey('questions', { v: 4, subj: true, topic: topic.toLowerCase().trim(), grade: selectedClass?.grade ?? teacher?.grade ?? '5', totalM })
      const cached = getAiCache<AiQuestion[]>(ck)
      if (cached) { setAiQuestions(cached); setAiQLoading(false); return }
      const res = await fetch('/api/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: teacher?.subject ?? 'General', topic, grade: selectedClass?.grade ?? teacher?.grade ?? '5', totalMarks: totalM }),
        signal,
      })
      if (res.ok) {
        const { questions } = await res.json()
        setAiCache(ck, questions ?? [], TTL.ONE_MONTH)
        setAiQuestions(questions ?? [])
      }
    } catch (e) { if ((e as Error).name === 'AbortError') return }
    setAiQLoading(false)
  }

  async function generateWorksheet() {
    if (!wsTopic.trim() || wsDistribution.length === 0) return
    setWsGenerating(true); setWsPreview(null); setWsAnswerKey({})
    try {
      const res = await fetch('/api/generate-worksheet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: wsTopic.trim(),
          subject: teacher?.subject ?? 'General',
          grade: selectedClass?.grade ?? teacher?.grade ?? '5',
          distribution: wsDistribution,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const sections = data.sections ?? []
        const preview = { topic: wsTopic.trim(), sections, totalMarks: data.totalMarks ?? 0 }
        setWsPreview(preview)
        // Seed MCQ answers from generation output
        const seed: Record<string, string> = {}
        sections.forEach((sec: WsSection, si: number) => {
          if (sec.type === 'mcq') sec.questions.forEach((q: WsQuestion, qi: number) => { if (q.answer) seed[`${si}-${qi}`] = q.answer })
        })
        setWsAnswerKey(seed)
        // Navigate to the dedicated worksheet page
        sessionStorage.setItem('ws_draft', JSON.stringify({
          topic: preview.topic,
          subject: teacher?.subject ?? 'General',
          grade: selectedClass?.grade ?? teacher?.grade ?? '',
          className: selectedClass?.name,
          classId: selectedClassId || undefined,
          template: wsTemplate ?? undefined,
          totalMarks: preview.totalMarks,
          sections: preview.sections,
          initialAnswerKey: seed,
        }))
        router.push('/tests/worksheet')
      }
    } catch { /* user can retry */ }
    setWsGenerating(false)
  }

  async function fetchAnalysis(classId: string, testId: string) {
    if (analysisTestId === testId) { setAnalysisTestId(null); return }
    const test = tests.find(t => t.id === testId)
    if (!test) return
    setAnalysisTestId(testId)
    if (analysisData[testId]) return
    setAnalysisLoading(true)
    try {
      const cs   = getClassStudents(classId)
      const cls  = myClasses.find(c => c.id === classId)
      const testMarks = marks.filter(m => m.testId === testId)
      const results   = testMarks.map(m => {
        const s = cs.find(st => st.id === m.studentId)
        return { name: s?.name ?? 'Unknown', score: m.score, percentage: (m.score / test.totalMarks) * 100 }
      })
      const res = await fetch('/api/test-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: test.topic, totalMarks: test.totalMarks, grade: cls?.grade ?? '', subject: teacher?.subject ?? '', results }),
      })
      if (res.ok) { const data = await res.json(); setAnalysisData(prev => ({ ...prev, [testId]: data })) }
    } catch { /* teacher can retry */ }
    setAnalysisLoading(false)
  }

  const currentTest = tests.find(t => t.id === currentTestId)

  // ── STEP: NEW TEST FORM ────────────────────────────────────────────────────

  if (step === 'new-test') {
    return (
      <div style={{ background: '#f1f5f9', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #07153a 0%, #1d4ed8 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <button onClick={() => setStep('list')}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowLeft size={18} color="#fff" />
            </button>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-.3px', lineHeight: 1 }}>New Test</h2>
              {selectedClass && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>{selectedClass.name}{selectedClass.section ? ` · ${selectedClass.section}` : ''}</p>}
            </div>
          </div>
          {/* Test type tab bar */}
          <div style={{ display: 'flex', padding: '0 24px' }}>
            {(['subjective', 'worksheet'] as const).map(mode => (
              <button key={mode} onClick={() => { setTestMode(mode); setWsPreview(null) }}
                style={{ flex: 1, padding: '12px 0', fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: testMode === mode ? '#fff' : 'rgba(255,255,255,.4)', borderBottom: `2px solid ${testMode === mode ? '#fff' : 'transparent'}`, transition: 'all .15s', fontFamily: 'inherit' }}>
                {mode === 'subjective' ? 'Subjective Test' : 'Worksheet / Objective'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>

        {/* ── WORKSHEET TAB ── */}
        {testMode === 'worksheet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Topic */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 24px rgba(15,23,42,.07)' }}>
              <p className="label" style={{ marginBottom: 12 }}>Topic *</p>
              {syllabus.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input type="text" value={wsTopic} onChange={e => setWsTopic(e.target.value)}
                    placeholder="e.g. Fractions, Photosynthesis, Motion…" className="input-field" />
                  <p style={{ fontSize: 11, color: '#94a3b8' }}>No syllabus set up — type the topic directly.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {syllabus.map(t => {
                    const sessionCount = getTopicSessions(t.id).length
                    const taught       = sessionCount > 0
                    const isSelected   = wsTopic === t.topic
                    return (
                      <button key={t.id}
                        onClick={() => setWsTopic(t.topic)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all',
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white',
                        )}>
                        <div style={{ flex: 1 }}>
                          <p className={clsx('font-semibold text-sm', isSelected ? 'text-blue-800' : 'text-slate-800')}>
                            {t.topic}
                          </p>
                          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {taught ? `${sessionCount} session${sessionCount > 1 ? 's' : ''} taught` : 'Not yet taught'}
                          </p>
                        </div>
                        {taught
                          ? <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', isSelected ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}>
                              {sessionCount} session{sessionCount > 1 ? 's' : ''}
                            </span>
                          : <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', background: '#f1f5f9', borderRadius: 999, padding: '2px 8px' }}>Upcoming</span>}
                      </button>
                    )
                  })}
                  <input type="text" value={wsTopic} onChange={e => setWsTopic(e.target.value)}
                    placeholder="Or type a custom topic…" className="input-field"
                    style={{ marginTop: 4 }} />
                </div>
              )}
            </div>

            {/* Mark distribution templates */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 24px rgba(15,23,42,.07)' }}>
              <p className="label" style={{ marginBottom: 12 }}>Mark Distribution Template</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: wsDistribution.length > 0 ? 18 : 0 }}>
                {WS_TEMPLATES.map(t => (
                  <button key={t.name}
                    onClick={() => { setWsTemplate(t.name); setWsDistribution(t.dist.map(d => ({ ...d }))) }}
                    className={clsx('px-4 py-2.5 rounded-xl font-bold text-sm transition-colors', wsTemplate === t.name ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700')}>
                    {t.name} <span style={{ opacity: .65, fontSize: 11 }}>({t.totalLabel})</span>
                  </button>
                ))}
                <button
                  onClick={() => { setWsTemplate('custom'); setWsDistribution([{ type: 'mcq', count: 5, marksEach: 1 }]) }}
                  className={clsx('px-4 py-2.5 rounded-xl font-bold text-sm transition-colors', wsTemplate === 'custom' ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-700')}>
                  Custom
                </button>
              </div>

              {wsDistribution.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sections</p>
                  {wsDistribution.map((row, ri) => (
                    <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                      <select value={row.type}
                        onChange={e => setWsDistribution(d => d.map((r, i) => i === ri ? { ...r, type: e.target.value } : r))}
                        style={{ fontSize: 12, fontWeight: 700, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#334155', padding: '4px 8px', cursor: 'pointer' }}>
                        <option value="mcq">MCQ</option>
                        <option value="fill-in-blank">Fill in Blank</option>
                        <option value="short-answer">Short Answer</option>
                        <option value="long-answer">Long Answer</option>
                      </select>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>×</span>
                      <input type="number" min="1" max="30" value={row.count}
                        onChange={e => setWsDistribution(d => d.map((r, i) => i === ri ? { ...r, count: parseInt(e.target.value) || 1 } : r))}
                        style={{ width: 48, textAlign: 'center', fontSize: 13, fontWeight: 700, border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 6px', color: '#1e293b' }} />
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>q ·</span>
                      <input type="number" min="1" max="20" value={row.marksEach}
                        onChange={e => setWsDistribution(d => d.map((r, i) => i === ri ? { ...r, marksEach: parseInt(e.target.value) || 1 } : r))}
                        style={{ width: 48, textAlign: 'center', fontSize: 13, fontWeight: 700, border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 6px', color: '#1e293b' }} />
                      <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>
                        m each = <strong style={{ color: '#1d4ed8' }}>{row.count * row.marksEach}m</strong>
                      </span>
                      <button onClick={() => setWsDistribution(d => d.filter((_, i) => i !== ri))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, display: 'flex', alignItems: 'center' }}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {wsDistribution.length < 5 && (
                    <button onClick={() => setWsDistribution(d => [...d, { type: 'short-answer', count: 3, marksEach: 2 }])}
                      style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                      + Add Section
                    </button>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#1e293b', borderRadius: 12, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Total Marks</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                      {wsDistribution.reduce((s, r) => s + r.count * r.marksEach, 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Generate button */}
            <button onClick={generateWorksheet}
              disabled={!wsTopic.trim() || wsDistribution.length === 0 || wsGenerating}
              className="btn-primary w-full"
              style={{ opacity: (!wsTopic.trim() || wsDistribution.length === 0 || wsGenerating) ? 0.5 : 1 }}>
              {wsGenerating ? 'Generating Worksheet…' : '✨ Generate Worksheet'}
            </button>

            {/* Worksheet preview */}
            {wsPreview && (
              <>
                {/* ── Worksheet preview card ── */}
                <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 24px rgba(15,23,42,.07)' }}>
                  <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 900, color: '#1e293b' }}>{wsPreview.topic} — Worksheet</p>
                      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Total: {wsPreview.totalMarks} marks · {wsPreview.sections.length} sections</p>
                    </div>
                    <button onClick={() => {
                        sessionStorage.setItem('ws_draft', JSON.stringify({
                          topic: wsPreview.topic, subject: teacher?.subject ?? 'General',
                          grade: selectedClass?.grade ?? teacher?.grade ?? '',
                          className: selectedClass?.name, classId: selectedClassId || undefined,
                          template: wsTemplate ?? undefined, totalMarks: wsPreview.totalMarks,
                          sections: wsPreview.sections, initialAnswerKey: wsAnswerKey,
                        }))
                        router.push('/tests/worksheet')
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Printer size={13} /> Open Worksheet
                    </button>
                  </div>
                  <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ textAlign: 'center', paddingBottom: 16, borderBottom: '2px solid #1e293b' }}>
                      <p style={{ fontSize: 16, fontWeight: 900, color: '#1e293b' }}>
                        {teacher?.subject ?? 'General'} — Grade {selectedClass?.grade ?? teacher?.grade ?? ''}
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginTop: 4 }}>Topic: {wsPreview.topic}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: '#64748b' }}>
                        <span>Name: _______________________________</span>
                        <span>Roll No: __________</span>
                        <span>Total Marks: {wsPreview.totalMarks}</span>
                      </div>
                    </div>
                    {wsPreview.sections.map((section, si) => {
                      const prevCount = wsPreview.sections.slice(0, si).reduce((s, sec) => s + sec.questions.length, 0)
                      return (
                        <div key={si}>
                          <p style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 14, letterSpacing: '.03em' }}>
                            {section.label} &nbsp;
                            <span style={{ fontWeight: 500, color: '#64748b', fontSize: 12 }}>
                              ({section.marksEach} × {section.questions.length} = {section.marksEach * section.questions.length} marks)
                            </span>
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {section.questions.map((q, qi) => (
                              <div key={qi} style={{ display: 'flex', gap: 10 }}>
                                <span style={{ width: 24, fontWeight: 800, color: '#334155', fontSize: 13, flexShrink: 0, paddingTop: 1 }}>
                                  {prevCount + qi + 1}.
                                </span>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.75 }}>{q.text}</p>
                                  {section.type === 'mcq' && q.options && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginTop: 7 }}>
                                      {q.options.map((opt, oi) => (
                                        <p key={oi} style={{ fontSize: 12.5, color: '#475569' }}>{opt}</p>
                                      ))}
                                    </div>
                                  )}
                                  {section.type === 'short-answer' && <div style={{ borderBottom: '1px solid #cbd5e1', marginTop: 10, height: 22 }} />}
                                  {section.type === 'long-answer' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                      {[1, 2, 3].map(i => <div key={i} style={{ borderBottom: '1px solid #e2e8f0', height: 22 }} />)}
                                    </div>
                                  )}
                                  {section.type === 'fill-in-blank' && <div style={{ borderBottom: '1px solid #cbd5e1', marginTop: 6, height: 22, width: 180 }} />}
                                </div>
                                <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, paddingTop: 2 }}>[{section.marksEach}m]</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </>
            )}
          </div>
        )}

        {/* ── SUBJECTIVE TAB ── */}
        {testMode === 'subjective' && (<>

          {/* Total Marks */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 24px rgba(15,23,42,.07)' }}>
            <p className="label" style={{ marginBottom: 12 }}>Total Marks *</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['5', '10', '20', '25', '50', '100'].map(n => (
                <button key={n} onClick={() => setTotalMarks(n)}
                  className={clsx('flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors', totalMarks === n ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700')}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 24px rgba(15,23,42,.07)' }}>
            <p className="label" style={{ marginBottom: 12 }}>Topic *</p>
            {syllabus.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input type="text" value={customTopic} onChange={e => setCustomTopic(e.target.value)}
                  placeholder="e.g. Fractions, Photosynthesis…" className="input-field" />
                <p style={{ fontSize: 11, color: '#94a3b8' }}>No syllabus set up — type the topic directly.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {syllabus.map(t => {
                  const sessionCount = getTopicSessions(t.id).length
                  const taught       = sessionCount > 0
                  const isSelected   = topicId === t.id
                  const isBlocked    = blockedTopicId === t.id
                  return (
                    <div key={t.id}>
                      <button
                        onClick={() => {
                          if (!taught) { setBlockedTopicId(t.id); setTopicId('') }
                          else { setTopicId(t.id); setBlockedTopicId(''); setAiQuestions([]); setAiQOpen(false) }
                        }}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all',
                          isSelected ? 'border-blue-500 bg-blue-50' :
                          isBlocked  ? 'border-red-200 bg-red-50' :
                          !taught    ? 'border-slate-100 bg-slate-50 opacity-70' :
                                       'border-slate-200 bg-white',
                        )}>
                        <div style={{ flex: 1 }}>
                          <p className={clsx('font-semibold text-sm', isSelected ? 'text-blue-800' : !taught ? 'text-slate-400' : 'text-slate-800')}>
                            {t.topic}
                          </p>
                          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {taught ? `${sessionCount} session${sessionCount > 1 ? 's' : ''} taught` : 'No class recorded yet'}
                          </p>
                        </div>
                        {taught
                          ? <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', isSelected ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}>
                              {sessionCount} session{sessionCount > 1 ? 's' : ''}
                            </span>
                          : <Lock size={14} className="text-slate-300 shrink-0" />}
                      </button>
                      {isBlocked && (
                        <div className="mt-1 mx-1 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2">
                          <Lock size={13} className="text-red-400 shrink-0" />
                          <p style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>
                            This topic has not been taught yet — conduct a class first.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* AI Questions */}
          {topicId && aiQOpen && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 20, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={15} style={{ color: '#7c3aed' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#4c1d95' }}>Exam Questions — {selectedTopic?.topic}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!aiQLoading && aiQuestions.length > 0 && (
                    <button onClick={() => setPaperPreviewOpen(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#7c3aed', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, fontFamily: 'inherit' }}>
                      <FileText size={12} /> View as Paper
                    </button>
                  )}
                  {!aiQLoading && (
                    <button onClick={() => fetchAiQuestions()}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8 }} title="Regenerate">
                      <RefreshCw size={13} style={{ color: '#a78bfa' }} />
                    </button>
                  )}
                  <button onClick={() => setAiQOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8 }}>
                    <X size={14} style={{ color: '#a78bfa' }} />
                  </button>
                </div>
              </div>
              {aiQLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3,4,5].map(i => <div key={i} className="animate-pulse" style={{ height: 40, background: '#ede9fe', borderRadius: 12 }} />)}
                </div>
              )}
              {!aiQLoading && aiQuestions.length > 0 && (() => {
                type QType = 'mcq' | 'fill-in-blank' | 'short-answer' | 'long-answer'
                const TYPE_ORDER: QType[] = ['mcq', 'fill-in-blank', 'short-answer', 'long-answer']
                const SECTION_META: Record<QType, { label: string; letter: string; badge: string; border: string }> = {
                  'mcq':           { label: 'Multiple Choice',   letter: 'A', badge: 'bg-blue-100 text-blue-700',     border: 'border-blue-200' },
                  'fill-in-blank': { label: 'Fill in the Blank', letter: 'B', badge: 'bg-green-100 text-green-700',   border: 'border-green-200' },
                  'short-answer':  { label: 'Short Answer',      letter: 'C', badge: 'bg-amber-100 text-amber-700',  border: 'border-amber-200' },
                  'long-answer':   { label: 'Long Answer',       letter: 'D', badge: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
                }
                const groups2: Record<QType, typeof aiQuestions> = { mcq: [], 'fill-in-blank': [], 'short-answer': [], 'long-answer': [] }
                aiQuestions.forEach(q => { if (q.type && groups2[q.type as QType]) groups2[q.type as QType].push(q) })
                let globalIdx = 0
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                    {TYPE_ORDER.map(type => {
                      const section = groups2[type]
                      if (section.length === 0) return null
                      const meta = SECTION_META[type]
                      return (
                        <div key={type} className={`rounded-xl border ${meta.border} overflow-hidden`}>
                          <div className={`flex items-center justify-between px-3 py-2 ${meta.badge}`}>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-white text-xs font-black flex items-center justify-center">{meta.letter}</span>
                              <span className="text-xs font-bold">{meta.label}</span>
                              <span className="text-xs opacity-70">{section.length} × {section[0].marks}m</span>
                            </div>
                            <span className="text-xs font-bold">{section.reduce((s, q) => s + q.marks, 0)} marks</span>
                          </div>
                          <div className="divide-y divide-slate-100 bg-white">
                            {section.map(q => {
                              const idx = ++globalIdx
                              return (
                                <div key={idx} className="px-3 py-2.5 space-y-2">
                                  <div className="flex items-start gap-2">
                                    <span className="w-5 h-5 bg-violet-600 text-white rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{idx}</span>
                                    <p className="text-sm text-slate-700 leading-relaxed">{q.text}</p>
                                  </div>
                                  {type === 'mcq' && q.options && (
                                    <div className="grid grid-cols-2 gap-1 ml-7">
                                      {q.options.map((opt, oi) => (
                                        <div key={oi} className={clsx('text-xs px-2 py-1 rounded-lg border', opt.startsWith(q.answer) ? 'bg-green-50 border-green-300 text-green-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600')}>{opt}</div>
                                      ))}
                                    </div>
                                  )}
                                  {type === 'fill-in-blank' && q.answer && (
                                    <div className="flex items-center gap-2 ml-7">
                                      <span className="text-xs text-slate-400">Answer:</span>
                                      <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg">{q.answer}</span>
                                    </div>
                                  )}
                                  {type === 'short-answer' && q.keywords && (
                                    <div className="flex flex-wrap gap-1 ml-7">
                                      {q.keywords.map((kw, ki) => <span key={ki} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{kw}</span>)}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 ml-7">
                                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', DIFF_COLOR[q.difficulty])}>{q.difficulty}</span>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{q.marks}m</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    <p style={{ fontSize: 11, color: '#a78bfa' }}>Reference only · Total: {aiQuestions.reduce((s, q) => s + (q.marks ?? 0), 0)} marks</p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Exam Type */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 24px rgba(15,23,42,.07)' }}>
            <p className="label" style={{ marginBottom: 12 }}>Exam Type</p>
            <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#f1f5f9', marginBottom: 14 }}>
              {(['unit', 'term'] as const).map(type => (
                <button key={type} onClick={() => setExamType(type)}
                  className={clsx('flex-1 py-2.5 text-sm font-bold rounded-xl transition-all', examType === type ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}>
                  {type === 'unit' ? 'Unit Exam' : 'Term Exam'}
                </button>
              ))}
            </div>
            {examType === 'term' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {['Term 1', 'Term 2', 'Term 3'].map(t => (
                  <button key={t} onClick={() => setSelectedTerm(t)}
                    className={clsx('flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors', selectedTerm === t ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-700')}>
                    {t}
                  </button>
                ))}
              </div>
            )}
            {examType === 'unit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Unit Number</p>
                  <input type="number" min="1" value={unitNumber} onChange={e => setUnitNumber(e.target.value)} placeholder="e.g. 7" className="input-field" />
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Unit Name / Topic <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></p>
                  <input type="text" value={unitTopic} onChange={e => setUnitTopic(e.target.value)} placeholder="e.g. Forces and Motion, Algebra…" className="input-field" />
                </div>
              </div>
            )}
          </div>

          {/* Date */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 24px rgba(15,23,42,.07)' }}>
            <p className="label" style={{ marginBottom: 12 }}>Date</p>
            <input type="date" value={conductedOn} onChange={e => setConductedOn(e.target.value)} className="input-field" />
          </div>

          {/* Save */}
          <button onClick={handleCreateTest} disabled={!effectiveTopic || saving}
            className="btn-primary w-full"
            style={{ opacity: !effectiveTopic || saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save Test'}
          </button>
        </>)}
        </div>

      {/* ── Question Paper Preview Modal ── */}
      {paperPreviewOpen && aiQuestions.length > 0 && (() => {
        type QType = 'mcq' | 'fill-in-blank' | 'short-answer' | 'long-answer'
        const SECTIONS: { type: QType; letter: string; heading: string }[] = [
          { type: 'mcq',           letter: 'A', heading: 'Multiple Choice Questions' },
          { type: 'fill-in-blank', letter: 'B', heading: 'Fill in the Blanks'        },
          { type: 'short-answer',  letter: 'C', heading: 'Short Answer Questions'    },
          { type: 'long-answer',   letter: 'D', heading: 'Long Answer Questions'     },
        ]
        const grouped: Record<QType, AiQuestion[]> = { mcq: [], 'fill-in-blank': [], 'short-answer': [], 'long-answer': [] }
        aiQuestions.forEach(q => { if (q.type && grouped[q.type as QType]) grouped[q.type as QType].push(q) })
        const paperTopic   = effectiveTopic || 'Topic'
        const paperClass   = selectedClass?.name ?? 'Class'
        const paperSubject = teacher?.subject ?? 'Subject'
        const paperMarks   = totalMarks
        const paperDate    = new Date(conductedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        let qNum = 0
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px' }}>
            <div style={{ background: '#fff', width: '100%', maxWidth: 760, borderRadius: 6, boxShadow: '0 8px 48px rgba(0,0,0,.35)', fontFamily: 'Georgia, "Times New Roman", serif', color: '#111' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '6px 6px 0 0' }}>
                <span style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, color: '#475569' }}>Question Paper Preview</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => window.print()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer' }}>
                    <Printer size={13} /> Print
                  </button>
                  <button onClick={() => setPaperPreviewOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: '#fee2e2', cursor: 'pointer' }}>
                    <X size={15} style={{ color: '#dc2626' }} />
                  </button>
                </div>
              </div>
              <div style={{ padding: '40px 52px 48px' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 14, marginBottom: 18 }}>
                  <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Examination</p>
                  <p style={{ fontSize: 14, color: '#333', marginBottom: 6 }}>{paperSubject} — {paperClass}</p>
                  <p style={{ fontSize: 13, color: '#555' }}>{paperTopic}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, fontSize: 12.5 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, minWidth: 64 }}>Name:</span>
                    <span style={{ flex: 1, borderBottom: '1px solid #555' }}>&nbsp;</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, minWidth: 64 }}>Roll No.:</span>
                    <span style={{ flex: 1, borderBottom: '1px solid #555' }}>&nbsp;</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, minWidth: 64 }}>Date:</span>
                    <span>{paperDate}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, minWidth: 64 }}>Total Marks:</span>
                    <span>{paperMarks}</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#444', marginBottom: 24, fontStyle: 'italic' }}>
                  Instructions: Answer all questions. Write clearly and legibly.
                </p>
                {SECTIONS.map(sec => {
                  const qs = grouped[sec.type]
                  if (!qs.length) return null
                  const secMarks = qs.reduce((s, q) => s + (q.marks ?? 0), 0)
                  return (
                    <div key={sec.type} style={{ marginBottom: 28 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 14 }}>
                        Section {sec.letter}: {sec.heading}
                        <span style={{ fontWeight: 400, fontSize: 12, color: '#555', marginLeft: 8 }}>({secMarks} marks)</span>
                      </p>
                      {qs.map(q => {
                        qNum++
                        return (
                          <div key={qNum} style={{ marginBottom: 16, pageBreakInside: 'avoid' as const }}>
                            <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: sec.type === 'mcq' ? 6 : 0 }}>
                              <span style={{ fontWeight: 700 }}>{qNum}.</span>&nbsp;{q.text}
                              <span style={{ fontSize: 11, color: '#777', marginLeft: 8 }}>({q.marks ?? 1} mark{(q.marks ?? 1) !== 1 ? 's' : ''})</span>
                            </p>
                            {sec.type === 'mcq' && q.options && (
                              <div style={{ paddingLeft: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px', fontSize: 12.5 }}>
                                {q.options.map((opt, oi) => (
                                  <p key={oi}>({String.fromCharCode(65 + oi)}) {opt}</p>
                                ))}
                              </div>
                            )}
                            {sec.type === 'fill-in-blank' && (
                              <div style={{ paddingLeft: 22 }}>
                                <span style={{ display: 'inline-block', width: 180, borderBottom: '1px solid #555' }}>&nbsp;</span>
                              </div>
                            )}
                            {(sec.type === 'short-answer' || sec.type === 'long-answer') && (
                              <div style={{ marginTop: 6, paddingLeft: 22 }}>
                                {Array.from({ length: sec.type === 'long-answer' ? 6 : 3 }).map((_, li) => (
                                  <div key={li} style={{ borderBottom: '1px solid #ddd', height: 22, marginBottom: 4 }} />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                <div style={{ borderTop: '1px solid #ccc', marginTop: 8, paddingTop: 10, textAlign: 'right', fontSize: 11.5, color: '#666' }}>
                  Total Questions: {aiQuestions.length} &nbsp;|&nbsp; Total Marks: {aiQuestions.reduce((s, q) => s + (q.marks ?? 0), 0)}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      </div>
    )
  }

  // ── STEP: ENTER MARKS ─────────────────────────────────────────────────────

  if (step === 'enter-marks' && currentTest) {
    return (
      <div style={{ background: '#f1f5f9', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #07153a 0%, #1d4ed8 100%)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => { setStep('list'); setCurrentTestId('') }}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowLeft size={18} color="#fff" />
            </button>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-.3px', lineHeight: 1 }}>{currentTest.topic}</h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>
                {new Date(currentTest.conductedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' · '}Out of {currentTest.totalMarks}
                {currentTest.term ? ` · ${currentTest.term}` : ''}
              </p>
            </div>
            {syncing && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>
                <RefreshCw size={11} className="animate-spin" /> Syncing…
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Question paper reference */}
          {currentTest.questions && currentTest.questions.length > 0 && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
                <button type="button" onClick={() => setPaperOpen(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <Sparkles size={14} style={{ color: '#7c3aed' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#4c1d95' }}>Question Paper · {currentTest.questions.length} questions</span>
                  {paperOpen ? <ChevronUp size={15} style={{ color: '#a78bfa' }} /> : <ChevronDown size={15} style={{ color: '#a78bfa' }} />}
                </button>
                <button type="button" onClick={() => setPrintPaperOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8 }}>
                  <Printer size={12} /> Print Paper
                </button>
              </div>
              {paperOpen && (
                <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {currentTest.questions.map((q, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', border: '1px solid #ede9fe' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ width: 20, height: 20, background: '#7c3aed', color: '#fff', borderRadius: '50%', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, color: '#334155' }}>{q.text}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', DIFF_COLOR[q.difficulty])}>{q.difficulty}</span>
                            {q.marks != null && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{q.marks}m</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#a78bfa', paddingTop: 4 }}>Total: {currentTest.questions.reduce((s, q) => s + (q.marks ?? 0), 0)} marks</p>
                </div>
              )}
            </div>
          )}

          <MarkEntry
            students={classStudents}
            totalMarks={currentTest.totalMarks}
            topic={currentTest.topic}
            questions={currentTest.questions}
            prefillScores={marks
              .filter(m => m.testId === currentTestId)
              .map(m => ({ studentId: m.studentId, score: m.score, feedback: m.feedback, source: m.source, breakdown: m.breakdown, imageUrl: m.imageUrl }))}
            onSave={handleSaveMarks}
            onCancel={() => { setStep('list'); setCurrentTestId('') }}
          />
        </div>

        {/* ── Print paper modal ─────────────────────────────────────────────── */}
        {printPaperOpen && currentTest.questions && currentTest.questions.length > 0 && (() => {
          type QType = 'mcq' | 'fill-in-blank' | 'short-answer' | 'long-answer'
          const SECTIONS: { type: QType; letter: string; heading: string }[] = [
            { type: 'mcq',           letter: 'A', heading: 'Multiple Choice Questions' },
            { type: 'fill-in-blank', letter: 'B', heading: 'Fill in the Blanks'        },
            { type: 'short-answer',  letter: 'C', heading: 'Short Answer Questions'    },
            { type: 'long-answer',   letter: 'D', heading: 'Long Answer Questions'     },
          ]
          const grouped: Record<QType, AiQuestion[]> = { mcq: [], 'fill-in-blank': [], 'short-answer': [], 'long-answer': [] }
          ;(currentTest.questions ?? []).forEach(q => { if (q.type && grouped[q.type as QType]) grouped[q.type as QType].push(q) })
          const testClass   = myClasses.find(c => c.id === currentTest.classId)
          const paperDate   = new Date(currentTest.conductedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
          let qNum = 0
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px' }}>
              <div style={{ background: '#fff', width: '100%', maxWidth: 760, borderRadius: 6, boxShadow: '0 8px 48px rgba(0,0,0,.35)', fontFamily: 'Georgia, "Times New Roman", serif', color: '#111' }}>
                {/* Toolbar */}
                <div className="ws-no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '6px 6px 0 0' }}>
                  <span style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, color: '#475569' }}>Question Paper — {currentTest.topic}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => window.print()}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer' }}>
                      <Printer size={13} /> Print
                    </button>
                    <button onClick={() => setPrintPaperOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: '#fee2e2', cursor: 'pointer' }}>
                      <X size={15} style={{ color: '#dc2626' }} />
                    </button>
                  </div>
                </div>
                {/* Paper body */}
                <div style={{ padding: '40px 52px 48px' }}>
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 14, marginBottom: 18 }}>
                    <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Examination</p>
                    <p style={{ fontSize: 14, color: '#333', marginBottom: 6 }}>{currentTest.subject}{testClass ? ` — ${testClass.name}` : ''}</p>
                    <p style={{ fontSize: 13, color: '#555' }}>{currentTest.topic}{currentTest.term ? ` · ${currentTest.term}` : ''}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, fontSize: 12.5 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, minWidth: 64 }}>Name:</span>
                      <span style={{ flex: 1, borderBottom: '1px solid #555' }}>&nbsp;</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, minWidth: 64 }}>Roll No.:</span>
                      <span style={{ flex: 1, borderBottom: '1px solid #555' }}>&nbsp;</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, minWidth: 64 }}>Date:</span>
                      <span>{paperDate}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, minWidth: 64 }}>Total Marks:</span>
                      <span>{currentTest.totalMarks}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#444', marginBottom: 24, fontStyle: 'italic' }}>
                    Instructions: Answer all questions. Write clearly and legibly.
                  </p>
                  {SECTIONS.map(sec => {
                    const qs = grouped[sec.type]
                    if (!qs.length) return null
                    const secMarks = qs.reduce((s, q) => s + (q.marks ?? 0), 0)
                    return (
                      <div key={sec.type} style={{ marginBottom: 28 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 14 }}>
                          Section {sec.letter}: {sec.heading}
                          <span style={{ fontWeight: 400, fontSize: 12, color: '#555', marginLeft: 8 }}>({secMarks} marks)</span>
                        </p>
                        {qs.map(q => {
                          qNum++
                          return (
                            <div key={qNum} style={{ marginBottom: 16, pageBreakInside: 'avoid' as const }}>
                              <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: sec.type === 'mcq' ? 6 : 0 }}>
                                <span style={{ fontWeight: 700 }}>{qNum}.</span>&nbsp;{q.text}
                                <span style={{ fontSize: 11, color: '#777', marginLeft: 8 }}>({q.marks ?? 1} mark{(q.marks ?? 1) !== 1 ? 's' : ''})</span>
                              </p>
                              {sec.type === 'mcq' && q.options && (
                                <div style={{ paddingLeft: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px', fontSize: 12.5 }}>
                                  {q.options.map((opt, oi) => <p key={oi}>({String.fromCharCode(65 + oi)}) {opt}</p>)}
                                </div>
                              )}
                              {sec.type === 'fill-in-blank' && (
                                <div style={{ paddingLeft: 22 }}>
                                  <span style={{ display: 'inline-block', width: 180, borderBottom: '1px solid #555' }}>&nbsp;</span>
                                </div>
                              )}
                              {(sec.type === 'short-answer' || sec.type === 'long-answer') && (
                                <div style={{ marginTop: 6, paddingLeft: 22 }}>
                                  {Array.from({ length: sec.type === 'long-answer' ? 6 : 3 }).map((_, li) => (
                                    <div key={li} style={{ borderBottom: '1px solid #ddd', height: 22, marginBottom: 4 }} />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                  <div style={{ borderTop: '1px solid #ccc', marginTop: 8, paddingTop: 10, textAlign: 'right', fontSize: 11.5, color: '#666' }}>
                    Total Questions: {currentTest.questions.length} &nbsp;|&nbsp; Total Marks: {currentTest.totalMarks}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  // ── STEP: WORKSHEET MARKS ─────────────────────────────────────────────────

  if (step === 'worksheet-marks' && currentWorksheetId) {
    const ws = worksheets.find(w => w.id === currentWorksheetId)
    const wsStudents = selectedClassId ? getClassStudents(selectedClassId) : []
    return (
      <div style={{ background: '#f1f5f9', minHeight: '100vh' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => { setStep('list'); setCurrentWorksheetId('') }}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowLeft size={18} color="#fff" />
            </button>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-.3px', lineHeight: 1 }}>{ws?.topic ?? 'Worksheet'}</h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>
                Worksheet · Out of {ws?.totalMarks ?? '?'}
              </p>
            </div>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {wsMarksLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <RefreshCw size={24} style={{ color: '#7c3aed' }} className="animate-spin" />
            </div>
          ) : (
            <MarkEntry
              students={wsStudents}
              totalMarks={ws?.totalMarks ?? 0}
              topic={ws?.topic ?? 'Worksheet'}
              prefillScores={wsMarksData}
              onSave={handleSaveWorksheetMarks}
              onCancel={() => { setStep('list'); setCurrentWorksheetId('') }}
            />
          )}
        </div>
      </div>
    )
  }

  // ── STEP: LIST ────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #07153a 0%, #1d4ed8 100%)', padding: '36px 32px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '26px 26px', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Tests &amp; Marks</p>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-.6px', lineHeight: 1.1 }}>
              {totalTests} Test{totalTests !== 1 ? 's' : ''}
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginTop: 6, fontWeight: 500 }}>
              {pendingCount > 0 ? `${pendingCount} with marks still pending` : totalTests > 0 ? 'All marks entered' : 'No tests yet'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              onClick={async () => { setSyncing(true); await forceSync(); setSyncing(false) }}
              disabled={syncing || syncStatus === 'offline'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.7)', border: 'none', borderRadius: 12, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: syncing || syncStatus === 'offline' ? 0.5 : 1 }}>
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Refresh'}
            </button>
            <button onClick={handleNewTest}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', color: '#1d4ed8', fontWeight: 800, fontSize: 14, padding: '11px 22px', borderRadius: 16, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,.2)' }}>
              <Plus size={16} strokeWidth={2.5} /> New Test
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 28px 48px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {myClasses.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 2px 24px rgba(15,23,42,.07)', padding: '72px 20px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <BookOpen size={28} style={{ color: '#2563eb' }} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>No classes yet</p>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, lineHeight: 1.6 }}>Create a class first, then you can add tests.</p>
            <button onClick={() => setCreateClassOpen(true)}
              style={{ marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)', color: '#fff', fontWeight: 800, fontSize: 14, padding: '12px 28px', borderRadius: 14, border: 'none', cursor: 'pointer' }}>
              <Plus size={15} /> Create Class
            </button>
          </div>

        ) : totalTests === 0 ? (
          <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 2px 24px rgba(15,23,42,.07)', padding: '72px 20px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <PenLine size={26} style={{ color: '#d97706' }} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>No tests yet</p>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, lineHeight: 1.6, maxWidth: 300, margin: '6px auto 0' }}>Create your first test to start entering marks.</p>
            <button onClick={handleNewTest}
              style={{ marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)', color: '#fff', fontWeight: 800, fontSize: 14, padding: '12px 28px', borderRadius: 14, border: 'none', cursor: 'pointer', boxShadow: '0 3px 12px rgba(37,99,235,.35)' }}>
              <Plus size={15} /> Create First Test
            </button>
          </div>

        ) : (
          groups.filter(g => g.classTests.length > 0).map(({ cls, classTests, revisionTopics, accentIdx }) => (
            <div key={cls.id}>

              {/* Class header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: CLASS_ACCENT[accentIdx % CLASS_ACCENT.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GraduationCap size={15} color="#fff" />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{cls.name}</span>
                  {cls.section && <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>· {cls.section}</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 9px', borderRadius: 20 }}>
                    {classTests.length} test{classTests.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button onClick={() => { setSelectedClassId(cls.id); resetForm(); setStep('new-test') }}
                  style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '5px 13px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                  + New Test
                </button>
              </div>

              {/* Revision needed banner */}
              {revisionTopics.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: '12px 16px', marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#92400e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Revision needed</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {revisionTopics.map(({ topic, avg }) => (
                      <div key={topic} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: '#fde68a', borderRadius: 99, height: 6 }}>
                          <div style={{ height: 6, borderRadius: 99, background: '#d97706', width: `${Math.round(avg * 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#78350f', width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{topic}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', width: 32, textAlign: 'right' }}>{Math.round(avg * 100)}%</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: '#d97706', marginTop: 6 }}>Class average below 65% — focus here</p>
                </div>
              )}

              {/* Test list */}
              <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 2px 24px rgba(15,23,42,.07)', overflow: 'hidden' }}>
                {classTests.map((t, ti) => {
                  const allDone    = t.allDone
                  const started    = t.started
                  const isOpen     = analysisTestId === t.id
                  const analysis   = analysisData[t.id]
                  const badgeBg    = allDone ? '#ecfdf5' : started ? '#eff6ff' : '#fffbeb'
                  const badgeColor = allDone ? '#059669' : started ? '#2563eb' : '#d97706'
                  const statusLabel = allDone ? 'Done' : started ? 'In progress' : 'Marks pending'

                  // Question-level analysis from scanner breakdown
                  const questionStats = (() => {
                    const testMarks = marks.filter(m => m.testId === t.id && m.breakdown && m.breakdown.length > 0)
                    if (testMarks.length === 0) return null
                    const qMap = new Map<number, { total: number; wrong: number; errorCounts: Record<string, number>; max: number }>()
                    for (const mark of testMarks) {
                      for (const b of mark.breakdown!) {
                        if (!qMap.has(b.question)) qMap.set(b.question, { total: 0, wrong: 0, errorCounts: {}, max: b.max })
                        const q = qMap.get(b.question)!
                        q.total++
                        if (b.awarded < b.max) { q.wrong++; const et = b.errorType ?? 'unknown'; q.errorCounts[et] = (q.errorCounts[et] ?? 0) + 1 }
                      }
                    }
                    return Array.from(qMap.entries())
                      .map(([qNum, s]) => ({ qNum, wrongPct: Math.round((s.wrong / s.total) * 100), wrong: s.wrong, total: s.total, dominant: (Object.entries(s.errorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as 'conceptual' | 'procedural' | 'careless' | null }))
                      .filter(q => q.wrongPct >= 30).sort((a, b) => b.wrongPct - a.wrongPct).slice(0, 8)
                  })()

                  return (
                    <div key={t.id} style={{ borderBottom: ti < classTests.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <button type="button"
                        onClick={() => openEnterMarks(cls.id, t.id)}
                        className="active:bg-slate-50 transition-colors"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 13, background: allDone ? '#ecfdf5' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <PenLine size={18} style={{ color: allDone ? '#059669' : '#d97706' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{t.topic}</p>
                          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                            {new Date(t.conductedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {t.term ? ` · ${t.term}` : ''}
                            {' · '}{t.totalMarks} marks
                            {(allDone || started) ? ` · ${t.enteredCount}/${t.total} entered` : ''}
                          </p>
                          {/* AI-scanned indicator */}
                          {(() => {
                            const aiCount = marks.filter(m => m.testId === t.id && m.source === 'ai_scanned').length
                            if (aiCount === 0) return null
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: 99, marginTop: 4 }}>
                                🤖 {aiCount} AI-graded · tap to review
                              </span>
                            )
                          })()}
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 20, flexShrink: 0, background: badgeBg, color: badgeColor }}>
                          {statusLabel}
                        </span>
                        <ChevronRight size={15} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                      </button>

                      {/* Analyse Class button — only for completed tests */}
                      {allDone && (
                        <div style={{ padding: '0 18px 10px' }}>
                          <button type="button" onClick={() => fetchAnalysis(cls.id, t.id)}
                            className={clsx('w-full flex items-center justify-center gap-2 py-2 rounded-2xl text-xs font-bold transition-all', isOpen ? 'bg-violet-100 text-violet-700' : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-violet-50 hover:text-violet-600')}>
                            <Sparkles size={12} />
                            {isOpen ? 'Hide Analysis' : 'Analyse Class'}
                            {analysisLoading && isOpen && <RefreshCw size={11} className="animate-spin" />}
                          </button>
                        </div>
                      )}

                      {/* Analysis panel */}
                      {isOpen && (
                        <div style={{ margin: '0 18px 12px', background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 16, padding: '16px' }}>
                          {!analysis && analysisLoading && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {[1,2,3,4].map(i => <div key={i} className="animate-pulse" style={{ height: 16, background: '#ede9fe', borderRadius: 8 }} />)}
                            </div>
                          )}
                          {!analysis && !analysisLoading && (
                            <p style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center' }}>Could not load analysis — tap Analyse Class to retry</p>
                          )}
                          {analysis && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <p style={{ fontSize: 12, color: '#334155', lineHeight: 1.65 }}>{analysis.summary}</p>
                              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '10px 14px' }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Top Performers</p>
                                <p style={{ fontSize: 12, color: '#065f46', lineHeight: 1.5 }}>{analysis.topPerformers}</p>
                              </div>
                              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Needs Help</p>
                                <p style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>{analysis.needHelp}</p>
                              </div>
                              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '10px 14px' }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Next Action</p>
                                <p style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>{analysis.action}</p>
                              </div>
                            </div>
                          )}

                          {/* Question-level stats from scanner */}
                          {questionStats && questionStats.length > 0 && (
                            <div style={{ marginTop: 12, background: '#fff', border: '1px solid #ede9fe', borderRadius: 12, padding: '12px 14px' }}>
                              <p style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                                Questions Most Students Got Wrong
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {questionStats.map(q => {
                                  const ec = q.dominant === 'conceptual' ? 'bg-red-100 text-red-700' : q.dominant === 'procedural' ? 'bg-amber-100 text-amber-700' : q.dominant === 'careless' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                  const rec = q.dominant === 'conceptual' ? 'Re-explain core concept from scratch' : q.dominant === 'procedural' ? 'Show a worked example step by step' : q.dominant === 'careless' ? 'Quick drill — they understand but need practice' : 'Review this question with the class'
                                  return (
                                    <div key={q.qNum}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', flexShrink: 0 }}>Q{q.qNum}</span>
                                        <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                                          <div style={{ height: 8, borderRadius: 99, background: q.wrongPct >= 70 ? '#ef4444' : q.wrongPct >= 50 ? '#f59e0b' : '#8b5cf6', width: `${q.wrongPct}%` }} />
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', width: 36, textAlign: 'right', flexShrink: 0 }}>{q.wrongPct}%</span>
                                        {q.dominant && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${ec}`}>{q.dominant}</span>}
                                      </div>
                                      <p style={{ fontSize: 10, color: '#64748b', marginTop: 3, paddingLeft: 28 }}>{rec}</p>
                                    </div>
                                  )
                                })}
                              </div>
                              <p style={{ fontSize: 10, color: '#a78bfa', marginTop: 8 }}>Showing questions where 30%+ students lost marks · {questionStats[0]?.total ?? 0} papers scanned</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Class picker modal */}
      {classPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}
          onClick={() => setClassPicker(false)}>
          <div style={{ background: '#fff', borderRadius: 24, padding: '28px 24px', width: 380, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 32px 80px rgba(0,0,0,.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>Which class?</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Select a class to create the test in</p>
              </div>
              <button onClick={() => setClassPicker(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={15} style={{ color: '#64748b' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myClasses.map((cls, gi) => {
                const sc = students.filter(s => s.classId === cls.id && s.isActive).length
                return (
                  <button key={cls.id} onClick={() => pickClass(cls.id)}
                    className="hover:bg-slate-50 transition-colors"
                    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 16, border: '1.5px solid #f1f5f9', background: '#fafafa', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: CLASS_ACCENT[gi % CLASS_ACCENT.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>{cls.grade}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{cls.name}{cls.section ? ` · ${cls.section}` : ''}</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sc} student{sc !== 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight size={15} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Saved Worksheets ── */}
      {worksheets.length > 0 && (
        <div style={{ padding: '0 28px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <FileText size={16} style={{ color: '#2563eb' }} />
            <p style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Saved Worksheets</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', borderRadius: 999, padding: '2px 10px' }}>{worksheets.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {worksheets.map(ws => {
              const cls = myClasses.find(c => c.id === ws.classId)
              const hasKey = Object.keys(ws.answerKey).length > 0
              return (
                <div key={ws.id} style={{ background: '#fff', borderRadius: 18, padding: '16px 20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 8px rgba(15,23,42,.05)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={20} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ws.topic}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                      {cls && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{cls.name}</span>}
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Grade {ws.grade}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>·</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{ws.totalMarks} marks</span>
                      {ws.template && <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', borderRadius: 999, padding: '1px 8px' }}>{ws.template}</span>}
                      {hasKey && <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', borderRadius: 999, padding: '1px 8px' }}>✓ Key</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {ws.classId && (
                      <button onClick={() => void openWorksheetMarks(ws.classId!, ws.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <GraduationCap size={13} /> Scores
                      </button>
                    )}
                    <button onClick={() => {
                      sessionStorage.setItem('ws_draft', JSON.stringify({
                        topic: ws.topic, subject: ws.subject, grade: ws.grade,
                        className: cls?.name, classId: ws.classId,
                        template: ws.template, totalMarks: ws.totalMarks,
                        sections: ws.sections, initialAnswerKey: ws.answerKey,
                        savedId: ws.id,
                      }))
                      router.push('/tests/worksheet')
                    }} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Printer size={13} /> Open
                    </button>
                    <button onClick={() => removeWorksheet(ws.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: '#fef2f2', color: '#dc2626' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <CreateClassModal open={createClassOpen} onClose={() => setCreateClassOpen(false)} />

      {/* ── Question Paper Preview Modal ── */}
      {paperPreviewOpen && aiQuestions.length > 0 && (() => {
        type QType = 'mcq' | 'fill-in-blank' | 'short-answer' | 'long-answer'
        const SECTIONS: { type: QType; letter: string; heading: string }[] = [
          { type: 'mcq',           letter: 'A', heading: 'Multiple Choice Questions' },
          { type: 'fill-in-blank', letter: 'B', heading: 'Fill in the Blanks'        },
          { type: 'short-answer',  letter: 'C', heading: 'Short Answer Questions'    },
          { type: 'long-answer',   letter: 'D', heading: 'Long Answer Questions'     },
        ]
        const grouped: Record<QType, AiQuestion[]> = { mcq: [], 'fill-in-blank': [], 'short-answer': [], 'long-answer': [] }
        aiQuestions.forEach(q => { if (q.type && grouped[q.type as QType]) grouped[q.type as QType].push(q) })
        const paperTopic   = effectiveTopic || 'Topic'
        const paperClass   = selectedClass?.name ?? 'Class'
        const paperSubject = teacher?.subject ?? 'Subject'
        const paperMarks   = totalMarks
        const paperDate    = new Date(conductedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        let qNum = 0

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px' }}>
            <div style={{ background: '#fff', width: '100%', maxWidth: 760, borderRadius: 6, boxShadow: '0 8px 48px rgba(0,0,0,.35)', fontFamily: 'Georgia, "Times New Roman", serif', color: '#111' }}>
              {/* toolbar (hidden in print) */}
              <div className="ws-no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '6px 6px 0 0' }}>
                <span style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, color: '#475569' }}>Question Paper Preview</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => window.print()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer' }}>
                    <Printer size={13} /> Print
                  </button>
                  <button onClick={() => setPaperPreviewOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: '#fee2e2', cursor: 'pointer' }}>
                    <X size={15} style={{ color: '#dc2626' }} />
                  </button>
                </div>
              </div>

              {/* paper body */}
              <div style={{ padding: '40px 52px 48px' }}>
                {/* school header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 14, marginBottom: 18 }}>
                  <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Examination</p>
                  <p style={{ fontSize: 14, color: '#333', marginBottom: 6 }}>{paperSubject} &mdash; {paperClass}</p>
                  <p style={{ fontSize: 13, color: '#555' }}>{paperTopic}</p>
                </div>

                {/* candidate info row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, fontSize: 12.5 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, minWidth: 64 }}>Name:</span>
                    <span style={{ flex: 1, borderBottom: '1px solid #555' }}>&nbsp;</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, minWidth: 64 }}>Roll No.:</span>
                    <span style={{ flex: 1, borderBottom: '1px solid #555' }}>&nbsp;</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, minWidth: 64 }}>Date:</span>
                    <span>{paperDate}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, minWidth: 64 }}>Total Marks:</span>
                    <span>{paperMarks}</span>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: '#444', marginBottom: 24, fontStyle: 'italic' }}>
                  Instructions: Answer all questions. Write clearly and legibly.
                </p>

                {/* question sections */}
                {SECTIONS.map(sec => {
                  const qs = grouped[sec.type]
                  if (!qs.length) return null
                  const secMarks = qs.reduce((s, q) => s + (q.marks ?? 0), 0)
                  return (
                    <div key={sec.type} style={{ marginBottom: 28 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 14 }}>
                        Section {sec.letter}: {sec.heading}
                        <span style={{ fontWeight: 400, fontSize: 12, color: '#555', marginLeft: 8 }}>({secMarks} marks)</span>
                      </p>
                      {qs.map(q => {
                        qNum++
                        return (
                          <div key={qNum} style={{ marginBottom: 16, pageBreakInside: 'avoid' }}>
                            <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: sec.type === 'mcq' ? 6 : 0 }}>
                              <span style={{ fontWeight: 700 }}>{qNum}.</span>&nbsp;{q.text}
                              <span style={{ fontSize: 11, color: '#777', marginLeft: 8 }}>({q.marks ?? 1} mark{(q.marks ?? 1) !== 1 ? 's' : ''})</span>
                            </p>
                            {sec.type === 'mcq' && q.options && (
                              <div style={{ paddingLeft: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px', fontSize: 12.5 }}>
                                {q.options.map((opt, oi) => (
                                  <p key={oi}>({String.fromCharCode(65 + oi)}) {opt}</p>
                                ))}
                              </div>
                            )}
                            {sec.type === 'fill-in-blank' && (
                              <div style={{ paddingLeft: 22 }}>
                                <span style={{ display: 'inline-block', width: 180, borderBottom: '1px solid #555' }}>&nbsp;</span>
                              </div>
                            )}
                            {(sec.type === 'short-answer' || sec.type === 'long-answer') && (
                              <div style={{ marginTop: 6, paddingLeft: 22 }}>
                                {Array.from({ length: sec.type === 'long-answer' ? 6 : 3 }).map((_, li) => (
                                  <div key={li} style={{ borderBottom: '1px solid #ddd', height: 22, marginBottom: 4 }} />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                <div style={{ borderTop: '1px solid #ccc', marginTop: 8, paddingTop: 10, textAlign: 'right', fontSize: 11.5, color: '#666' }}>
                  Total Questions: {aiQuestions.length} &nbsp;|&nbsp; Total Marks: {aiQuestions.reduce((s, q) => s + (q.marks ?? 0), 0)}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
