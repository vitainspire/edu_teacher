'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import {
  PenLine, Plus, ArrowLeft,
  Sparkles, RefreshCw, X, ChevronDown, ChevronUp, Lock,
} from 'lucide-react'
import { useApp } from '@/lib/context'
import type { AiQuestion } from '@/lib/types'
import MarkEntry from '@/components/marks/MarkEntry'
import { aiKey, getAiCache, setAiCache, TTL } from '@/lib/ai-cache'
import clsx from 'clsx'

type Step = 'list' | 'new-test' | 'enter-marks'

const DIFF_COLOR = {
  easy:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard:   'bg-red-100 text-red-700',
}

export default function ClassMarksPage() {
  const { classId } = useParams<{ classId: string }>()
  const { teacher, classes, tests, marks, getClassStudents, getClassSyllabus, getTopicSessions, createTest, saveMarks, forceSync, syncStatus } = useApp()

  const cls          = classes.find(c => c.id === classId)
  const searchParams = useSearchParams()

  const [step, setStep]               = useState<Step>('list')

  useEffect(() => {
    if (searchParams.get('createTest')) setStep('new-test')
  }, [searchParams])

  // Auto-sync when page opens so scanner scores appear immediately
  useEffect(() => {
    setSyncing(true)
    forceSync().finally(() => setSyncing(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [topicId, setTopicId]         = useState('')
  const [totalMarks, setTotalMarks]   = useState('10')
  const [selectedTerm, setSelectedTerm] = useState(teacher?.currentTerm ?? 'Term 1')
  const [conductedOn, setConductedOn] = useState(new Date().toISOString().split('T')[0])
  const [currentTestId, setCurrentTestId] = useState('')
  const [saving, setSaving]           = useState(false)
  const [syncing, setSyncing]         = useState(false)
  const [examType, setExamType]       = useState<'term' | 'unit'>('unit')
  const [unitNumber, setUnitNumber]   = useState('1')
  const [unitTopic, setUnitTopic]     = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [blockedTopicId, setBlockedTopicId] = useState('')

  // AI questions panel
  const [aiQuestions, setAiQuestions]       = useState<AiQuestion[]>([])
  const [aiQLoading, setAiQLoading]         = useState(false)
  const [aiQOpen, setAiQOpen]               = useState(false)
  const [paperOpen, setPaperOpen]           = useState(true)

  // Test analysis panel
  const [analysisTestId, setAnalysisTestId] = useState<string | null>(null)
  const [analysisData, setAnalysisData]     = useState<Record<string, { summary: string; topPerformers: string; needHelp: string; action: string }>>({})
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const classStudents = getClassStudents(classId)
  const syllabus      = getClassSyllabus(classId)
  const classTests    = tests
    .filter(t => t.classId === classId)
    .sort((a, b) => new Date(b.conductedOn).getTime() - new Date(a.conductedOn).getTime())

  const selectedSyllabusTopic = syllabus.find(t => t.id === topicId)

  const effectiveTopic = selectedSyllabusTopic?.topic ?? customTopic.trim()

  const handleCreateTest = async () => {
    if (!effectiveTopic) return
    setSaving(true)
    const safeUnit = unitNumber.trim() || '1'
    const termValue = examType === 'term'
      ? selectedTerm
      : unitTopic.trim() ? `Unit ${safeUnit} — ${unitTopic.trim()}` : `Unit ${safeUnit}`
    await createTest({
      subject: teacher?.subject ?? '',
      topic: effectiveTopic,
      totalMarks: parseInt(totalMarks) || 10,
      conductedOn,
      classId,
      term: termValue,
      questions: aiQuestions.length > 0 ? aiQuestions : undefined,
    })
    setSaving(false)
    setTopicId('')
    setCustomTopic('')
    setTotalMarks('10')
    setSelectedTerm(teacher?.currentTerm ?? 'Term 1')
    setExamType('term')
    setUnitNumber('1')
    setUnitTopic('')
    setAiQuestions([])
    setAiQOpen(false)
    setStep('list')
  }

  const handleSaveMarks = async (entries: Array<{ studentId: string; score: number; feedback?: string; source?: string }>) => {
    await saveMarks(currentTestId, entries)
    setStep('list')
    setTopicId('')
    setTotalMarks('10')
    setAiQuestions([])
    setAiQOpen(false)
  }

  const abortRef = useRef<AbortController | null>(null)

  const fetchAnalysis = async (testId: string) => {
    if (analysisTestId === testId) { setAnalysisTestId(null); return }
    const test = tests.find(t => t.id === testId)
    if (!test) return
    setAnalysisTestId(testId)
    if (analysisData[testId]) return
    setAnalysisLoading(true)
    try {
      const testMarks = marks.filter(m => m.testId === testId)
      const results = testMarks.map(m => {
        const student = classStudents.find(s => s.id === m.studentId)
        return { name: student?.name ?? 'Unknown', score: m.score, percentage: (m.score / test.totalMarks) * 100 }
      })
      const res = await fetch('/api/test-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: test.topic, totalMarks: test.totalMarks, grade: cls?.grade ?? '', subject: teacher?.subject ?? '', results }),
      })
      if (res.ok) {
        const data = await res.json()
        setAnalysisData(prev => ({ ...prev, [testId]: data }))
      }
    } catch { /* teacher can try again */ }
    setAnalysisLoading(false)
  }

  const fetchAiQuestions = async (topicName?: string, marks?: string, signal?: AbortSignal) => {
    const topic = topicName ?? selectedSyllabusTopic?.topic
    if (!topic) return
    setAiQLoading(true)
    setAiQOpen(true)
    setAiQuestions([])
    try {
      const totalM = parseInt(marks ?? totalMarks) || 10
      const ck = aiKey('questions', { v: 3, topic: topic.toLowerCase().trim(), grade: cls?.grade ?? teacher?.grade ?? '5', totalM })
      const cached = getAiCache<AiQuestion[]>(ck)
      if (cached) { setAiQuestions(cached); setAiQLoading(false); return }
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: teacher?.subject ?? 'General',
          topic,
          grade: cls?.grade ?? teacher?.grade ?? '5',
          totalMarks: totalM,
        }),
        signal,
      })
      if (res.ok) {
        const { questions } = await res.json()
        setAiCache(ck, questions ?? [], TTL.ONE_MONTH)
        setAiQuestions(questions ?? [])
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    setAiQLoading(false)
  }

  // Auto-generate (or re-generate) whenever topic or total marks change.
  // Debounced 400ms + AbortController so rapid totalMarks changes don't race.
  useEffect(() => {
    if (!topicId) return
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
  }, [topicId, totalMarks])

  const currentTest = tests.find(t => t.id === currentTestId)

  // ── New test form ──────────────────────────────────────────────────────────
  if (step === 'new-test') {
    return (
      <div>
        <div className="bg-white px-4 pt-4 pb-4 border-b border-slate-100 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setStep('list')} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100">
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h2 className="text-lg font-bold text-slate-900">New Test</h2>
        </div>

        <div className="px-4 py-4 space-y-5">
          {/* Step 1 — Total Marks */}
          <div>
            <label className="label">Total Marks *</label>
            <div className="flex gap-2 mt-1">
              {['5', '10', '20', '25', '50', '100'].map(n => (
                <button
                  key={n}
                  onClick={() => setTotalMarks(n)}
                  className={clsx(
                    'flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors',
                    totalMarks === n ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Topic picker */}
          <div>
            <label className="label">Topic *</label>
            {syllabus.length === 0 ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customTopic}
                  onChange={e => setCustomTopic(e.target.value)}
                  placeholder="e.g. Fractions, Photosynthesis, World War II…"
                  className="input-field"
                />
                <p className="text-xs text-slate-400">No syllabus set up — type the topic directly.</p>
              </div>
            ) : (
              <div className="space-y-2 mt-1">
                {syllabus.map(t => {
                  const sessionCount = getTopicSessions(t.id).length
                  const taught       = sessionCount > 0
                  const isSelected   = topicId === t.id
                  const isBlocked    = blockedTopicId === t.id
                  return (
                    <div key={t.id}>
                      <button
                        onClick={() => {
                          if (!taught) {
                            setBlockedTopicId(t.id)
                            setTopicId('')
                          } else {
                            setTopicId(t.id)
                            setBlockedTopicId('')
                            setAiQuestions([])
                            setAiQOpen(false)
                          }
                        }}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all',
                          isSelected  ? 'border-blue-500 bg-blue-50' :
                          isBlocked   ? 'border-red-200 bg-red-50' :
                          !taught     ? 'border-slate-100 bg-slate-50 opacity-70' :
                                        'border-slate-200 bg-white',
                        )}
                      >
                        <div className="flex-1">
                          <p className={clsx(
                            'font-semibold text-sm',
                            isSelected ? 'text-blue-800' :
                            !taught    ? 'text-slate-400' :
                                         'text-slate-800',
                          )}>
                            {t.topic}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {taught
                              ? `${sessionCount} session${sessionCount > 1 ? 's' : ''} taught`
                              : 'No class recorded yet'}
                          </p>
                        </div>
                        {taught ? (
                          <span className={clsx(
                            'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
                            isSelected ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700',
                          )}>
                            {sessionCount} session{sessionCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <Lock size={14} className="text-slate-300 shrink-0" />
                        )}
                      </button>

                      {/* Inline block message */}
                      {isBlocked && (
                        <div className="mt-1 mx-1 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2">
                          <Lock size={13} className="text-red-400 shrink-0" />
                          <p className="text-xs text-red-600 font-semibold leading-snug">
                            This topic has not been taught yet — conduct a class first before creating a test.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Step 3 — AI Question Suggestions (auto-shown after topic pick) */}
          {topicId && aiQOpen && (
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-violet-600" />
                  <p className="text-sm font-bold text-violet-900">
                    Exam Questions — {selectedSyllabusTopic?.topic}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!aiQLoading && (
                    <button onClick={() => fetchAiQuestions()} className="p-1 rounded-lg hover:bg-violet-100" title="Regenerate">
                      <RefreshCw size={13} className="text-violet-400" />
                    </button>
                  )}
                  <button onClick={() => setAiQOpen(false)} className="p-1 rounded-lg hover:bg-violet-100">
                    <X size={14} className="text-violet-400" />
                  </button>
                </div>
              </div>

              {aiQLoading && (
                <div className="space-y-2 mt-2">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-violet-100 rounded-xl animate-pulse" />)}
                </div>
              )}

              {!aiQLoading && aiQuestions.length > 0 && (() => {
                type QType = 'mcq' | 'fill-in-blank' | 'short-answer' | 'long-answer'
                const TYPE_ORDER: QType[] = ['mcq', 'fill-in-blank', 'short-answer', 'long-answer']
                const SECTION_META: Record<QType, { label: string; letter: string; badge: string; border: string }> = {
                  'mcq':           { label: 'Multiple Choice',   letter: 'A', badge: 'bg-blue-100 text-blue-700',   border: 'border-blue-200' },
                  'fill-in-blank': { label: 'Fill in the Blank', letter: 'B', badge: 'bg-green-100 text-green-700', border: 'border-green-200' },
                  'short-answer':  { label: 'Short Answer',      letter: 'C', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
                  'long-answer':   { label: 'Long Answer',       letter: 'D', badge: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
                }
                const groups: Record<QType, typeof aiQuestions> = { 'mcq': [], 'fill-in-blank': [], 'short-answer': [], 'long-answer': [] }
                aiQuestions.forEach(q => { if (q.type && groups[q.type as QType]) groups[q.type as QType].push(q) })
                let globalIdx = 0
                return (
                  <div className="space-y-3 mt-2">
                    {TYPE_ORDER.map(type => {
                      const section = groups[type]
                      if (section.length === 0) return null
                      const meta = SECTION_META[type]
                      return (
                        <div key={type} className={`rounded-xl border ${meta.border} overflow-hidden`}>
                          <div className={`flex items-center justify-between px-3 py-2 ${meta.badge}`}>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-white text-xs font-black flex items-center justify-center" style={{ color: 'inherit' }}>
                                {meta.letter}
                              </span>
                              <span className="text-xs font-bold">{meta.label}</span>
                              <span className="text-xs opacity-70">{section.length} × {section[0].marks}m</span>
                            </div>
                            <span className="text-xs font-bold">{section.reduce((s, q) => s + q.marks, 0)} marks</span>
                          </div>
                          <div className="divide-y divide-slate-100 bg-white">
                            {section.map((q) => {
                              const idx = ++globalIdx
                              return (
                                <div key={idx} className="px-3 py-2.5 space-y-2">
                                  <div className="flex items-start gap-2">
                                    <span className="w-5 h-5 bg-violet-600 text-white rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                                      {idx}
                                    </span>
                                    <p className="text-sm text-slate-700 leading-relaxed">{q.text}</p>
                                  </div>
                                  {/* MCQ options */}
                                  {type === 'mcq' && q.options && q.options.length > 0 && (
                                    <div className="grid grid-cols-2 gap-1 ml-7">
                                      {q.options.map((opt, oi) => (
                                        <div key={oi} className={clsx(
                                          'text-xs px-2 py-1 rounded-lg border',
                                          opt.startsWith(q.answer)
                                            ? 'bg-green-50 border-green-300 text-green-800 font-semibold'
                                            : 'bg-slate-50 border-slate-200 text-slate-600',
                                        )}>
                                          {opt}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Fill-in-blank: answer always visible */}
                                  {type === 'fill-in-blank' && q.answer && (
                                    <div className="flex items-center gap-2 ml-7">
                                      <span className="text-xs text-slate-400">Answer:</span>
                                      <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg">
                                        {q.answer}
                                      </span>
                                    </div>
                                  )}
                                  {/* Keywords for short answer */}
                                  {type === 'short-answer' && q.keywords && q.keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-1 ml-7">
                                      {q.keywords.map((kw, ki) => (
                                        <span key={ki} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{kw}</span>
                                      ))}
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
                    <p className="text-xs text-violet-400">
                      Reference only · Total: {aiQuestions.reduce((s, q) => s + (q.marks ?? 0), 0)} marks
                    </p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Exam type + Term / Unit */}
          <div className="space-y-3">
            <label className="label">Exam Type</label>

            {/* Type toggle */}
            <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#f1f5f9' }}>
              {(['unit', 'term'] as const).map(type => (
                <button key={type} type="button"
                  onClick={() => setExamType(type)}
                  className={clsx(
                    'flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200',
                    examType === type ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500',
                  )}>
                  {type === 'unit' ? 'Unit Exam' : 'Term Exam'}
                </button>
              ))}
            </div>

            {/* Term selector */}
            {examType === 'term' && (
              <div className="flex gap-2">
                {['Term 1', 'Term 2', 'Term 3'].map(t => (
                  <button key={t} type="button" onClick={() => setSelectedTerm(t)}
                    className={clsx(
                      'flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors',
                      selectedTerm === t ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-700',
                    )}>
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Unit selector */}
            {examType === 'unit' && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Unit Number</p>
                  <input
                    type="number"
                    min="1"
                    value={unitNumber}
                    onChange={e => setUnitNumber(e.target.value)}
                    placeholder="e.g. 7"
                    className="input-field"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">
                    Unit Name / Topic <span className="font-normal text-slate-400">(optional)</span>
                  </p>
                  <input
                    type="text"
                    value={unitTopic}
                    onChange={e => setUnitTopic(e.target.value)}
                    placeholder="e.g. Forces and Motion, Algebra…"
                    className="input-field"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={conductedOn}
              onChange={e => setConductedOn(e.target.value)}
              className="input-field"
            />
          </div>

          {selectedSyllabusTopic && getTopicSessions(topicId).length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-sm text-blue-800 font-semibold">AI analysis will compare scores with attendance.</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Self-learners (absent + high score) and critical cases (absent + low score) will be flagged automatically.
              </p>
            </div>
          )}

          <button
            onClick={handleCreateTest}
            disabled={!effectiveTopic || saving}
            className="btn-primary w-full"
          >
            {saving ? 'Saving…' : 'Save Test'}
          </button>
        </div>
      </div>
    )
  }

  // ── Mark entry ─────────────────────────────────────────────────────────────
  if (step === 'enter-marks' && currentTest) {
    return (
      <div>
        <div className="bg-white px-4 pt-4 pb-4 border-b border-slate-100 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setStep('list')} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 shrink-0">
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{currentTest.topic}</h2>
            <p className="text-xs text-slate-500">
              {new Date(currentTest.conductedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {' · '}Out of {currentTest.totalMarks}
            </p>
          </div>
        </div>
        <div className="px-4 py-4 space-y-4">
          {/* Question paper reference — collapsible */}
          {currentTest.questions && currentTest.questions.length > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setPaperOpen(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-600" />
                  <span className="text-sm font-bold text-violet-900">
                    Question Paper · {currentTest.questions.length} questions
                  </span>
                </div>
                {paperOpen ? <ChevronUp size={15} className="text-violet-400" /> : <ChevronDown size={15} className="text-violet-400" />}
              </button>
              {paperOpen && (
                <div className="px-4 pb-4 space-y-2">
                  {currentTest.questions.map((q, i) => (
                    <div key={i} className="bg-white rounded-xl px-3 py-2.5 border border-violet-100">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-violet-600 text-white rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-slate-700">{q.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', DIFF_COLOR[q.difficulty])}>
                              {q.difficulty}
                            </span>
                            {q.marks != null && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                                {q.marks} mark{q.marks !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-violet-400 pt-1">
                    Total: {currentTest.questions.reduce((s, q) => s + (q.marks ?? 0), 0)} marks
                  </p>
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
            onCancel={() => setStep('list')}
          />
        </div>
      </div>
    )
  }

  // ── Test list ──────────────────────────────────────────────────────────────

  // Revision suggestions: weakest topics for this class from mastery data
  const revisionTopics = (() => {
    const classStudentIds = new Set(classStudents.map(s => s.id))
    const classMastery = marks
      .filter(m => classStudentIds.has(m.studentId))
      .reduce<Record<string, { total: number; count: number }>>((acc, m) => {
        const test = tests.find(t => t.id === m.testId)
        if (!test) return acc
        const pct = m.score / test.totalMarks
        if (!acc[test.topic]) acc[test.topic] = { total: 0, count: 0 }
        acc[test.topic].total += pct
        acc[test.topic].count += 1
        return acc
      }, {})
    return Object.entries(classMastery)
      .map(([topic, { total, count }]) => ({ topic, avg: total / count }))
      .filter(t => t.avg < 0.65)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3)
  })()

  return (
    <div>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-500">{classTests.length} test{classTests.length !== 1 ? 's' : ''}</p>
          <button
            onClick={async () => { setSyncing(true); await forceSync(); setSyncing(false) }}
            disabled={syncing || syncStatus === 'offline'}
            title="Refresh scores from cloud"
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-500 disabled:opacity-40"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
        <button
          onClick={() => setStep('new-test')}
          className="flex items-center gap-1.5 bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          <Plus size={15} /> New Test
        </button>
      </div>

      {revisionTopics.length > 0 && (
        <div className="mx-4 mb-1 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <p className="text-xs font-black text-amber-800 mb-2">Revision needed before next exam</p>
          <div className="space-y-1.5">
            {revisionTopics.map(({ topic, avg }) => (
              <div key={topic} className="flex items-center gap-2">
                <div className="flex-1 bg-amber-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-amber-500"
                    style={{ width: `${Math.round(avg * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-amber-900 w-24 truncate text-right">{topic}</span>
                <span className="text-xs font-bold text-amber-600 w-8 text-right">{Math.round(avg * 100)}%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-amber-600 mt-2">Class average below 65% — focus here</p>
        </div>
      )}

      <div className="px-4 space-y-2 pb-4">
        {classTests.length === 0 ? (
          <div className="text-center py-14">
            <PenLine size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No tests yet</p>
            <p className="text-sm text-slate-400 mt-1">Create a test to start entering marks</p>
            <button onClick={() => setStep('new-test')} className="mt-4 bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm">
              Create First Test
            </button>
          </div>
        ) : (
          classTests.map(t => {
            const entryCount = new Set(marks.filter(m => m.testId === t.id).map(m => m.studentId)).size
            const total      = classStudents.length
            const allDone    = total > 0 && entryCount >= total
            const started    = entryCount > 0 && !allDone
            const isAnalysisOpen = analysisTestId === t.id
            const analysis = analysisData[t.id]

            // Step 4: question-level class analysis from Mark.breakdown
            const questionStats = (() => {
              const testMarks = marks.filter(m => m.testId === t.id && m.breakdown && m.breakdown.length > 0)
              if (testMarks.length === 0) return null
              const qMap = new Map<number, { total: number; wrong: number; errorCounts: Record<string, number>; max: number }>()
              for (const mark of testMarks) {
                for (const b of mark.breakdown!) {
                  if (!qMap.has(b.question)) qMap.set(b.question, { total: 0, wrong: 0, errorCounts: {}, max: b.max })
                  const q = qMap.get(b.question)!
                  q.total++
                  if (b.awarded < b.max) {
                    q.wrong++
                    const et = b.errorType ?? 'unknown'
                    q.errorCounts[et] = (q.errorCounts[et] ?? 0) + 1
                  }
                }
              }
              return Array.from(qMap.entries())
                .map(([qNum, s]) => ({
                  qNum,
                  wrongPct: Math.round((s.wrong / s.total) * 100),
                  wrong: s.wrong,
                  total: s.total,
                  dominant: (Object.entries(s.errorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as 'conceptual' | 'procedural' | 'careless' | null,
                }))
                .filter(q => q.wrongPct >= 30)
                .sort((a, b) => b.wrongPct - a.wrongPct)
                .slice(0, 8)
            })()

            return (
              <div key={t.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => { setCurrentTestId(t.id); setStep('enter-marks') }}
                  className="card flex items-center gap-3 w-full text-left active:scale-[0.98] transition-transform"
                >
                  <div className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    allDone ? 'bg-emerald-50' : 'bg-amber-50',
                  )}>
                    <PenLine size={18} className={allDone ? 'text-emerald-600' : 'text-amber-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{t.topic}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(t.conductedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {t.term ? ` · ${t.term}` : ''}
                      {' · '}{t.totalMarks} marks
                      {allDone || started ? ` · ${entryCount}/${total} entered` : ''}
                    </p>
                  </div>
                  <span className={clsx(
                    'text-xs font-semibold px-2.5 py-1 rounded-full shrink-0',
                    allDone  ? 'bg-emerald-100 text-emerald-700' :
                    started  ? 'bg-blue-100 text-blue-700' :
                               'bg-amber-100 text-amber-700',
                  )}>
                    {allDone ? 'Done' : started ? 'In progress' : 'Marks pending'}
                  </span>
                </button>

                {allDone && (
                  <button
                    type="button"
                    onClick={() => fetchAnalysis(t.id)}
                    className={clsx(
                      'w-full flex items-center justify-center gap-2 py-2 rounded-2xl text-xs font-bold transition-all',
                      isAnalysisOpen
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-violet-50 hover:text-violet-600',
                    )}
                  >
                    <Sparkles size={12} />
                    {isAnalysisOpen ? 'Hide Analysis' : 'Analyse Class'}
                    {analysisLoading && isAnalysisOpen && <RefreshCw size={11} className="animate-spin" />}
                  </button>
                )}

                {isAnalysisOpen && (
                  <div className="rounded-2xl bg-violet-50 border border-violet-100 px-4 py-4 space-y-3">
                    {!analysis && analysisLoading && (
                      <div className="space-y-2">
                        {[1,2,3,4].map(i => <div key={i} className="h-4 bg-violet-100 rounded-lg animate-pulse" />)}
                      </div>
                    )}
                    {!analysis && !analysisLoading && (
                      <p className="text-xs text-violet-500 text-center">Could not load analysis — tap Analyse Class to retry</p>
                    )}
                    {analysis && (
                      <>
                        <p className="text-xs text-slate-700 leading-relaxed">{analysis.summary}</p>
                        <div className="space-y-2">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wide mb-1">Top Performers</p>
                            <p className="text-xs text-emerald-800 leading-snug">{analysis.topPerformers}</p>
                          </div>
                          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-black text-red-600 uppercase tracking-wide mb-1">Needs Help</p>
                            <p className="text-xs text-red-800 leading-snug">{analysis.needHelp}</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-wide mb-1">Next Action</p>
                            <p className="text-xs text-blue-800 leading-snug">{analysis.action}</p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Question-level class analysis — only shown when scanner breakdown data exists */}
                    {questionStats && questionStats.length > 0 && (
                      <div className="bg-white border border-violet-100 rounded-xl px-3 py-3 space-y-2.5">
                        <p className="text-[10px] font-black text-violet-700 uppercase tracking-wide">
                          Questions Most Students Got Wrong
                        </p>
                        {questionStats.map(q => {
                          const errorColor = q.dominant === 'conceptual'
                            ? 'bg-red-100 text-red-700'
                            : q.dominant === 'procedural'
                            ? 'bg-amber-100 text-amber-700'
                            : q.dominant === 'careless'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                          const recommendation = q.dominant === 'conceptual'
                            ? 'Re-explain core concept from scratch'
                            : q.dominant === 'procedural'
                            ? 'Show a worked example step by step'
                            : q.dominant === 'careless'
                            ? 'Quick drill — they understand but need practice'
                            : 'Review this question with the class'
                          return (
                            <div key={q.qNum} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-700 shrink-0">Q{q.qNum}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full ${q.wrongPct >= 70 ? 'bg-red-500' : q.wrongPct >= 50 ? 'bg-amber-500' : 'bg-violet-400'}`}
                                    style={{ width: `${q.wrongPct}%` }}
                                  />
                                </div>
                                <span className="text-xs font-black text-slate-600 shrink-0 w-10 text-right">{q.wrongPct}%</span>
                                {q.dominant && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${errorColor}`}>
                                    {q.dominant}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 pl-7">{recommendation}</p>
                            </div>
                          )
                        })}
                        <p className="text-[10px] text-violet-400 pt-1">
                          Showing questions where 30%+ of students lost marks · {questionStats[0]?.total ?? 0} papers scanned
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
