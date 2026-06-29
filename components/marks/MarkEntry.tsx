'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Check, Sparkles, ChevronDown, ChevronUp, ScanLine, FileImage, X,
  ZoomIn, ZoomOut, RotateCw, Paperclip, Loader2,
} from 'lucide-react'
import type { Student, AiQuestion } from '@/lib/types'
import clsx from 'clsx'

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
  prefillScores?: Array<{
    studentId: string
    score: number
    feedback?: string
    source?: string
    breakdown?: { question: number; awarded: number; max: number; errorType?: string | null }[]
    imageUrl?: string
  }>
  onSave: (entries: Array<{ studentId: string; score: number; feedback?: string; source?: string }>) => Promise<void>
  onCancel: () => void
}

function compressToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 1600
      const scale = img.width > MAX ? MAX / img.width : 1
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas unavailable')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      resolve({ base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}

export default function MarkEntry({ students, totalMarks, questions, prefillScores, onSave, onCancel }: Props) {
  const [entries, setEntries]     = useState<Record<string, EntryState>>({})
  const [saving, setSaving]       = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const [breakdowns, setBreakdowns]         = useState<Record<string, QuestionBreakdown[]>>({})
  const [breakdownOpen, setBreakdownOpen]   = useState<Record<string, boolean>>({})
  const [imageUrls, setImageUrls]           = useState<Record<string, string>>({})
  const [uploadingFor, setUploadingFor]     = useState<string | null>(null)
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const uploadTargetRef = useRef<string | null>(null)

  // AI scan tracking
  const [aiScannedIds, setAiScannedIds]           = useState<Set<string>>(new Set())
  const [originalAiScores, setOriginalAiScores]   = useState<Record<string, number>>({})
  const [editedIds, setEditedIds]                 = useState<Set<string>>(new Set())

  // Lightbox
  const [viewingUrl, setViewingUrl]   = useState<string | null>(null)
  const [viewingName, setViewingName] = useState('')
  const [zoom, setZoom]               = useState(1)
  const [rotation, setRotation]       = useState(0)

  // Prefill from scanner results
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

    const urlMap: Record<string, string> = {}
    prefillScores.forEach(e => { if (e.imageUrl) urlMap[e.studentId] = e.imageUrl })
    if (Object.keys(urlMap).length) setImageUrls(prev => ({ ...prev, ...urlMap }))

    const aiIds = new Set(prefillScores.filter(e => e.source === 'ai_scanned').map(e => e.studentId))
    const aiOriginals: Record<string, number> = {}
    prefillScores.filter(e => e.source === 'ai_scanned').forEach(e => { aiOriginals[e.studentId] = e.score })
    setAiScannedIds(aiIds)
    setOriginalAiScores(aiOriginals)
    setEditedIds(new Set())

    const bdMap: Record<string, QuestionBreakdown[]> = {}
    prefillScores.forEach(e => {
      if (e.breakdown?.length) {
        bdMap[e.studentId] = e.breakdown.map(b => ({
          questionIndex: b.question - 1,
          marksAwarded: b.awarded,
          maxMarks: b.max,
          feedback: '',
        }))
      }
    })
    if (Object.keys(bdMap).length) {
      setBreakdowns(prev => ({ ...prev, ...bdMap }))
      const autoOpen: Record<string, boolean> = {}
      Object.keys(bdMap).forEach(id => { autoOpen[id] = true })
      setBreakdownOpen(prev => ({ ...prev, ...autoOpen }))
    }
  }, [prefillScores])

  const getEntry = (id: string): EntryState =>
    entries[id] ?? { score: '', feedback: '', feedbackOpen: false }

  const setScore = useCallback((studentId: string, value: string) => {
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

  // ── Teacher-side paper upload ─────────────────────────────────────────────
  function openUpload(studentId: string) {
    uploadTargetRef.current = studentId
    uploadRef.current?.click()
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetRef.current) return
    if (uploadRef.current) uploadRef.current.value = ''
    const studentId = uploadTargetRef.current
    setUploadingFor(studentId)
    try {
      const { base64, mimeType } = await compressToBase64(file)
      const filename = `teacher_upload_${studentId.slice(0, 8)}_${Date.now()}.jpg`
      const res = await fetch('/api/upload-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, filename }),
      })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = (await res.json()) as { url?: string }
      if (url) {
        setImageUrls(prev => ({ ...prev, [studentId]: url }))
        setViewingUrl(url)
        setViewingName(students.find(s => s.id === studentId)?.name ?? '')
        setZoom(1)
        setRotation(0)
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setUploadingFor(null)
    }
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

  const renderStudentRow = (student: Student, idx: number) => {
    const entry    = getEntry(student.id)
    const hasScore = entry.score !== ''
    const pct      = hasScore ? parseInt(entry.score) / totalMarks : null
    const isActive = activeIdx === idx
    const bdList   = breakdowns[student.id]
    const bdOpen   = breakdownOpen[student.id] ?? false
    const isAi     = aiScannedIds.has(student.id)
    const isEdited = editedIds.has(student.id)
    const paperUrl = imageUrls[student.id]
    const isUploading = uploadingFor === student.id

    return (
      <div key={student.id} className={clsx(
        'rounded-2xl border-2 transition-all',
        hasScore ? 'border-emerald-300 bg-emerald-50' : isActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white',
      )}>
        {/* Main row */}
        <div
          className="flex items-center gap-3 p-3 cursor-pointer"
          onClick={() => { setActiveIdx(idx); inputRefs.current[idx]?.focus() }}
        >
          {/* Roll badge */}
          <div className={clsx(
            'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
            hasScore ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600',
          )}>
            {hasScore ? <Check size={15} /> : student.rollNumber}
          </div>

          <span className="flex-1 font-semibold text-slate-900 min-w-0 truncate">{student.name}</span>

          {/* Source badge */}
          {isAi && hasScore && (
            isEdited ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                Overridden
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 shrink-0">
                <ScanLine size={9} /> AI Graded
              </span>
            )
          )}

          {/* View paper button OR attach paper button */}
          {paperUrl ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setViewingUrl(paperUrl)
                setViewingName(student.name)
                setZoom(1)
                setRotation(0)
              }}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-colors shrink-0"
            >
              <FileImage size={9} /> View Paper
            </button>
          ) : (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); openUpload(student.id) }}
              disabled={isUploading}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100 transition-colors shrink-0"
            >
              {isUploading
                ? <><Loader2 size={9} className="animate-spin" /> Uploading…</>
                : <><Paperclip size={9} /> Attach Paper</>}
            </button>
          )}

          {/* Feedback toggle */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggleFeedback(student.id) }}
            className={clsx(
              'text-xs font-semibold px-2 py-1 rounded-lg transition-colors shrink-0',
              entry.feedback ? 'bg-violet-100 text-violet-700' : 'text-slate-400 hover:bg-slate-100',
            )}
          >
            {entry.feedbackOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {/* Score input */}
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

        {/* AI suggestion info bar */}
        {isAi && hasScore && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-sky-50 border border-sky-100 flex items-center gap-2">
            <ScanLine size={11} className="text-sky-500 shrink-0" />
            {isEdited ? (
              <p className="text-xs text-sky-800 font-medium leading-snug">
                AI suggested{' '}
                <span className="font-black line-through text-sky-400">{originalAiScores[student.id]}/{totalMarks}</span>
                {' → '}
                <span className="font-black text-amber-700">{entry.score}/{totalMarks}</span>
                {' '}(teacher override)
              </p>
            ) : (
              <p className="text-xs text-sky-800 font-medium leading-snug">
                AI graded · suggested{' '}
                <span className="font-black">{originalAiScores[student.id]}/{totalMarks}</span>
                {' '}&mdash; edit the score above to override
              </p>
            )}
          </div>
        )}

        {/* Feedback row */}
        {entry.feedbackOpen && (
          <div className="px-3 pb-3">
            <input
              type="text"
              value={entry.feedback}
              onChange={e => setFeedback(student.id, e.target.value)}
              placeholder="e.g. confused on Q3, skipped last question, good work…"
              maxLength={120}
              className="w-full text-sm border border-violet-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700 placeholder:text-slate-300"
            />
          </div>
        )}

        {/* AI question-by-question breakdown */}
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

  // ── Paper lightbox ──────────────────────────────────────────────────────────
  const paperLightbox = viewingUrl && (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.93)' }}
      className="flex flex-col"
      onClick={() => setViewingUrl(null)}
    >
      {/* Toolbar — stop propagation so clicks inside don't close */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <FileImage size={13} className="text-white/70" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">{viewingName}</p>
            <p className="text-white/40 text-[10px]">Answer paper · tap outside to close</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <span className="text-white text-xs font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button type="button" onClick={() => setRotation(r => (r + 90) % 360)}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="Rotate">
            <RotateCw size={14} />
          </button>
          <button type="button" onClick={() => setViewingUrl(null)}
            className="w-8 h-8 rounded-lg bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500 transition-colors ml-1" title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable image */}
      <div
        className="flex-1 overflow-auto flex items-start justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={viewingUrl}
          alt={`${viewingName}'s answer paper`}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: 'top center',
            maxWidth: rotation % 180 === 0 ? '100%' : 'calc(100vh - 8rem)',
            transition: 'transform 0.15s ease',
            display: 'block',
          }}
          draggable={false}
        />
      </div>

      <div className="shrink-0 text-center py-2">
        <p className="text-white/25 text-xs">Tap outside to close · edit score after closing</p>
      </div>
    </div>
  )

  // ── Hidden file input for teacher-side upload ───────────────────────────────
  const uploadInput = (
    <input
      ref={uploadRef}
      type="file"
      accept="image/*"
      className="sr-only"
      aria-hidden
      onChange={handleUploadFile}
    />
  )

  return (
    <div className="space-y-4">
      {paperLightbox}
      {uploadInput}

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

      {/* Student list */}
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
