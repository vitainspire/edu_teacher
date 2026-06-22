'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  BookOpen, Users, Save, Check, Sparkles,
  Lightbulb, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, CheckCircle2,
  GraduationCap, Play, Zap,
} from 'lucide-react'
import type { LessonPrep } from '@/lib/types'
import { useApp } from '@/lib/context'
import { aiKey, getAiCache, setAiCache, TTL } from '@/lib/ai-cache'
import clsx from 'clsx'

type Status = 'present' | 'absent' | 'late'
const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  present: { label: 'P', color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-300' },
  absent:  { label: 'A', color: 'text-red-700',     bg: 'bg-red-100 border-red-300' },
  late:    { label: 'L', color: 'text-amber-700',   bg: 'bg-amber-100 border-amber-300' },
}
interface EngageData { hook: string; watchNote: string; realLifeExamples?: string[] }

export default function AttendancePage() {
  const { classId } = useParams<{ classId: string }>()
  const router      = useRouter()
  const {
    classes,
    students: rawStudents,
    getClassSyllabus,
    sessions: rawSessions,
    attendance: rawAttendance,
    recordSession, toggleTopicComplete,
    syllabusSubTopics, toggleSubTopicComplete,
  } = useApp()

  const cls      = classes.find(c => c.id === classId)
  // Use raw React state (not ref-based getter) so the effect never sees a stale empty list
  const students = useMemo(
    () => rawStudents.filter(s => s.classId === classId && s.isActive),
    [rawStudents, classId]
  )
  const syllabus = getClassSyllabus(classId)
  const today    = new Date().toISOString().split('T')[0]

  // Raw-state derived values — not ref-based, so never stale inside effects
  const classSessions = useMemo(
    () => rawSessions.filter(s => s.classId === classId).sort((a, b) => b.date.localeCompare(a.date)),
    [rawSessions, classId]
  )

  // Topic state — teacher types freely or picks from syllabus
  const [topicText, setTopicText]               = useState('')
  const [selectedTopicId, setSelectedTopicId]   = useState('')
  const [selectedSubTopicId, setSelectedSubTopicId] = useState('')
  const [showSyllabusPicker, setShowSyllabusPicker] = useState(false)

  const [sessionNote, setSessionNote]     = useState('')
  const [statusMap, setStatusMap]         = useState<Record<string, Status>>({})
  const [saving, setSaving]               = useState(false)
  // Prevent the fresh-form init effect from firing more than once (syllabus may arrive later)
  const hasInitialized = useRef(false)
  // manuallyReset: teacher tapped "Record Another Session" → ignore today's saved data
  const [manuallyReset, setManuallyReset] = useState(false)
  // justSaved: true only right after saving in this session (show Class Starter)
  const [justSaved, setJustSaved]         = useState(false)
  const [engageData, setEngageData]       = useState<EngageData | null>(null)
  const [engageLoading, setEngageLoading] = useState(false)
  const [markingDone, setMarkingDone]     = useState(false)
  const [weekComplete, setWeekComplete]   = useState<number | null>(null)
  // Post-save late-arrival edits: absent → late after session is saved
  const [lateEdits, setLateEdits] = useState<Record<string, Status>>({})
  // Second-session mode: attendance inherited from morning roll, show compact view
  const [isInheritedAttendance, setIsInheritedAttendance] = useState(false)
  const [showFullAttendance, setShowFullAttendance]       = useState(false)
  const inheritedFromMorning = useRef(false)
  const [lessonPrep, setLessonPrep]       = useState<LessonPrep | null>(null)
  const [prepLoading, setPrepLoading]     = useState(false)
  const [prepOpen, setPrepOpen]           = useState(false)

  // ── Derived state (no effects needed) ─────────────────────────────────────
  // todaySession: the session saved for this class today, if any
  const todaySession = useMemo(
    () => manuallyReset ? undefined : classSessions.find(s => s.date === today),
    [classSessions, today, manuallyReset]
  )
  // isSaved: true whenever today's session exists AND teacher hasn't manually cleared
  const isSaved = !!todaySession

  // Build the attendance map from raw DB records when session exists
  const todayAttMap = useMemo(() => {
    if (!todaySession) return null
    const map: Record<string, Status> = {}
    students.forEach(s => { map[s.id] = 'present' })
    rawAttendance
      .filter(a => a.sessionId === todaySession.id)
      .forEach(a => { map[a.studentId] = a.status as Status })
    return map
  }, [todaySession, rawAttendance, students])

  // First session of today — not affected by manuallyReset, always reflects the morning roll.
  // Used to auto-inherit attendance for subsequent sessions of the same class.
  const todayFirstSession = useMemo(
    () => classSessions.find(s => s.date === today),
    [classSessions, today]
  )
  const todayFirstAttMap = useMemo(() => {
    if (!todayFirstSession) return null
    const map: Record<string, Status> = {}
    students.forEach(s => { map[s.id] = 'present' })
    rawAttendance
      .filter(a => a.sessionId === todayFirstSession.id)
      .forEach(a => { map[a.studentId] = a.status as Status })
    return map
  }, [todayFirstSession, rawAttendance, students])

  // displayMap: use DB records when saved, teacher's edits when not
  // effectiveMap: also layers post-save late-arrival edits on top
  const displayMap   = todayAttMap ?? statusMap
  const effectiveMap = isSaved ? { ...displayMap, ...lateEdits } : displayMap
  // displayTopic: show saved session topic on restore, live input when editing
  const displayTopic = todaySession?.topic ?? topicText

  const selectedTopic  = syllabus.find(t => t.id === selectedTopicId)
  const topicSubTopics = useMemo(
    () => syllabusSubTopics
      .filter(s => s.topicId === selectedTopicId)
      .sort((a, b) => a.orderIndex - b.orderIndex),
    [syllabusSubTopics, selectedTopicId]
  )
  const selectedSubTopic       = topicSubTopics.find(s => s.id === selectedSubTopicId)
  const nextIncompleteSubTopic = topicSubTopics.find(s => !s.isCompleted)

  // Initialize fresh form: pre-fill all-present + suggest next topic.
  // Restore is handled by todaySession/todayAttMap useMemos — no effect needed for that.
  // hasInitialized prevents a late-arriving syllabus from re-running this and wiping the teacher's edits.
  useEffect(() => {
    if (isSaved || students.length === 0) return
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Only reset statusMap if "Record Another Session" didn't already pre-fill from morning roll
    if (!inheritedFromMorning.current) {
      const initial: Record<string, Status> = {}
      students.forEach(s => { initial[s.id] = 'present' })
      setStatusMap(initial)
      setIsInheritedAttendance(false)
      setShowFullAttendance(false)
    }
    inheritedFromMorning.current = false

    if (syllabus.length > 0 && !topicText) {
      const lastSession = classSessions[0]
      let suggested = null
      if (lastSession) {
        suggested = syllabus.find(t => t.id === lastSession.syllabusTopicId && !t.isCompleted) ?? null
      }
      if (!suggested) {
        const sorted = [...syllabus].sort((a, b) => {
          if (a.weekNumber != null && b.weekNumber != null) return a.weekNumber - b.weekNumber
          return a.orderIndex - b.orderIndex
        })
        suggested = sorted.find(t => !t.isCompleted) ?? null
      }
      if (suggested) {
        setTopicText(suggested.topic)
        setSelectedTopicId(suggested.id)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaved, students.length, syllabus.length, classSessions.length])

  // Auto-pick first incomplete sub-topic when topic changes
  useEffect(() => {
    if (!selectedTopicId) return
    const subs = syllabusSubTopics
      .filter(s => s.topicId === selectedTopicId && !s.isCompleted)
      .sort((a, b) => a.orderIndex - b.orderIndex)
    setSelectedSubTopicId(subs[0]?.id ?? '')
  }, [selectedTopicId, syllabusSubTopics])

  const fetchPrep = async (topic: string) => {
    if (!topic.trim()) return
    setPrepLoading(true)
    setPrepOpen(true)
    setLessonPrep(null)
    try {
      const ck = aiKey('lesson-prep', { topic: topic.toLowerCase().trim(), subject: (cls?.name ?? '').toLowerCase(), grade: cls?.grade ?? '' })
      const cached = getAiCache<LessonPrep>(ck)
      if (cached) { setLessonPrep(cached); setPrepLoading(false); return }
      const res = await fetch('/api/lesson-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, subject: cls?.name ?? '', grade: cls?.grade ?? '' }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiCache(ck, data, TTL.ONE_MONTH)
        setLessonPrep(data)
      }
    } catch { /* ignore */ }
    finally { setPrepLoading(false) }
  }

  const handleTopicTextChange = (val: string) => {
    setTopicText(val)
    const match = syllabus.find(t => t.topic.toLowerCase() === val.toLowerCase())
    setSelectedTopicId(match?.id ?? '')
    setEngageData(null)
    setLessonPrep(null)
    setPrepOpen(false)
  }

  const handlePickSyllabusTopic = (topicId: string, topicName: string) => {
    setSelectedTopicId(topicId)
    setTopicText(topicName)
    setShowSyllabusPicker(false)
    setEngageData(null)
  }

  const fetchHook = (label: string, currentMap: Record<string, Status>) => {
    setEngageData(null)
    setEngageLoading(true)
    const presentStudents = students
      .filter(s => currentMap[s.id] !== 'absent')
      .map(s => ({ name: s.name, interests: s.interests ?? [], goal: s.goal ?? '' }))
    const absentNames = students
      .filter(s => currentMap[s.id] === 'absent')
      .map(s => s.name)
    const topInterests = presentStudents.flatMap(s => s.interests).reduce((acc: Record<string, number>, i) => { acc[i] = (acc[i] ?? 0) + 1; return acc }, {})
    const top3 = Object.entries(topInterests).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([i]) => i).sort().join('~')
    const absentBucket = absentNames.length === 0 ? 'full' : absentNames.length < 4 ? 'few' : 'many'
    const ck = aiKey('engage', { topic: label.toLowerCase().trim(), grade: cls?.grade ?? '', top3, absentBucket })
    const cached = getAiCache<EngageData>(ck)
    if (cached) { setEngageData(cached); setEngageLoading(false); return }
    fetch('/api/engage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: label,
        presentStudents,
        totalStudents: students.length,
        absentNames,
        grade: cls?.grade ?? '',
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setAiCache(ck, data, TTL.ONE_DAY); setEngageData(data) }
        else setEngageData({ hook: '', watchNote: '' })
      })
      .catch(() => setEngageData({ hook: '', watchNote: '' }))
      .finally(() => setEngageLoading(false))
  }

  const toggle = (studentId: string) => {
    setStatusMap(prev => {
      const cycle: Status[] = ['present', 'absent', 'late']
      const cur = prev[studentId] ?? 'present'
      return { ...prev, [studentId]: cycle[(cycle.indexOf(cur) + 1) % 3] }
    })
  }

  const setAll = (status: Status) => {
    const next: Record<string, Status> = {}
    students.forEach(s => { next[s.id] = status })
    setStatusMap(next)
  }

  const handleSave = async () => {
    if (!topicText.trim()) return
    setSaving(true)
    const topicId   = selectedTopicId || ''
    const topicName = selectedSubTopic ? `${topicText} — ${selectedSubTopic.name}` : topicText
    await recordSession(
      classId, today, topicId, topicText,
      students.map(s => ({ studentId: s.id, status: statusMap[s.id] ?? 'present' })),
      sessionNote.trim() || undefined,
    )
    setSaving(false)
    setManuallyReset(false)   // let todaySession be found → isSaved becomes true
    setJustSaved(true)
    fetchHook(topicName, statusMap)
  }

  const handleMarkDone = async () => {
    if (!selectedTopic) return
    setMarkingDone(true)
    if (topicSubTopics.length > 0 && selectedSubTopicId) {
      await toggleSubTopicComplete(selectedSubTopicId, true)
    } else {
      await toggleTopicComplete(selectedTopic.id, true)
      if (selectedTopic.weekNumber != null) {
        const weekTopics = syllabus.filter(t => t.weekNumber === selectedTopic.weekNumber)
        const remaining  = weekTopics.filter(t => t.id !== selectedTopic.id && !t.isCompleted)
        if (remaining.length === 0 && weekTopics.length > 0) setWeekComplete(selectedTopic.weekNumber)
      }
    }
    setMarkingDone(false)
  }

  const handleMarkLate = async (studentId: string) => {
    if (!todaySession) return
    const current = effectiveMap[studentId]
    const next: Status = current === 'absent' ? 'late' : 'absent'
    // Update DB record directly
    const { db } = await import('@/lib/db')
    const rec = await db.attendance
      .where('sessionId').equals(todaySession.id)
      .filter(a => a.studentId === studentId)
      .first()
    if (rec) await db.attendance.update(rec.id, { status: next })
    setLateEdits(prev => ({ ...prev, [studentId]: next }))
  }

  const presentCount   = students.filter(s => effectiveMap[s.id] === 'present').length
  const absentCount    = students.filter(s => effectiveMap[s.id] === 'absent').length
  const lateCount      = students.filter(s => effectiveMap[s.id] === 'late').length
  const absentStudents = students.filter(s => effectiveMap[s.id] === 'absent')
  const lateStudents   = students.filter(s => effectiveMap[s.id] === 'late')

  const markDoneLabel = topicSubTopics.length > 0 && selectedSubTopic
    ? `Mark "${selectedSubTopic.name}" as done`
    : selectedTopic ? `Mark "${selectedTopic.topic}" as fully covered` : ''

  const markDoneVisible = isSaved && selectedTopicId && (
    topicSubTopics.length > 0
      ? !!selectedSubTopicId && !selectedSubTopic?.isCompleted
      : selectedTopic && !selectedTopic.isCompleted
  ) && weekComplete === null

  if (students.length === 0) {
    return (
      <div className="p-4">
        <div className="card text-center py-14">
          <Users size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">No students yet</p>
          <p className="text-sm text-slate-400 mt-1">Add students in the Students tab first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-8">

      {/* ── Session header ── */}
      <div className={`rounded-3xl p-5 shadow-md ${isSaved ? 'bg-emerald-700' : 'bg-blue-700'}`}>
        <div className="flex items-center gap-2 mb-3">
          {isSaved ? <Check size={12} className="text-emerald-300" /> : <Sparkles size={12} className="text-blue-300" />}
          <p className={`text-xs font-bold uppercase tracking-wide ${isSaved ? 'text-emerald-300' : 'text-blue-300'}`}>
            {new Date(today + 'T00:00:00').toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'short',
            })}
          </p>
        </div>

        <p className={`text-xs font-semibold mb-1.5 ${isSaved ? 'text-emerald-300' : 'text-blue-300'}`}>
          {isSaved ? 'Taught today' : 'What are you teaching today?'}
        </p>

        {/* Topic — editable before save, summary after */}
        {isSaved ? (
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <p className="text-white font-bold text-sm">{displayTopic}</p>
            <p className="text-emerald-200 text-xs font-semibold">
              {presentCount}P · {absentCount > 0 ? `${absentCount}A` : 'all present'}
            </p>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={topicText}
              onChange={e => handleTopicTextChange(e.target.value)}
              placeholder="e.g. Fractions, Photosynthesis, World War II…"
              className="w-full bg-white/15 text-white placeholder-blue-300/50 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:bg-white/20 transition-colors"
            />
            {selectedTopic && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <CheckCircle2 size={16} className="text-blue-300" />
              </div>
            )}
          </div>
        )}

        {/* Prep for class button */}
        {displayTopic.trim() && !isSaved && (
          <button
            type="button"
            onClick={() => prepOpen ? setPrepOpen(false) : fetchPrep(topicText)}
            className="mt-3 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#e0e7ff' }}
          >
            <Zap size={10} />
            {prepLoading ? 'Loading prep…' : prepOpen ? 'Hide prep' : 'Prep for class'}
            {!prepLoading && <ChevronDown size={10} className={prepOpen ? 'rotate-180' : ''} />}
          </button>
        )}

        {/* Lesson prep panel */}
        {prepOpen && (
          <div className="mt-2 rounded-2xl p-4 space-y-3 text-sm" style={{ background: 'rgba(255,255,255,0.12)' }}>
            {prepLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-3 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.2)', width: `${70 + i * 8}%` }} />)}
              </div>
            ) : lessonPrep ? (
              <>
                <div>
                  <p className="text-[11px] font-bold text-blue-200 uppercase tracking-wide mb-1">Explanation</p>
                  <p className="text-white/90 text-xs leading-relaxed">{lessonPrep.explanation}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-blue-200 uppercase tracking-wide mb-1">Indian Examples</p>
                  <ul className="space-y-1">
                    {lessonPrep.examples.map((ex, i) => (
                      <li key={i} className="text-white/80 text-xs flex gap-1.5"><span className="text-blue-300">·</span>{ex}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-blue-200 uppercase tracking-wide mb-1">Common Mistakes</p>
                  <ul className="space-y-1">
                    {lessonPrep.commonMistakes.map((m, i) => (
                      <li key={i} className="text-white/80 text-xs flex gap-1.5"><span className="text-amber-300">⚠</span>{m}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-blue-200 uppercase tracking-wide mb-1">Quick Activity (2 min)</p>
                  <p className="text-white/90 text-xs leading-relaxed">{lessonPrep.quickActivity}</p>
                </div>
              </>
            ) : (
              <p className="text-white/50 text-xs">Could not load prep. Tap to retry.</p>
            )}
          </div>
        )}

        {/* Syllabus quick-pick */}
        {syllabus.length > 0 && !isSaved && (
          <button
            type="button"
            onClick={() => setShowSyllabusPicker(p => !p)}
            className="mt-3 flex items-center gap-1.5 bg-white/10 text-blue-200 text-xs font-bold px-3 py-1.5 rounded-xl active:bg-white/20 transition-colors"
          >
            <BookOpen size={10} />
            {showSyllabusPicker ? 'Close syllabus' : 'Pick from syllabus'}
            {showSyllabusPicker ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}

        {/* Sub-topic badge */}
        {selectedTopicId && topicSubTopics.length > 0 && (
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-xs text-blue-300 font-medium">Sub-topic:</span>
            <span className="text-xs bg-white/15 text-white font-bold px-2.5 py-1 rounded-xl">
              {selectedSubTopic ? selectedSubTopic.name : '—'}
            </span>
          </div>
        )}
      </div>

      {/* ── Syllabus picker ── */}
      {showSyllabusPicker && (
        <div className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Your Syllabus</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {syllabus.map((topic, idx) => {
              const subCount  = syllabusSubTopics.filter(s => s.topicId === topic.id).length
              const doneSubs  = syllabusSubTopics.filter(s => s.topicId === topic.id && s.isCompleted).length
              return (
                <button key={topic.id} type="button"
                  onClick={() => handlePickSyllabusTopic(topic.id, topic.topic)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-50 last:border-0 active:bg-slate-50 transition-colors',
                    topic.isCompleted && 'opacity-50',
                  )}>
                  <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('font-semibold text-sm truncate', topic.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800')}>
                      {topic.topic}
                    </p>
                    {subCount > 0 && (
                      <p className="text-xs text-slate-400">{doneSubs}/{subCount} sub-topics done</p>
                    )}
                  </div>
                  {topic.isCompleted && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full shrink-0">Done</span>
                  )}
                  {selectedTopicId === topic.id && !topic.isCompleted && (
                    <CheckCircle2 size={14} className="text-blue-500 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sub-topic picker (when syllabus topic is selected with sub-topics) ── */}
      {selectedTopicId && topicSubTopics.length > 0 && !isSaved && (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sub-topics of &quot;{selectedTopic?.topic}&quot;</p>
          </div>
          {topicSubTopics.map(sub => (
            <button key={sub.id} type="button"
              onClick={() => setSelectedSubTopicId(sub.id)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 text-left transition-all',
                selectedSubTopicId === sub.id ? 'bg-blue-50' : 'active:bg-slate-50',
              )}>
              {sub.isCompleted
                ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
              <span className={clsx('flex-1 text-sm font-semibold', sub.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800')}>
                {sub.name}
              </span>
              {sub.isCompleted && (
                <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full">Done</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Session Note ── */}
      {displayTopic.trim() && !isSaved && (
        <div className="bg-white rounded-3xl border border-slate-100 px-4 py-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">What did you cover today?</p>
          <textarea
            value={sessionNote}
            onChange={e => setSessionNote(e.target.value)}
            placeholder="e.g. Taught 3-digit × 1-digit with worked examples (optional)"
            rows={2}
            className="w-full text-sm text-slate-800 placeholder-slate-400 bg-slate-50 rounded-2xl px-3 py-2.5 border border-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      )}

      {/* ── Attendance ── */}
      {displayTopic.trim() && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Attendance</p>
            <p className="text-xs text-slate-400 font-semibold">
              {presentCount}P · {absentCount}A{lateCount > 0 ? ` · ${lateCount}L` : ''}
            </p>
          </div>

          {/* ── Compact inherited view: morning roll already taken, just confirm ── */}
          {!isSaved && isInheritedAttendance && !showFullAttendance && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Check size={13} className="text-blue-600" />
                  <p className="text-sm font-bold text-blue-800">Morning roll carried over</p>
                </div>
                <button type="button" onClick={() => setShowFullAttendance(true)}
                  className="text-xs font-bold text-blue-500 underline">
                  Edit
                </button>
              </div>
              {absentCount === 0 && lateCount === 0 ? (
                <p className="text-xs text-blue-600">All {students.length} students present today</p>
              ) : (
                <>
                  <p className="text-xs text-blue-600 mb-2">
                    {presentCount} present
                    {absentCount > 0 ? ` · ${absentCount} absent` : ''}
                    {lateCount > 0 ? ` · ${lateCount} late` : ''}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {absentStudents.map(s => (
                      <span key={s.id} className="text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full">
                        {s.name}
                      </span>
                    ))}
                    {lateStudents.map(s => (
                      <span key={s.id} className="text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full">
                        {s.name} (late)
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Full attendance controls (first session, or teacher chose to edit) ── */}
          {!isSaved && (!isInheritedAttendance || showFullAttendance) && (
            <div className="space-y-2">
              {isInheritedAttendance && showFullAttendance && (
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs text-blue-600 font-semibold">Editing morning roll — applies to this session only</p>
                  <button type="button" onClick={() => setShowFullAttendance(false)}
                    className="text-xs font-bold text-slate-500 underline">
                    ← Summary
                  </button>
                </div>
              )}
              <button type="button" onClick={() => setAll('present')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 active:scale-95 transition-all">
                <Check size={14} /> Mark All Present
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAll('absent')}
                  className="flex-1 py-2 rounded-2xl text-xs font-bold bg-red-50 text-red-600 border border-red-200 active:scale-95 transition-all">
                  All Absent
                </button>
                <button type="button" onClick={() => setAll('late')}
                  className="flex-1 py-2 rounded-2xl text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 active:scale-95 transition-all">
                  All Late
                </button>
              </div>
            </div>
          )}

          {/* ── Student list (full when saved or expanded; hidden in compact inherited mode) ── */}
          {(isSaved || !isInheritedAttendance || showFullAttendance) && (
            <div className="space-y-2">
              {students.map(student => {
                const status     = effectiveMap[student.id] ?? 'present'
                const cfg        = STATUS_CONFIG[status]
                const canToggle  = !isSaved || status === 'absent' || status === 'late'
                return (
                  <button key={student.id} type="button"
                    onClick={() => {
                      if (!isSaved) toggle(student.id)
                      else if (status === 'absent' || status === 'late') handleMarkLate(student.id)
                    }}
                    disabled={isSaved && status === 'present'}
                    className={clsx(
                      'w-full flex items-center gap-3 card text-left',
                      canToggle && 'active:scale-[0.98] transition-transform',
                    )}>
                    <div className={clsx('w-10 h-10 rounded-full border-2 flex items-center justify-center font-extrabold text-sm shrink-0', cfg.bg, cfg.color)}>
                      {cfg.label}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{student.name}</p>
                      <p className="text-xs text-slate-400">
                        Roll {student.rollNumber}
                        {student.interests?.length > 0 && <span className="ml-1 text-blue-400">· {student.interests[0]}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx('px-3 py-1 rounded-full text-xs font-bold border', cfg.bg, cfg.color)}>{status}</span>
                      {isSaved && (status === 'absent' || status === 'late') && (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {status === 'absent' ? 'tap → Late' : 'tap → Absent'}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {!isSaved && (
            <button type="button" onClick={handleSave}
              disabled={saving || !topicText.trim()}
              className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 bg-blue-700 text-white active:scale-95 transition-all shadow-sm disabled:opacity-50">
              {saving ? <span className="animate-pulse">Saving…</span> : <><Save size={18} /> Save Session</>}
            </button>
          )}
        </div>
      )}

      {/* ── Post-save ── */}
      {isSaved && (
        <div className="space-y-3">

          {/* Confirmation */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Check size={20} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">
                Saved — {presentCount}P
                {absentCount > 0 ? `, ${absentCount}A` : ''}
                {lateCount > 0 ? `, ${lateCount}L` : ''}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">{displayTopic}</p>
              {todaySession?.sessionNote && (
                <p className="text-xs text-emerald-500 mt-0.5 italic">{todaySession.sessionNote}</p>
              )}
            </div>
          </div>

          {/* ── Class Starter — only shown after a fresh save in this session, not on restore ── */}
          {justSaved && <div
            className="rounded-3xl p-5 space-y-3"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              boxShadow: '0 8px 32px rgba(79,70,229,0.35)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Lightbulb size={18} className="text-white" />
              </div>
              <div>
                <p className="font-black text-white text-sm leading-none">Class Starter</p>
                <p className="text-[11px] text-white/60 mt-0.5 font-medium">Read this out loud to start your class</p>
              </div>
              {!engageLoading && engageData && (
                <button type="button"
                  onClick={() => {
                    const label = selectedSubTopic
                      ? `${topicText} — ${selectedSubTopic.name}`
                      : topicText
                    fetchHook(label, statusMap)
                  }}
                  className="ml-auto p-2 rounded-xl active:bg-white/20 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <RefreshCw size={13} className="text-white/70" />
                </button>
              )}
            </div>

            {engageLoading ? (
              <div className="space-y-2.5">
                <div className="h-3 rounded-full animate-pulse w-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <div className="h-3 rounded-full animate-pulse w-5/6" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <div className="h-3 rounded-full animate-pulse w-3/4" style={{ background: 'rgba(255,255,255,0.2)' }} />
              </div>
            ) : engageData?.hook ? (
              <div className="rounded-2xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <p className="text-sm text-white leading-relaxed font-medium">{engageData.hook}</p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Generating…</p>
            )}
          </div>}

          {/* ── Real Life Connections ── */}
          {justSaved && !engageLoading && engageData?.realLifeExamples && engageData.realLifeExamples.length > 0 && (
            <div className="rounded-3xl p-5 space-y-3" style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              boxShadow: '0 8px 32px rgba(5,150,105,0.35)',
            }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <span className="text-lg">🌍</span>
                </div>
                <div>
                  <p className="font-black text-white text-sm leading-none">Where Will You Use This?</p>
                  <p className="text-[11px] mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    Tell your students — this topic is already in their life
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {engageData.realLifeExamples.map((ex, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                      style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>
                      {i + 1}
                    </span>
                    <p className="text-sm text-white leading-relaxed font-medium">{ex}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Absent students — with late-arrival toggle */}
          {(absentCount > 0 || lateCount > 0) && (
            <div className="card border-red-100 bg-red-50/40">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={14} className="text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-900">
                    {absentCount > 0 ? `${absentCount} absent` : ''}{absentCount > 0 && lateCount > 0 ? ' · ' : ''}{lateCount > 0 ? `${lateCount} arrived late` : ''}
                  </p>
                  {absentCount > 0 && (
                    <p className="text-[11px] text-red-400 font-medium mt-0.5">Tap a student to mark as Late if they arrived</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                {absentStudents.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => handleMarkLate(s.id)}
                    className="w-full flex items-center gap-2.5 bg-white rounded-xl px-3 py-2 border border-red-100 active:bg-amber-50 active:border-amber-200 transition-colors">
                    <span className="w-7 h-7 bg-red-100 text-red-600 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0">
                      {s.name[0].toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{s.name}</span>
                    <span className="text-xs text-slate-400">Roll #{s.rollNumber}</span>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">→ Late</span>
                  </button>
                ))}
                {lateStudents.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => handleMarkLate(s.id)}
                    className="w-full flex items-center gap-2.5 bg-white rounded-xl px-3 py-2 border border-amber-200 active:bg-red-50 transition-colors">
                    <span className="w-7 h-7 bg-amber-100 text-amber-700 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0">
                      {s.name[0].toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{s.name}</span>
                    <span className="text-xs text-slate-400">Roll #{s.rollNumber}</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">Late</span>
                  </button>
                ))}
              </div>
              {engageData?.watchNote && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mt-2.5 leading-relaxed">
                  📌 {engageData.watchNote}
                </p>
              )}
            </div>
          )}

          {/* Next sub-topic suggestion */}
          {topicSubTopics.length > 0 && nextIncompleteSubTopic && nextIncompleteSubTopic.id !== selectedSubTopicId && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-xs font-bold text-blue-700 mb-1">Next sub-topic</p>
              <p className="text-sm font-semibold text-blue-900">{nextIncompleteSubTopic.name}</p>
              <button type="button" onClick={() => setSelectedSubTopicId(nextIncompleteSubTopic.id)}
                className="mt-2 text-xs font-bold text-blue-600 underline">
                Switch to this sub-topic
              </button>
            </div>
          )}

          {/* Mark as done (only visible for syllabus-linked topics) */}
          {markDoneVisible && (
            <button type="button" onClick={handleMarkDone} disabled={markingDone}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-sm active:scale-[0.98] transition-all disabled:opacity-60">
              <CheckCircle2 size={17} />
              {markingDone ? 'Saving…' : markDoneLabel}
            </button>
          )}

          {/* Week complete → create exam */}
          {weekComplete !== null && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎉</span>
                <p className="font-extrabold text-amber-900 text-lg">Week {weekComplete} complete!</p>
              </div>
              <p className="text-sm text-amber-800 mb-4 leading-relaxed">
                All Week {weekComplete} topics are done. A good time to run an exam.
              </p>
              <button type="button"
                onClick={() => router.push(`/classes/${classId}/marks?createTest=1`)}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white font-extrabold py-3 rounded-2xl text-sm active:scale-[0.98] transition-transform shadow-sm">
                <GraduationCap size={16} /> Create Exam for Week {weekComplete}
              </button>
            </div>
          )}

          {/* Record another session */}
          <button type="button"
            onClick={() => {
              setManuallyReset(true)
              setJustSaved(false)
              hasInitialized.current = false
              setWeekComplete(null)
              setEngageData(null)
              setTopicText('')
              setSelectedTopicId('')
              setSessionNote('')
              setLateEdits({})
              setShowFullAttendance(false)

              if (todayFirstAttMap) {
                // Inherit morning roll — subject teacher doesn't re-mark 40 students
                setStatusMap({ ...todayFirstAttMap })
                setIsInheritedAttendance(true)
                inheritedFromMorning.current = true
              } else {
                const initial: Record<string, Status> = {}
                students.forEach(s => { initial[s.id] = 'present' })
                setStatusMap(initial)
                setIsInheritedAttendance(false)
                inheritedFromMorning.current = false
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 text-slate-700 text-sm font-bold active:scale-95 transition-transform">
            <Play size={13} fill="currentColor" /> Record Another Session
          </button>
        </div>
      )}
    </div>
  )
}
