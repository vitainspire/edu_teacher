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
import QuestionPaperModal from '@/components/marks/QuestionPaperModal'
import CreateClassModal from '@/components/classes/CreateClassModal'
import { aiKey, getAiCache, setAiCache, TTL } from '@/lib/ai-cache'
import type { AiQuestion } from '@/lib/types'
import clsx from 'clsx'
import PageHeader from '@/components/theme/PageHeader'
import { Sticker, BellSticker, PencilSticker, ClipboardCheckSticker } from '@/components/theme/StickerIcon'

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
  easy:   'bg-[#DFF0DA] text-[#234A1D]',
  medium: 'bg-[#F8ECC9] text-[#4A3809]',
  hard:   'bg-red-100 text-red-700',
}

const CLASS_ACCENT = [
  '#C7B7E8',
  '#AAD6A0',
  '#AACDEA',
  '#EAC968',
  '#F0AFC6',
  '#F0A491',
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
  const [wsMarksData, setWsMarksData]         = useState<Array<{ studentId: string; score: number; feedback?: string; source?: string; imageUrl?: string; driveUrl?: string }>>([])
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
        const data = await res.json() as { marks: Array<{ student_id: string; score: number; feedback?: string; source?: string; image_url?: string; drive_url?: string }> }
        setWsMarksData((data.marks ?? []).map(m => ({
          studentId: m.student_id,
          score: m.score,
          feedback: m.feedback,
          source: m.source,
          imageUrl: m.image_url,
          driveUrl: m.drive_url,
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
      <div className="paper-page">
        {/* Header */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: '1px solid rgba(58,44,30,0.08)' }}>
            <button onClick={() => setStep('list')}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(58,44,30,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowLeft size={18} style={{ color: 'var(--ink)' }} />
            </button>
            <div>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.3px', lineHeight: 1 }}>New Test</h2>
              {selectedClass && <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{selectedClass.name}{selectedClass.section ? ` · ${selectedClass.section}` : ''}</p>}
            </div>
          </div>
          {/* Test type tab bar */}
          <div style={{ display: 'flex' }}>
            {(['subjective', 'worksheet'] as const).map(mode => (
              <button key={mode} onClick={() => { setTestMode(mode); setWsPreview(null) }}
                style={{ flex: 1, padding: '12px 0', fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: testMode === mode ? 'var(--ink)' : 'var(--ink-soft)', borderBottom: `2px solid ${testMode === mode ? 'var(--ink)' : 'transparent'}`, transition: 'all .15s', fontFamily: 'inherit' }}>
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
            <div className="paper-card" style={{ padding: '20px 22px' }}>
              <p className="label" style={{ marginBottom: 12, color: 'var(--ink-soft)' }}>Topic *</p>
              {syllabus.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input type="text" value={wsTopic} onChange={e => setWsTopic(e.target.value)}
                    placeholder="e.g. Fractions, Photosynthesis, Motion…" className="input-field" />
                  <p style={{ fontSize: 11, color: 'var(--ink-soft)' }}>No syllabus set up — type the topic directly.</p>
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
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all"
                        style={{ borderColor: isSelected ? 'var(--ink)' : 'rgba(58,44,30,0.12)', background: isSelected ? 'rgba(58,44,30,0.06)' : '#fff' }}>
                        <div style={{ flex: 1 }}>
                          <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                            {t.topic}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                            {taught ? `${sessionCount} session${sessionCount > 1 ? 's' : ''} taught` : 'Not yet taught'}
                          </p>
                        </div>
                        {taught
                          ? <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', isSelected ? 'paper-pill' : 'bg-emerald-100 text-emerald-700')}>
                              {sessionCount} session{sessionCount > 1 ? 's' : ''}
                            </span>
                          : <span className="paper-pill" style={{ fontSize: 10 }}>Upcoming</span>}
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
            <div className="paper-card" style={{ padding: '20px 22px' }}>
              <p className="label" style={{ marginBottom: 12, color: 'var(--ink-soft)' }}>Mark Distribution Template</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: wsDistribution.length > 0 ? 18 : 0 }}>
                {WS_TEMPLATES.map(t => (
                  <button key={t.name}
                    onClick={() => { setWsTemplate(t.name); setWsDistribution(t.dist.map(d => ({ ...d }))) }}
                    className="px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                    style={{ background: wsTemplate === t.name ? 'var(--ink)' : 'rgba(58,44,30,0.06)', color: wsTemplate === t.name ? '#fff' : 'var(--ink-soft)' }}>
                    {t.name} <span style={{ opacity: .65, fontSize: 11 }}>({t.totalLabel})</span>
                  </button>
                ))}
                <button
                  onClick={() => { setWsTemplate('custom'); setWsDistribution([{ type: 'mcq', count: 5, marksEach: 1 }]) }}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                  style={{ background: wsTemplate === 'custom' ? 'var(--ink)' : 'rgba(58,44,30,0.06)', color: wsTemplate === 'custom' ? '#fff' : 'var(--ink-soft)' }}>
                  Custom
                </button>
              </div>

              {wsDistribution.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sections</p>
                  {wsDistribution.map((row, ri) => (
                    <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(58,44,30,0.04)', borderRadius: 14, border: '1px solid rgba(58,44,30,0.08)' }}>
                      <select value={row.type}
                        onChange={e => setWsDistribution(d => d.map((r, i) => i === ri ? { ...r, type: e.target.value } : r))}
                        style={{ fontSize: 12, fontWeight: 700, border: '1px solid rgba(58,44,30,0.12)', borderRadius: 8, background: '#fff', color: 'var(--ink)', padding: '4px 8px', cursor: 'pointer' }}>
                        <option value="mcq">MCQ</option>
                        <option value="fill-in-blank">Fill in Blank</option>
                        <option value="short-answer">Short Answer</option>
                        <option value="long-answer">Long Answer</option>
                      </select>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>×</span>
                      <input type="number" min="1" max="30" value={row.count}
                        onChange={e => setWsDistribution(d => d.map((r, i) => i === ri ? { ...r, count: parseInt(e.target.value) || 1 } : r))}
                        style={{ width: 48, textAlign: 'center', fontSize: 13, fontWeight: 700, border: '1px solid rgba(58,44,30,0.12)', borderRadius: 8, padding: '4px 6px', color: 'var(--ink)' }} />
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>q ·</span>
                      <input type="number" min="1" max="20" value={row.marksEach}
                        onChange={e => setWsDistribution(d => d.map((r, i) => i === ri ? { ...r, marksEach: parseInt(e.target.value) || 1 } : r))}
                        style={{ width: 48, textAlign: 'center', fontSize: 13, fontWeight: 700, border: '1px solid rgba(58,44,30,0.12)', borderRadius: 8, padding: '4px 6px', color: 'var(--ink)' }} />
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)', flex: 1 }}>
                        m each = <strong style={{ color: 'var(--ink)' }}>{row.count * row.marksEach}m</strong>
                      </span>
                      <button onClick={() => setWsDistribution(d => d.filter((_, i) => i !== ri))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'flex', alignItems: 'center' }}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {wsDistribution.length < 5 && (
                    <button onClick={() => setWsDistribution(d => [...d, { type: 'short-answer', count: 3, marksEach: 2 }])}
                      style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', background: 'rgba(58,44,30,0.06)', padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                      + Add Section
                    </button>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--ink)', borderRadius: 12, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>Total Marks</span>
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
              className="paper-btn-primary w-full"
              style={{ opacity: (!wsTopic.trim() || wsDistribution.length === 0 || wsGenerating) ? 0.5 : 1 }}>
              {wsGenerating ? 'Generating Worksheet…' : '✨ Generate Worksheet'}
            </button>

            {/* Worksheet preview */}
            {wsPreview && (
              <>
                {/* ── Worksheet preview card ── */}
                <div className="paper-card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(58,44,30,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)' }}>{wsPreview.topic} — Worksheet</p>
                      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>Total: {wsPreview.totalMarks} marks · {wsPreview.sections.length} sections</p>
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
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--ink)', background: 'rgba(58,44,30,0.06)', padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Printer size={13} /> Open Worksheet
                    </button>
                  </div>
                  <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ textAlign: 'center', paddingBottom: 16, borderBottom: '2px solid var(--ink)' }}>
                      <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
                        {teacher?.subject ?? 'General'} — Grade {selectedClass?.grade ?? teacher?.grade ?? ''}
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 4 }}>Topic: {wsPreview.topic}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--ink-soft)' }}>
                        <span>Name: _______________________________</span>
                        <span>Roll No: __________</span>
                        <span>Total Marks: {wsPreview.totalMarks}</span>
                      </div>
                    </div>
                    {wsPreview.sections.map((section, si) => {
                      const prevCount = wsPreview.sections.slice(0, si).reduce((s, sec) => s + sec.questions.length, 0)
                      return (
                        <div key={si}>
                          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 14, letterSpacing: '.03em' }}>
                            {section.label} &nbsp;
                            <span style={{ fontWeight: 500, color: 'var(--ink-soft)', fontSize: 12 }}>
                              ({section.marksEach} × {section.questions.length} = {section.marksEach * section.questions.length} marks)
                            </span>
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {section.questions.map((q, qi) => (
                              <div key={qi} style={{ display: 'flex', gap: 10 }}>
                                <span style={{ width: 24, fontWeight: 800, color: 'var(--ink)', fontSize: 13, flexShrink: 0, paddingTop: 1 }}>
                                  {prevCount + qi + 1}.
                                </span>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.75 }}>{q.text}</p>
                                  {section.type === 'mcq' && q.options && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginTop: 7 }}>
                                      {q.options.map((opt, oi) => (
                                        <p key={oi} style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{opt}</p>
                                      ))}
                                    </div>
                                  )}
                                  {section.type === 'short-answer' && <div style={{ borderBottom: '1px solid rgba(58,44,30,0.2)', marginTop: 10, height: 22 }} />}
                                  {section.type === 'long-answer' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                      {[1, 2, 3].map(i => <div key={i} style={{ borderBottom: '1px solid rgba(58,44,30,0.12)', height: 22 }} />)}
                                    </div>
                                  )}
                                  {section.type === 'fill-in-blank' && <div style={{ borderBottom: '1px solid rgba(58,44,30,0.2)', marginTop: 6, height: 22, width: 180 }} />}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--ink-soft)', flexShrink: 0, paddingTop: 2 }}>[{section.marksEach}m]</span>
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
          <div className="paper-card" style={{ padding: '20px 22px' }}>
            <p className="label" style={{ marginBottom: 12, color: 'var(--ink-soft)' }}>Total Marks *</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['5', '10', '20', '25', '50', '100'].map(n => (
                <button key={n} onClick={() => setTotalMarks(n)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                  style={{ background: totalMarks === n ? 'var(--ink)' : 'rgba(58,44,30,0.06)', color: totalMarks === n ? '#fff' : 'var(--ink-soft)' }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="paper-card" style={{ padding: '20px 22px' }}>
            <p className="label" style={{ marginBottom: 12, color: 'var(--ink-soft)' }}>Topic *</p>
            {syllabus.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input type="text" value={customTopic} onChange={e => setCustomTopic(e.target.value)}
                  placeholder="e.g. Fractions, Photosynthesis…" className="input-field" />
                <p style={{ fontSize: 11, color: 'var(--ink-soft)' }}>No syllabus set up — type the topic directly.</p>
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
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all"
                        style={{
                          borderColor: isSelected ? 'var(--ink)' : isBlocked ? '#e8b4a6' : !taught ? 'rgba(58,44,30,0.06)' : 'rgba(58,44,30,0.12)',
                          background: isSelected ? 'rgba(58,44,30,0.06)' : isBlocked ? '#FBE3DC' : !taught ? 'rgba(58,44,30,0.03)' : '#fff',
                          opacity: !taught && !isBlocked ? 0.7 : 1,
                        }}>
                        <div style={{ flex: 1 }}>
                          <p className="font-semibold text-sm" style={{ color: isSelected ? 'var(--ink)' : !taught ? 'var(--ink-faint)' : 'var(--ink)' }}>
                            {t.topic}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                            {taught ? `${sessionCount} session${sessionCount > 1 ? 's' : ''} taught` : 'No class recorded yet'}
                          </p>
                        </div>
                        {taught
                          ? <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', isSelected ? 'paper-pill' : 'bg-emerald-100 text-emerald-700')}>
                              {sessionCount} session{sessionCount > 1 ? 's' : ''}
                            </span>
                          : <Lock size={14} style={{ color: 'var(--ink-faint)' }} className="shrink-0" />}
                      </button>
                      {isBlocked && (
                        <div className="mt-1 mx-1 px-4 py-2.5 rounded-xl flex items-center gap-2" style={{ background: '#FBE3DC', border: '1px solid #F0A491' }}>
                          <Lock size={13} style={{ color: '#B4543B' }} className="shrink-0" />
                          <p style={{ fontSize: 11.5, color: '#8A3A28', fontWeight: 600 }}>
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
            <div style={{ background: '#E9E1F6', border: '1px solid rgba(49,33,92,0.12)', borderRadius: 20, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={15} style={{ color: '#31215C' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#31215C' }}>Exam Questions — {selectedTopic?.topic}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!aiQLoading && aiQuestions.length > 0 && (
                    <button onClick={() => setPaperPreviewOpen(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#31215C', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, fontFamily: 'inherit' }}>
                      <FileText size={12} /> View as Paper
                    </button>
                  )}
                  {!aiQLoading && (
                    <button onClick={() => fetchAiQuestions()}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8 }} title="Regenerate">
                      <RefreshCw size={13} style={{ color: '#6B5D8F' }} />
                    </button>
                  )}
                  <button onClick={() => setAiQOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8 }}>
                    <X size={14} style={{ color: '#6B5D8F' }} />
                  </button>
                </div>
              </div>
              {aiQLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3,4,5].map(i => <div key={i} className="animate-pulse" style={{ height: 40, background: 'rgba(49,33,92,0.1)', borderRadius: 12 }} />)}
                </div>
              )}
              {!aiQLoading && aiQuestions.length > 0 && (() => {
                type QType = 'mcq' | 'fill-in-blank' | 'short-answer' | 'long-answer'
                const TYPE_ORDER: QType[] = ['mcq', 'fill-in-blank', 'short-answer', 'long-answer']
                const SECTION_META: Record<QType, { label: string; letter: string; badge: string; border: string }> = {
                  'mcq':           { label: 'Multiple Choice',   letter: 'A', badge: 'bg-[#DCEBF8] text-[#1E3A55]',  border: 'border-[#AACDEA]' },
                  'fill-in-blank': { label: 'Fill in the Blank', letter: 'B', badge: 'bg-[#DFF0DA] text-[#234A1D]',  border: 'border-[#AAD6A0]' },
                  'short-answer':  { label: 'Short Answer',      letter: 'C', badge: 'bg-[#F8ECC9] text-[#4A3809]', border: 'border-[#EAC968]' },
                  'long-answer':   { label: 'Long Answer',       letter: 'D', badge: 'bg-[#E9E1F6] text-[#31215C]', border: 'border-[#C7B7E8]' },
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
                          <div className="divide-y divide-[rgba(58,44,30,0.08)] bg-white">
                            {section.map(q => {
                              const idx = ++globalIdx
                              return (
                                <div key={idx} className="px-3 py-2.5 space-y-2">
                                  <div className="flex items-start gap-2">
                                    <span className="w-5 h-5 text-white rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#31215C' }}>{idx}</span>
                                    <p className="text-sm text-ink leading-relaxed">{q.text}</p>
                                  </div>
                                  {type === 'mcq' && q.options && (
                                    <div className="grid grid-cols-2 gap-1 ml-7">
                                      {q.options.map((opt, oi) => (
                                        <div key={oi} className={clsx('text-xs px-2 py-1 rounded-lg border', opt.startsWith(q.answer) ? 'bg-[#DFF0DA] border-[#AAD6A0] text-[#234A1D] font-semibold' : 'bg-[rgba(58,44,30,0.04)] border-[rgba(58,44,30,0.12)] text-ink-soft')}>{opt}</div>
                                      ))}
                                    </div>
                                  )}
                                  {type === 'fill-in-blank' && q.answer && (
                                    <div className="flex items-center gap-2 ml-7">
                                      <span className="text-xs text-ink-soft">Answer:</span>
                                      <span className="text-xs font-semibold text-[#234A1D] bg-[#DFF0DA] border border-[#AAD6A0] px-2 py-0.5 rounded-lg">{q.answer}</span>
                                    </div>
                                  )}
                                  {type === 'short-answer' && q.keywords && (
                                    <div className="flex flex-wrap gap-1 ml-7">
                                      {q.keywords.map((kw, ki) => <span key={ki} className="text-xs bg-[#F8ECC9] text-[#4A3809] px-2 py-0.5 rounded-full">{kw}</span>)}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 ml-7">
                                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', DIFF_COLOR[q.difficulty])}>{q.difficulty}</span>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[rgba(58,44,30,0.06)] text-ink-soft">{q.marks}m</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    <p style={{ fontSize: 11, color: '#6B5D8F' }}>Reference only · Total: {aiQuestions.reduce((s, q) => s + (q.marks ?? 0), 0)} marks</p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Exam Type */}
          <div className="paper-card" style={{ padding: '20px 22px' }}>
            <p className="label" style={{ marginBottom: 12, color: 'var(--ink-soft)' }}>Exam Type</p>
            <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(58,44,30,0.06)', marginBottom: 14 }}>
              {(['unit', 'term'] as const).map(type => (
                <button key={type} onClick={() => setExamType(type)}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-all"
                  style={{ background: examType === type ? '#fff' : 'transparent', color: examType === type ? 'var(--ink)' : 'var(--ink-soft)', border: examType === type ? '1px solid rgba(58,44,30,0.16)' : '1px solid transparent' }}>
                  {type === 'unit' ? 'Unit Exam' : 'Term Exam'}
                </button>
              ))}
            </div>
            {examType === 'term' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {['Term 1', 'Term 2', 'Term 3'].map(t => (
                  <button key={t} onClick={() => setSelectedTerm(t)}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                    style={{ background: selectedTerm === t ? 'var(--ink)' : 'rgba(58,44,30,0.06)', color: selectedTerm === t ? '#fff' : 'var(--ink-soft)' }}>
                    {t}
                  </button>
                ))}
              </div>
            )}
            {examType === 'unit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>Unit Number</p>
                  <input type="number" min="1" value={unitNumber} onChange={e => setUnitNumber(e.target.value)} placeholder="e.g. 7" className="input-field" />
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>Unit Name / Topic <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(optional)</span></p>
                  <input type="text" value={unitTopic} onChange={e => setUnitTopic(e.target.value)} placeholder="e.g. Forces and Motion, Algebra…" className="input-field" />
                </div>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="paper-card" style={{ padding: '20px 22px' }}>
            <p className="label" style={{ marginBottom: 12, color: 'var(--ink-soft)' }}>Date</p>
            <input type="date" value={conductedOn} onChange={e => setConductedOn(e.target.value)} className="input-field" />
          </div>

          {/* Save */}
          <button onClick={handleCreateTest} disabled={!effectiveTopic || saving}
            className="paper-btn-primary w-full"
            style={{ opacity: !effectiveTopic || saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save Test'}
          </button>
        </>)}
        </div>

      <QuestionPaperModal
        open={paperPreviewOpen}
        onClose={() => setPaperPreviewOpen(false)}
        questions={aiQuestions}
        subject={teacher?.subject ?? 'Subject'}
        topic={effectiveTopic || 'Topic'}
        className={selectedClass?.name ?? 'Class'}
        totalMarks={Number(totalMarks) || 0}
        conductedOn={conductedOn}
      />
      </div>
    )
  }

  // ── STEP: ENTER MARKS ─────────────────────────────────────────────────────

  if (step === 'enter-marks' && currentTest) {
    return (
      <div className="paper-page">
        {/* Header */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => { setStep('list'); setCurrentTestId('') }}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(58,44,30,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowLeft size={18} style={{ color: 'var(--ink)' }} />
            </button>
            <div>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.3px', lineHeight: 1 }}>{currentTest.topic}</h2>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                {new Date(currentTest.conductedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' · '}Out of {currentTest.totalMarks}
                {currentTest.term ? ` · ${currentTest.term}` : ''}
              </p>
            </div>
            {syncing && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>
                <RefreshCw size={11} className="animate-spin" /> Syncing…
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Question paper reference */}
          {currentTest.questions && currentTest.questions.length > 0 && (
            <div style={{ background: '#E9E1F6', border: '1px solid rgba(49,33,92,0.12)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
                <button type="button" onClick={() => setPaperOpen(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <Sparkles size={14} style={{ color: '#31215C' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#31215C' }}>Question Paper · {currentTest.questions.length} questions</span>
                  {paperOpen ? <ChevronUp size={15} style={{ color: '#6B5D8F' }} /> : <ChevronDown size={15} style={{ color: '#6B5D8F' }} />}
                </button>
                <button type="button" onClick={() => setPrintPaperOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#31215C', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8 }}>
                  <Printer size={12} /> Print Paper
                </button>
              </div>
              {paperOpen && (
                <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {currentTest.questions.map((q, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(49,33,92,0.12)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ width: 20, height: 20, background: '#31215C', color: '#fff', borderRadius: '50%', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, color: 'var(--ink)' }}>{q.text}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', DIFF_COLOR[q.difficulty])}>{q.difficulty}</span>
                            {q.marks != null && <span className="paper-pill">{q.marks}m</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#6B5D8F', paddingTop: 4 }}>Total: {currentTest.questions.reduce((s, q) => s + (q.marks ?? 0), 0)} marks</p>
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
              .map(m => ({ studentId: m.studentId, score: m.score, feedback: m.feedback, source: m.source, breakdown: m.breakdown, imageUrl: m.imageUrl, driveUrl: m.driveUrl }))}
            onSave={handleSaveMarks}
            onCancel={() => { setStep('list'); setCurrentTestId('') }}
          />
        </div>

        <QuestionPaperModal
          open={printPaperOpen}
          onClose={() => setPrintPaperOpen(false)}
          questions={currentTest.questions ?? []}
          subject={currentTest.subject}
          topic={currentTest.topic}
          className={myClasses.find(c => c.id === currentTest.classId)?.name}
          term={currentTest.term}
          totalMarks={currentTest.totalMarks}
          conductedOn={currentTest.conductedOn}
        />
      </div>
    )
  }

  // ── STEP: WORKSHEET MARKS ─────────────────────────────────────────────────

  if (step === 'worksheet-marks' && currentWorksheetId) {
    const ws = worksheets.find(w => w.id === currentWorksheetId)
    const wsStudents = selectedClassId ? getClassStudents(selectedClassId) : []
    return (
      <div className="paper-page">
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => { setStep('list'); setCurrentWorksheetId('') }}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(58,44,30,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowLeft size={18} style={{ color: 'var(--ink)' }} />
            </button>
            <div>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.3px', lineHeight: 1 }}>{ws?.topic ?? 'Worksheet'}</h2>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Worksheet · Out of {ws?.totalMarks ?? '?'}
              </p>
            </div>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {wsMarksLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <RefreshCw size={24} style={{ color: '#31215C' }} className="animate-spin" />
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
    <div className="paper-page pb-28">

      {/* Header */}
      <PageHeader
        title="Tests"
        eyebrow="Tests & Marks"
        subtitle={pendingCount > 0 ? `${pendingCount} with marks still pending` : totalTests > 0 ? 'All marks entered' : 'No tests yet'}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={async () => { setSyncing(true); await forceSync(); setSyncing(false) }}
              disabled={syncing || syncStatus === 'offline'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(58,44,30,0.08)', color: 'var(--ink-soft)', border: 'none', borderRadius: 12, padding: '9px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: syncing || syncStatus === 'offline' ? 0.5 : 1 }}>
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleNewTest}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--ink)', color: '#fff', fontWeight: 800, fontSize: 13, padding: '10px 16px', borderRadius: 14, border: 'none', cursor: 'pointer' }}>
              <Plus size={15} strokeWidth={2.5} /> New
            </button>
          </div>
        }
      />

      {/* Content */}
      <div style={{ padding: '12px 20px 48px', display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', zIndex: 1 }}>

        {myClasses.length === 0 ? (
          <div className="paper-card" style={{ padding: '72px 20px', textAlign: 'center' }}>
            <Sticker tone="blue" size={60} radius={999} style={{ margin: '0 auto 16px' }}>
              <BookOpen size={26} style={{ color: '#1E3A55' }} />
            </Sticker>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>No classes yet</p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.6 }}>Create a class first, then you can add tests.</p>
            <button onClick={() => setCreateClassOpen(true)} className="paper-btn-primary" style={{ marginTop: 22, display: 'inline-flex', padding: '12px 28px' }}>
              <Plus size={15} /> Create Class
            </button>
          </div>

        ) : totalTests === 0 ? (
          <div className="paper-card" style={{ padding: '72px 20px', textAlign: 'center' }}>
            <Sticker tone="gold" size={60} radius={999} style={{ margin: '0 auto 16px' }}>
              <PenLine size={24} style={{ color: '#4A3809' }} />
            </Sticker>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>No tests yet</p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.6, maxWidth: 300, margin: '6px auto 0' }}>Create your first test to start entering marks.</p>
            <button onClick={handleNewTest} className="paper-btn-primary" style={{ marginTop: 22, display: 'inline-flex', padding: '12px 28px' }}>
              <Plus size={15} /> Create First Test
            </button>
          </div>

        ) : (
          groups.filter(g => g.classTests.length > 0).map(({ cls, classTests, revisionTopics, accentIdx }) => (
            <div key={cls.id}>

              {/* Class header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GraduationCap size={15} color="#fff" />
                  </div>
                  <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{cls.name}</span>
                  {cls.section && <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>· {cls.section}</span>}
                  <span className="paper-pill">
                    {classTests.length} test{classTests.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button onClick={() => { setSelectedClassId(cls.id); resetForm(); setStep('new-test') }}
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', background: 'rgba(58,44,30,0.08)', padding: '5px 13px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                  + New Test
                </button>
              </div>

              {/* Revision needed banner */}
              {revisionTopics.length > 0 && (
                <div style={{ background: '#F8ECC9', border: '2px solid rgba(58,44,30,0.12)', borderRadius: 20, padding: '12px 16px', marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#4A3809', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Revision needed</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {revisionTopics.map(({ topic, avg }) => (
                      <div key={topic} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: 'rgba(58,44,30,0.15)', borderRadius: 99, height: 6 }}>
                          <div style={{ height: 6, borderRadius: 99, background: '#AD8A2C', width: `${Math.round(avg * 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#4A3809', width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{topic}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#AD8A2C', width: 32, textAlign: 'right' }}>{Math.round(avg * 100)}%</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: '#AD8A2C', marginTop: 6 }}>Class average below 65% — focus here</p>
                </div>
              )}

              {/* Test list */}
              <div className="paper-card" style={{ overflow: 'hidden' }}>
                {classTests.map((t, ti) => {
                  const allDone    = t.allDone
                  const started    = t.started
                  const isFuture   = new Date(t.conductedOn + 'T00:00:00').getTime() > new Date(new Date().toDateString()).getTime()
                  const testStatus = allDone ? 'completed' as const : isFuture ? 'upcoming' as const : 'grading' as const
                  const isOpen     = analysisTestId === t.id
                  const analysis   = analysisData[t.id]
                  const STATUS_META = {
                    upcoming:  { border: '#AACDEA', tone: 'blue' as const,  Icon: BellSticker,           label: 'Upcoming' },
                    grading:   { border: '#F0A491', tone: 'coral' as const, Icon: PencilSticker,         label: 'Grading' },
                    completed: { border: '#AAD6A0', tone: 'green' as const, Icon: ClipboardCheckSticker, label: 'Completed' },
                  }
                  const meta = STATUS_META[testStatus]

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
                    <div key={t.id} style={{ borderBottom: ti < classTests.length - 1 ? '1px solid rgba(58,44,30,0.08)' : 'none', borderLeft: `5px solid ${meta.border}` }}>
                      <button type="button"
                        onClick={() => openEnterMarks(cls.id, t.id)}
                        className="active:bg-black/[0.03] transition-colors"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{t.topic}</p>
                          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
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
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#1E3A55', background: '#DCEBF8', padding: '2px 8px', borderRadius: 99, marginTop: 4 }}>
                                {aiCount} AI-graded · tap to review
                              </span>
                            )
                          })()}
                        </div>
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <Sticker tone={meta.tone} size={40} radius={13}>
                            <meta.Icon size={20} />
                          </Sticker>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-soft)' }}>{meta.label}</span>
                        </div>
                        <ChevronRight size={15} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                      </button>

                      {/* Analyse Class button — only for completed tests */}
                      {allDone && (
                        <div style={{ padding: '0 16px 10px' }}>
                          <button type="button" onClick={() => fetchAnalysis(cls.id, t.id)}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-2xl text-xs font-bold transition-all"
                            style={{ background: isOpen ? '#E9E1F6' : 'rgba(58,44,30,0.04)', color: isOpen ? '#31215C' : 'var(--ink-soft)' }}>
                            <Sparkles size={12} />
                            {isOpen ? 'Hide Analysis' : 'Analyse Class'}
                            {analysisLoading && isOpen && <RefreshCw size={11} className="animate-spin" />}
                          </button>
                        </div>
                      )}

                      {/* Analysis panel */}
                      {isOpen && (
                        <div style={{ margin: '0 18px 12px', background: '#E9E1F6', border: '1px solid rgba(49,33,92,0.12)', borderRadius: 16, padding: '16px' }}>
                          {!analysis && analysisLoading && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {[1,2,3,4].map(i => <div key={i} className="animate-pulse" style={{ height: 16, background: 'rgba(49,33,92,0.12)', borderRadius: 8 }} />)}
                            </div>
                          )}
                          {!analysis && !analysisLoading && (
                            <p style={{ fontSize: 12, color: '#6B5D8F', textAlign: 'center' }}>Could not load analysis — tap Analyse Class to retry</p>
                          )}
                          {analysis && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.65 }}>{analysis.summary}</p>
                              <div style={{ background: '#DFF0DA', border: '1px solid #AAD6A0', borderRadius: 12, padding: '10px 14px' }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: '#234A1D', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Top Performers</p>
                                <p style={{ fontSize: 12, color: '#234A1D', lineHeight: 1.5 }}>{analysis.topPerformers}</p>
                              </div>
                              <div style={{ background: '#FBE3DC', border: '1px solid #F0A491', borderRadius: 12, padding: '10px 14px' }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: '#8A3A28', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Needs Help</p>
                                <p style={{ fontSize: 12, color: '#5C2416', lineHeight: 1.5 }}>{analysis.needHelp}</p>
                              </div>
                              <div style={{ background: '#DCEBF8', border: '1px solid #AACDEA', borderRadius: 12, padding: '10px 14px' }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: '#1E3A55', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Next Action</p>
                                <p style={{ fontSize: 12, color: '#1E3A55', lineHeight: 1.5 }}>{analysis.action}</p>
                              </div>
                            </div>
                          )}

                          {/* Question-level stats from scanner */}
                          {questionStats && questionStats.length > 0 && (
                            <div style={{ marginTop: 12, background: '#fff', border: '1px solid rgba(49,33,92,0.12)', borderRadius: 12, padding: '12px 14px' }}>
                              <p style={{ fontSize: 10, fontWeight: 800, color: '#31215C', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                                Questions Most Students Got Wrong
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {questionStats.map(q => {
                                  const ec = q.dominant === 'conceptual' ? 'bg-[#FBE3DC] text-[#8A3A28]' : q.dominant === 'procedural' ? 'bg-[#F8ECC9] text-[#4A3809]' : q.dominant === 'careless' ? 'bg-[#DCEBF8] text-[#1E3A55]' : 'bg-[rgba(58,44,30,0.06)] text-ink-soft'
                                  const rec = q.dominant === 'conceptual' ? 'Re-explain core concept from scratch' : q.dominant === 'procedural' ? 'Show a worked example step by step' : q.dominant === 'careless' ? 'Quick drill — they understand but need practice' : 'Review this question with the class'
                                  return (
                                    <div key={q.qNum}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>Q{q.qNum}</span>
                                        <div style={{ flex: 1, background: 'rgba(58,44,30,0.1)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                                          <div style={{ height: 8, borderRadius: 99, background: q.wrongPct >= 70 ? '#C46B54' : q.wrongPct >= 50 ? '#AD8A2C' : '#8069B0', width: `${q.wrongPct}%` }} />
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', width: 36, textAlign: 'right', flexShrink: 0 }}>{q.wrongPct}%</span>
                                        {q.dominant && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${ec}`}>{q.dominant}</span>}
                                      </div>
                                      <p style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 3, paddingLeft: 28 }}>{rec}</p>
                                    </div>
                                  )
                                })}
                              </div>
                              <p style={{ fontSize: 10, color: '#6B5D8F', marginTop: 8 }}>Showing questions where 30%+ students lost marks · {questionStats[0]?.total ?? 0} papers scanned</p>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(58,44,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setClassPicker(false)}>
          <div style={{ background: 'var(--paper-soft)', borderRadius: 24, padding: '28px 24px', width: 380, maxWidth: 'calc(100vw - 32px)', border: '1.5px solid rgba(58,44,30,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p className="font-display" style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)' }}>Which class?</p>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>Select a class to create the test in</p>
              </div>
              <button onClick={() => setClassPicker(false)}
                style={{ background: 'rgba(58,44,30,0.08)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={15} style={{ color: 'var(--ink-soft)' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myClasses.map((cls, gi) => {
                const sc = students.filter(s => s.classId === cls.id && s.isActive).length
                return (
                  <button key={cls.id} onClick={() => pickClass(cls.id)}
                    className="hover:bg-black/[0.03] transition-colors"
                    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 16, border: '1.5px solid rgba(58,44,30,0.1)', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: CLASS_ACCENT[gi % CLASS_ACCENT.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)' }}>{cls.grade}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{cls.name}{cls.section ? ` · ${cls.section}` : ''}</p>
                      <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{sc} student{sc !== 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight size={15} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
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
            <FileText size={16} style={{ color: '#1E3A55' }} />
            <p className="font-display" style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Saved Worksheets</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1E3A55', background: '#DCEBF8', borderRadius: 999, padding: '2px 10px' }}>{worksheets.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {worksheets.map(ws => {
              const cls = myClasses.find(c => c.id === ws.classId)
              const hasKey = Object.keys(ws.answerKey).length > 0
              return (
                <div key={ws.id} className="paper-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Sticker tone="blue" size={44} radius={14}>
                    <FileText size={20} style={{ color: '#1E3A55' }} />
                  </Sticker>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ws.topic}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                      {cls && <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>{cls.name}</span>}
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Grade {ws.grade}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>·</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{ws.totalMarks} marks</span>
                      {ws.template && <span style={{ fontSize: 10, fontWeight: 700, color: '#31215C', background: '#E9E1F6', borderRadius: 999, padding: '1px 8px' }}>{ws.template}</span>}
                      {hasKey && <span style={{ fontSize: 10, fontWeight: 700, color: '#234A1D', background: '#DFF0DA', borderRadius: 999, padding: '1px 8px' }}>✓ Key</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {ws.classId && (
                      <button onClick={() => void openWorksheetMarks(ws.classId!, ws.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#31215C', background: '#E9E1F6', padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
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
                    }} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#1E3A55', background: '#DCEBF8', padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
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

      <QuestionPaperModal
        open={paperPreviewOpen}
        onClose={() => setPaperPreviewOpen(false)}
        questions={aiQuestions}
        subject={teacher?.subject ?? 'Subject'}
        topic={effectiveTopic || 'Topic'}
        className={selectedClass?.name ?? 'Class'}
        totalMarks={Number(totalMarks) || 0}
        conductedOn={conductedOn}
      />
    </div>
  )
}
