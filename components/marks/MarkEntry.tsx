'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Check, Camera, PenLine, Sparkles, RefreshCw,
  MessageSquare, ChevronDown, ChevronUp, Mic, MicOff, ScanLine, ExternalLink,
} from 'lucide-react'
import type { Student, AiQuestion } from '@/lib/types'
import clsx from 'clsx'
import VoiceEntry from './VoiceEntry'

type Mode = 'manual' | 'camera'

interface EntryState {
  score: string
  feedback: string
  feedbackOpen: boolean
}

interface QuestionBreakdown {
  questionIndex: number
  marksAwarded: number
  maxMarks: number
  feedback: string
}

interface Props {
  students: Student[]
  totalMarks: number
  topic: string
  questions?: AiQuestion[]
  prefillScores?: Array<{ studentId: string; score: number; feedback?: string; source?: string; breakdown?: { question: number; awarded: number; max: number }[]; imageUrl?: string }>
  onSave: (entries: Array<{ studentId: string; score: number; feedback?: string; source?: string }>) => Promise<void>
  onCancel: () => void
}

export default function MarkEntry({ students, totalMarks, topic, questions, prefillScores, onSave, onCancel }: Props) {
  const [mode, setMode]       = useState<Mode>('manual')
  const [entries, setEntries] = useState<Record<string, EntryState>>({})
  const [saving, setSaving]   = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Per-student camera scanning
  const [cameraForId, setCameraForId]   = useState<string | null>(null)
  const [scanningIds, setScanningIds]   = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  // Per-student AI grading breakdown (only when questions are present)
  const [breakdowns, setBreakdowns]         = useState<Record<string, QuestionBreakdown[]>>({})
  const [breakdownOpen, setBreakdownOpen]   = useState<Record<string, boolean>>({})
  const [, setGeneralFeedbacks] = useState<Record<string, string>>({})

  // Paper image URLs from scanner (student_id → drive URL)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  // AI scan source tracking
  const [aiScannedIds, setAiScannedIds] = useState<Set<string>>(new Set())
  const [originalAiScores, setOriginalAiScores] = useState<Record<string, number>>({})
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set())

  // Voice feedback
  const [voiceFeedbackFor, setVoiceFeedbackFor] = useState<string | null>(null)
  const recogRef = useRef<SpeechRecognition | null>(null)

  // Prefill from external source
  useEffect(() => {
    if (!prefillScores?.length) return
    setEntries(prev => {
      const next = { ...prev }
      prefillScores.forEach(e => {
        next[e.studentId] = {
          score: String(e.score),
          feedback: e.feedback ?? '',
          feedbackOpen: !!(e.feedback),
        }
      })
      return next
    })
    // Populate image URLs
    const urlMap: Record<string, string> = {}
    prefillScores.forEach(e => { if (e.imageUrl) urlMap[e.studentId] = e.imageUrl })
    if (Object.keys(urlMap).length) setImageUrls(prev => ({ ...prev, ...urlMap }))

    const aiIds = new Set(prefillScores.filter(e => e.source === 'ai_scanned').map(e => e.studentId))
    const aiOriginals: Record<string, number> = {}
    prefillScores.filter(e => e.source === 'ai_scanned').forEach(e => { aiOriginals[e.studentId] = e.score })
    setAiScannedIds(aiIds)
    setOriginalAiScores(aiOriginals)
    setEditedIds(new Set())
    // Populate scanner question breakdown if present
    const bdMap: Record<string, QuestionBreakdown[]> = {}
    const bdOpenMap: Record<string, boolean> = {}
    prefillScores.forEach(e => {
      if (e.breakdown?.length) {
        bdMap[e.studentId] = e.breakdown.map(b => ({
          questionIndex: b.question - 1,
          marksAwarded: b.awarded,
          maxMarks: b.max,
          feedback: '',
        }))
        bdOpenMap[e.studentId] = false
      }
    })
    if (Object.keys(bdMap).length) {
      setBreakdowns(prev => ({ ...prev, ...bdMap }))
      setBreakdownOpen(prev => ({ ...prev, ...bdOpenMap }))
    }
  }, [prefillScores])

  const getEntry = (id: string): EntryState =>
    entries[id] ?? { score: '', feedback: '', feedbackOpen: false }

  const setScore = useCallback((studentId: string, value: string) => {
    // Allow digits, one decimal point, up to one decimal place (e.g. 12.5)
    if (value === '' || /^\d+(\.\d?)?$/.test(value)) {
      const num = parseFloat(value)
      if (value === '' || value.endsWith('.') || (num >= 0 && num <= totalMarks)) {
        setEntries(prev => ({ ...prev, [studentId]: { ...getEntry(studentId), score: value } }))
        if (aiScannedIds.has(studentId)) {
          const parsed = parseFloat(value)
          if (!isNaN(parsed) && parsed !== originalAiScores[studentId]) {
            setEditedIds(prev => new Set(prev).add(studentId))
          } else {
            setEditedIds(prev => { const s = new Set(prev); s.delete(studentId); return s })
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMarks, entries, aiScannedIds, originalAiScores])

  const setFeedback = (studentId: string, value: string) =>
    setEntries(prev => ({ ...prev, [studentId]: { ...getEntry(studentId), feedback: value } }))

  const toggleFeedback = (studentId: string) =>
    setEntries(prev => ({
      ...prev,
      [studentId]: { ...getEntry(studentId), feedbackOpen: !getEntry(studentId).feedbackOpen },
    }))

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const next = inputRefs.current[idx + 1]
      if (next) { next.focus(); setActiveIdx(idx + 1) }
    }
  }

  const applyVoice = useCallback((voiceEntries: Array<{ studentId: string; score: number }>) => {
    setEntries(prev => {
      const next = { ...prev }
      voiceEntries.forEach(e => {
        const cur = next[e.studentId] ?? { score: '', feedback: '', feedbackOpen: false }
        next[e.studentId] = { ...cur, score: String(e.score) }
      })
      return next
    })
  }, [])

  // ── Voice feedback ──────────────────────────────────────────────────────────
  const startVoiceFeedback = (studentId: string) => {
    const SR = (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    if (voiceFeedbackFor === studentId) {
      recogRef.current?.stop()
      setVoiceFeedbackFor(null)
      return
    }
    recogRef.current?.stop()
    const recog = new SR()
    recog.lang = 'en-IN'
    recog.continuous = false
    recog.interimResults = false
    recog.onstart = () => setVoiceFeedbackFor(studentId)
    recog.onend = () => setVoiceFeedbackFor(null)
    recog.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript
      setFeedback(studentId, text)
      setEntries(prev => ({
        ...prev,
        [studentId]: { ...getEntry(studentId), feedback: text, feedbackOpen: true },
      }))
    }
    recog.start()
    recogRef.current = recog
  }

  // ── Per-student camera scan ────────────────────────────────────────────────
  const triggerCamera = (studentId: string) => {
    setCameraForId(studentId)
    setTimeout(() => fileRef.current?.click(), 50)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const studentId = cameraForId
    e.target.value = ''
    if (!file || !studentId) return

    const reader = new FileReader()
    reader.onload = async ev => {
      const imageBase64 = ev.target?.result as string
      setScanningIds(prev => new Set(prev).add(studentId))
      try {
        const student = students.find(s => s.id === studentId)

        // Use question-aware grader when questions are saved, else fall back to generic
        if (questions?.length) {
          const res = await fetch('/api/grade-paper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, questions, totalMarks, topic, studentName: student?.name ?? '' }),
          })
          if (!res.ok) throw new Error()
          const data = await res.json()
          if (typeof data.totalScore === 'number') {
            setEntries(prev => ({
              ...prev,
              [studentId]: { score: String(data.totalScore), feedback: data.generalFeedback ?? '', feedbackOpen: !!(data.generalFeedback) },
            }))
            if (data.breakdown?.length) {
              setBreakdowns(prev => ({ ...prev, [studentId]: data.breakdown }))
              setBreakdownOpen(prev => ({ ...prev, [studentId]: true }))
            }
            if (data.generalFeedback) setGeneralFeedbacks(prev => ({ ...prev, [studentId]: data.generalFeedback }))
          }
        } else {
          const res = await fetch('/api/grade-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, students: [{ id: studentId, name: student?.name ?? '' }], totalMarks, topic }),
          })
          if (!res.ok) throw new Error()
          const { entries: graded } = await res.json()
          if (graded?.length) {
            const g = graded[0]
            setEntries(prev => ({ ...prev, [studentId]: { score: String(g.score), feedback: g.feedback ?? '', feedbackOpen: !!(g.feedback) } }))
          }
        }
      } catch { /* teacher can type manually */ }
      finally {
        setScanningIds(prev => { const s = new Set(prev); s.delete(studentId); return s })
      }
    }
    reader.readAsDataURL(file)
  }

  const enteredCount = students.filter(s => getEntry(s.id).score !== '').length

  const handleSave = async () => {
    const toSave = students
      .filter(s => getEntry(s.id).score !== '')
      .map(s => {
        let source: string | undefined
        if (editedIds.has(s.id)) source = 'teacher_override'
        else if (aiScannedIds.has(s.id)) source = 'ai_scanned'
        else source = 'manual'
        return {
          studentId: s.id,
          score: parseFloat(getEntry(s.id).score),
          feedback: getEntry(s.id).feedback.trim() || undefined,
          source,
        }
      })
    if (!toSave.length) return
    setSaving(true)
    await onSave(toSave)
    setSaving(false)
  }

  // ── Shared student row renderer ────────────────────────────────────────────
  const renderStudentRow = (student: Student, idx: number) => {
    const entry       = getEntry(student.id)
    const hasScore    = entry.score !== ''
    const pct         = hasScore ? parseInt(entry.score) / totalMarks : null
    const isActive    = mode === 'manual' && activeIdx === idx
    const scanning    = scanningIds.has(student.id)
    const bdList      = breakdowns[student.id]
    const bdOpen      = breakdownOpen[student.id] ?? false

    return (
      <div key={student.id} className={clsx(
        'rounded-2xl border-2 transition-all',
        hasScore ? 'border-emerald-300 bg-emerald-50' : isActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white',
      )}>
        {/* Main row */}
        <div
          className="flex items-center gap-3 p-3 cursor-pointer"
          onClick={() => { if (mode === 'manual') { setActiveIdx(idx); inputRefs.current[idx]?.focus() } }}
        >
          {/* Roll badge */}
          <div className={clsx(
            'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
            hasScore ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600',
          )}>
            {hasScore ? <Check size={15} /> : student.rollNumber}
          </div>

          <span className="flex-1 font-semibold text-slate-900 min-w-0 truncate">{student.name}</span>

          {/* AI Scanned / Edited badge */}
          {aiScannedIds.has(student.id) && hasScore && (
            editedIds.has(student.id) ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                Edited
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                <ScanLine size={9} /> AI Scanned
              </span>
            )
          )}

          {/* View scanned paper link */}
          {imageUrls[student.id] && (
            <a
              href={imageUrls[student.id]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="View scanned paper"
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-colors shrink-0"
            >
              <ExternalLink size={9} /> Paper
            </a>
          )}

          {/* Camera mode: scan button per student */}
          {mode === 'camera' && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); triggerCamera(student.id) }}
              disabled={scanning}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0',
                hasScore
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200 active:scale-95',
              )}
            >
              {scanning
                ? <><RefreshCw size={12} className="animate-spin" /> Reading…</>
                : hasScore
                  ? <><Camera size={12} /> Re-scan</>
                  : <><Camera size={12} /> Scan paper</>}
            </button>
          )}

          {/* Manual mode: feedback toggle */}
          {mode === 'manual' && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggleFeedback(student.id) }}
              className={clsx(
                'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg transition-colors shrink-0',
                entry.feedback
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-slate-400 hover:bg-slate-100',
              )}
            >
              <MessageSquare size={11} />
              {entry.feedbackOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}

          {/* Score input (both modes) */}
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <input
              ref={el => { inputRefs.current[idx] = el }}
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0}
              max={totalMarks}
              value={entry.score}
              onChange={e => setScore(student.id, e.target.value)}
              onKeyDown={e => handleKeyDown(e, idx)}
              onFocus={() => setActiveIdx(idx)}
              placeholder="—"
              className={clsx(
                'w-14 text-center text-xl font-bold rounded-xl border-2 py-1 focus:outline-none transition-all',
                hasScore
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-900 focus:border-blue-500',
              )}
            />
            <span className="text-xs text-slate-400">/{totalMarks}</span>
          </div>

          {/* Percentage */}
          {pct !== null && (
            <span className={clsx(
              'text-xs font-bold w-9 text-right shrink-0',
              pct >= 0.75 ? 'text-emerald-600' : pct >= 0.5 ? 'text-amber-600' : 'text-red-600',
            )}>
              {Math.round(pct * 100)}%
            </span>
          )}
        </div>

        {/* Feedback row — visible in both modes once a score is set */}
        {(entry.feedbackOpen || (mode === 'camera' && hasScore)) && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={entry.feedback}
                onChange={e => setFeedback(student.id, e.target.value)}
                placeholder="e.g. confused on Q3, skipped last question, good work…"
                maxLength={120}
                className="flex-1 text-sm border border-violet-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700 placeholder:text-slate-300"
              />
              <button
                type="button"
                onClick={() => startVoiceFeedback(student.id)}
                className={clsx(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                  voiceFeedbackFor === student.id
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-violet-100 text-violet-600 hover:bg-violet-200',
                )}
                title="Speak feedback"
              >
                {voiceFeedbackFor === student.id ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 text-right">{entry.feedback.length}/120</p>
          </div>
        )}

        {/* AI question-by-question breakdown (only after scan with questions) */}
        {bdList?.length > 0 && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => setBreakdownOpen(prev => ({ ...prev, [student.id]: !bdOpen }))}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-violet-50 border border-violet-100 mb-2"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-violet-600" />
                <span className="text-xs font-bold text-violet-800">
                  AI Marking Breakdown · {bdList.reduce((s, b) => s + b.marksAwarded, 0)}/{bdList.reduce((s, b) => s + b.maxMarks, 0)} marks
                </span>
              </div>
              {bdOpen ? <ChevronUp size={13} className="text-violet-400" /> : <ChevronDown size={13} className="text-violet-400" />}
            </button>
            {bdOpen && (
              <div className="space-y-1.5">
                {bdList.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white rounded-xl px-3 py-2 border border-violet-100">
                    <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      {b.questionIndex + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-600 leading-snug truncate">
                        {questions?.[b.questionIndex]?.text ?? `Q${b.questionIndex + 1}`}
                      </p>
                      {b.feedback && (
                        <p className="text-[10px] text-slate-400 mt-0.5 italic">{b.feedback}</p>
                      )}
                    </div>
                    <span className={clsx(
                      'text-xs font-black shrink-0',
                      b.marksAwarded === b.maxMarks ? 'text-emerald-600' :
                      b.marksAwarded === 0 ? 'text-red-500' : 'text-amber-600',
                    )}>
                      {b.marksAwarded}/{b.maxMarks}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Hidden file input for camera — shared, retargeted per student */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Mode toggle */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
            mode === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500',
          )}
        >
          <PenLine size={14} /> Enter Manually
        </button>
        <button
          type="button"
          onClick={() => setMode('camera')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
            mode === 'camera' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500',
          )}
        >
          <Camera size={14} /> Scan Papers
        </button>
      </div>

      {/* ── Manual mode extras ── */}
      {mode === 'manual' && (
        <div className="card">
          <VoiceEntry students={students} totalMarks={totalMarks} onConfirm={applyVoice} />
        </div>
      )}

      {/* ── Camera mode header ── */}
      {mode === 'camera' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={13} className="text-blue-600" />
            <p className="text-sm font-bold text-blue-900">Scan each student&apos;s paper</p>
          </div>
          <p className="text-xs text-blue-600 leading-relaxed">
            Tap <Camera size={10} className="inline" /> next to a student, take a photo of their answer sheet — AI reads the score and notes automatically.
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-slate-500 font-medium">{enteredCount} of {students.length} entered</span>
        <div className="flex-1 mx-3 bg-slate-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${students.length > 0 ? (enteredCount / students.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm font-bold text-blue-700">
          {Math.round(students.length > 0 ? (enteredCount / students.length) * 100 : 0)}%
        </span>
      </div>

      {/* Student list — same for both modes */}
      <div className="space-y-2">
        {students.map((student, idx) => renderStudentRow(student, idx))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 pb-4">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={enteredCount === 0 || saving}
          className="btn-primary flex-1"
        >
          {saving ? 'Saving…' : `Save ${enteredCount} Score${enteredCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
