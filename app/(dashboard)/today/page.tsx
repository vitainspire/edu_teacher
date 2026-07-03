'use client'
import { useState, useCallback, useMemo } from 'react'
import { useApp } from '@/lib/context'
import {
  Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  BookOpen, AlertCircle, CheckCircle2, RotateCcw,
  UserX, AlertTriangle, BarChart2, Sparkles,
} from 'lucide-react'

const CLASS_COLORS = ['#2563eb']

function relativeDate(dateStr: string): string {
  const d    = new Date(dateStr)
  const now  = new Date()
  const diff = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface BridgeNote { concept: string; text: string }
interface LessonSection {
  type: 'teach' | 'check'
  title: string
  content: string
  bridgeNote?: BridgeNote
}
interface GapTopic {
  topic: string; avgMastery: number
  weakStudentCount: number; totalStudents: number
}
interface SmartResult {
  topic: string
  gapTopics: GapTopic[]
  lesson: { hook: string; sections: LessonSection[]; closingActivity: string }
}
type GenState = 'idle' | 'loading' | 'done' | 'error'

type Slide =
  | { kind: 'hook' }
  | { kind: 'section'; idx: number; stepNum: number | null }
  | { kind: 'closing' }

function buildSlides(result: SmartResult): Slide[] {
  let stepNum = 0
  return [
    { kind: 'hook' },
    ...result.lesson.sections.map((sec, i) => {
      if (sec.type === 'teach') stepNum++
      return { kind: 'section' as const, idx: i, stepNum: sec.type === 'teach' ? stepNum : null }
    }),
    { kind: 'closing' },
  ]
}

function fmt(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function cacheKey(classId: string, topic: string, sub?: string): string {
  return `${classId}::${topic.trim().toLowerCase()}::${(sub ?? '').trim().toLowerCase()}`
}

export default function TodayPage() {
  const { teacher, classes, getTodaySchedule, getClassSyllabus, getTopicSubTopics, getBriefingData } = useApp()

  const briefingMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getBriefingData>[number]> = {}
    for (const b of getBriefingData()) map[b.classId] = b
    return map
  }, [getBriefingData])

  const todayEntries = getTodaySchedule()
  const hasTimetable = todayEntries.length > 0

  type Card = {
    classId: string; className: string; grade: string
    section: string; period: number | null
    start: string | null; end: string | null; color: string
    label: string | null
  }

  const cards: Card[] = hasTimetable
    ? [...todayEntries]
        .sort((a, b) => a.periodNumber - b.periodNumber)
        .map((e, i) => {
          const cls = classes.find(c => c.id === e.classId)
          return {
            classId: e.classId,
            className: cls?.name ?? 'Unknown',
            grade: cls?.grade ?? '',
            section: cls?.section ?? '',
            period: e.periodNumber,
            start: e.startTime,
            end: e.endTime,
            color: CLASS_COLORS[i % CLASS_COLORS.length],
            label: e.label ?? null,
          }
        })
        .filter((card, idx, arr) => arr.findIndex(c => c.classId === card.classId) === idx)
    : classes.map((cls, i) => ({
        classId: cls.id,
        className: cls.name,
        grade: cls.grade,
        section: cls.section ?? '',
        period: null, start: null, end: null,
        color: CLASS_COLORS[i % CLASS_COLORS.length],
        label: null,
      }))

  const [topics,    setTopics]    = useState<Record<string, string>>({})
  const [topicMode, setTopicMode] = useState<Record<string, 'dropdown' | 'custom'>>({})
  const [subtopics, setSubtopics] = useState<Record<string, string>>({})
  const [subMode,   setSubMode]   = useState<Record<string, 'dropdown' | 'custom'>>({})
  const [states,    setStates]    = useState<Record<string, GenState>>({})
  const [results,   setResults]   = useState<Record<string, SmartResult>>({})
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({})
  const [prepCache, setPrepCache] = useState<Record<string, SmartResult>>({})
  const [slideIdx,  setSlideIdx]  = useState<Record<string, number>>({})
  const [fromCache, setFromCache] = useState<Record<string, boolean>>({})

  const getNextTopic = useCallback((classId: string) => {
    const b = briefingMap[classId]
    if (b?.nextTopic) return b.nextTopic
    return getClassSyllabus(classId).find(t => !t.isCompleted)?.topic ?? ''
  }, [briefingMap, getClassSyllabus])

  const topicFor = (classId: string) =>
    topics[classId] !== undefined ? topics[classId] : getNextTopic(classId)

  const generate = useCallback(async (classId: string, grade: string, force = false) => {
    const topic = topicFor(classId)
    const sub   = subtopics[classId]
    if (!topic.trim()) return

    const key = cacheKey(classId, topic, sub)

    // Cache hit — show instantly, no API call
    if (!force && prepCache[key]) {
      setResults(p  => ({ ...p,  [classId]: prepCache[key] }))
      setStates(p   => ({ ...p,  [classId]: 'done' }))
      setFromCache(p => ({ ...p, [classId]: true }))
      setSlideIdx(p  => ({ ...p, [classId]: 0 }))
      return
    }

    setStates(p   => ({ ...p,  [classId]: 'loading' }))
    setFromCache(p => ({ ...p, [classId]: false }))

    try {
      const res = await fetch('/api/smart-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          topic:     topic.trim(),
          subtopic:  sub?.trim() || undefined,
          subject:   teacher?.subject ?? '',
          grade,
          teacherId: teacher?.id ?? '',
        }),
      })
      if (!res.ok) throw new Error('bad')
      const data = await res.json() as SmartResult
      setResults(p   => ({ ...p,  [classId]: data }))
      setPrepCache(p => ({ ...p,  [key]: data }))
      setStates(p    => ({ ...p,  [classId]: 'done' }))
      setSlideIdx(p  => ({ ...p,  [classId]: 0 }))
    } catch {
      setStates(p => ({ ...p, [classId]: 'error' }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, subtopics, teacher, getNextTopic, prepCache])

  const generateAll = () =>
    Promise.all(cards.map(c => states[c.classId] !== 'loading' ? generate(c.classId, c.grade) : null))

  const allDone    = cards.length > 0 && cards.every(c => states[c.classId] === 'done')
  const anyLoading = cards.some(c => states[c.classId] === 'loading')

  return (
    <div className="min-h-screen pb-28" style={{ background: '#f1f5f9' }}>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100"
        style={{ boxShadow: '0 1px 0 #f1f5f9' }}>
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">Today&apos;s Prep</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {hasTimetable
                ? `${cards.length} class${cards.length !== 1 ? 'es' : ''} scheduled today`
                : 'No timetable — showing all classes'}
            </p>
          </div>
          {cards.length > 1 && (
            <button
              onClick={generateAll}
              disabled={anyLoading || allDone}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-50 active:scale-95 transition-all"
              style={{
                background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
                boxShadow: '0 2px 12px rgba(124,58,237,0.35)',
              }}
            >
              {anyLoading ? 'Generating…' : allDone ? 'All Ready ✓' : 'Generate All'}
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">

        {cards.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{ background: '#ede9fe' }}>
              <BookOpen size={28} className="text-violet-600" />
            </div>
            <p className="text-slate-700 font-bold text-lg">No classes scheduled today</p>
            <p className="text-slate-400 text-sm mt-1">Your timetable will appear here once your admin sets it up.</p>
          </div>
        )}

        {cards.map(card => {
          const state      = states[card.classId] ?? 'idle'
          const result     = results[card.classId]
          const isCardOpen = openCards[card.classId]
          const topic      = topicFor(card.classId)
          const isDone     = state === 'done'
          const isLoad     = state === 'loading'
          const b          = briefingMap[card.classId]
          const cached     = fromCache[card.classId]
          const curSlide   = slideIdx[card.classId] ?? 0

          return (
            <div
              key={card.classId}
              className="rounded-3xl overflow-hidden bg-white transition-shadow"
              style={{
                boxShadow: isCardOpen
                  ? '0 4px 24px rgba(0,0,0,0.09)'
                  : '0 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              {/* ── Compact summary row ── */}
              <button
                type="button"
                onClick={() => setOpenCards(p => ({ ...p, [card.classId]: !isCardOpen }))}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-50"
              >
                <div
                  className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-sm"
                  style={{ background: card.color }}
                >
                  {card.period ?? (card.grade || card.className[0])}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-sm leading-tight truncate">
                    {card.label ?? card.className}{card.section ? ` · ${card.section}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {card.start && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} className="text-slate-400" />
                        <span className="text-xs text-slate-400 font-medium tabular-nums">
                          P{card.period} · {fmt(card.start)}
                        </span>
                      </span>
                    )}
                    {topic && (
                      <span className="text-xs text-violet-500 font-semibold truncate max-w-[140px]">{topic}</span>
                    )}
                  </div>
                </div>

                {isDone ? (
                  <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={11} /> Ready
                  </span>
                ) : isLoad ? (
                  <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
                ) : state === 'error' ? (
                  <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full">
                    <AlertCircle size={10} /> Error
                  </span>
                ) : null}

                <div className="text-slate-400 shrink-0 ml-1">
                  {isCardOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
              </button>

              {/* ── Expanded content ── */}
              {isCardOpen && (
                <div className="border-t border-slate-100">
                  <div className="p-5">

                    {/* Morning Briefing */}
                    {b && (
                      <div className="mb-4 rounded-2xl overflow-hidden border border-slate-100">
                        {b.lastSession && (
                          <div className="px-4 py-3 flex items-start gap-2.5 border-b border-slate-100">
                            <UserX size={13} className="text-slate-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
                                Last class · {relativeDate(b.lastSession.date)} · {b.lastSession.topic}
                              </p>
                              {b.lastSession.absentCount > 0 ? (
                                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                                  <span className="font-black text-orange-500">{b.lastSession.absentCount} absent</span>
                                  {' — '}
                                  {b.lastSession.absentNames.slice(0, 3).join(', ')}
                                  {b.lastSession.absentCount > 3 && ` +${b.lastSession.absentCount - 3} more`}
                                </p>
                              ) : (
                                <p className="text-xs text-emerald-600 font-semibold mt-0.5">Full attendance ✓</p>
                              )}
                            </div>
                          </div>
                        )}
                        {b.atRiskCount > 0 && (
                          <div className="px-4 py-3 flex items-start gap-2.5 border-b border-slate-100">
                            <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
                                At risk · {b.atRiskCount} student{b.atRiskCount !== 1 ? 's' : ''}
                              </p>
                              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                                {b.atRiskNames.slice(0, 3).join(', ')}
                                {b.atRiskCount > 3 && ` +${b.atRiskCount - 3} more`}
                              </p>
                            </div>
                          </div>
                        )}
                        {b.totalTopics > 0 && (
                          <div className="px-4 py-3 flex items-center gap-2.5">
                            <BarChart2 size={13} className="text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide shrink-0">Syllabus</p>
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.round((b.completedTopics / b.totalTopics) * 100)}%`,
                                    background: card.color,
                                  }}
                                />
                              </div>
                              <p className="text-[11px] font-bold text-slate-500 shrink-0">
                                {b.completedTopics}/{b.totalTopics}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Topic + Subtopic inputs */}
                    <div className="mb-3 space-y-2">
                      {/* Today's Topic */}
                      {(() => {
                        const syllabus      = getClassSyllabus(card.classId)
                        const incomplete    = syllabus.filter(t => !t.isCompleted)
                        const completed     = syllabus.filter(t =>  t.isCompleted)
                        const hasSyllabus   = syllabus.length > 0
                        const tMode         = topicMode[card.classId] ?? 'dropdown'
                        const isCustomTopic = tMode === 'custom'
                        const dropdownVal   = topics[card.classId] !== undefined
                          ? topics[card.classId]
                          : getNextTopic(card.classId)

                        function pickTopic(val: string) {
                          if (val === '__custom__') {
                            setTopicMode(p => ({ ...p, [card.classId]: 'custom' }))
                            setTopics(p => ({ ...p, [card.classId]: '' }))
                          } else {
                            setTopicMode(p => ({ ...p, [card.classId]: 'dropdown' }))
                            setTopics(p => ({ ...p, [card.classId]: val }))
                          }
                          setSubtopics(p => ({ ...p, [card.classId]: '' }))
                          setSubMode(p => ({ ...p, [card.classId]: 'dropdown' }))
                        }

                        return (
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                              <span>Today&apos;s Topic</span>
                              {isCustomTopic && hasSyllabus && (
                                <button type="button" onClick={() => {
                                  setTopicMode(p => ({ ...p, [card.classId]: 'dropdown' }))
                                  setTopics(p => ({ ...p, [card.classId]: getNextTopic(card.classId) }))
                                  setSubtopics(p => ({ ...p, [card.classId]: '' }))
                                  setSubMode(p => ({ ...p, [card.classId]: 'dropdown' }))
                                }} className="text-[10px] font-bold text-violet-500 normal-case tracking-normal">
                                  ← Back to syllabus
                                </button>
                              )}
                            </label>

                            {hasSyllabus && !isCustomTopic ? (
                              <div className="relative">
                                <select
                                  value={dropdownVal}
                                  onChange={e => pickTopic(e.target.value)}
                                  className="w-full appearance-none px-4 py-2.5 pr-9 rounded-2xl text-sm font-medium text-slate-800 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
                                  style={{ background: '#f8fafc' }}
                                >
                                  <option value="" disabled>— pick a topic —</option>
                                  {incomplete.length > 0 && (
                                    <optgroup label="Pending">
                                      {incomplete.map(t => <option key={t.id} value={t.topic}>{t.topic}</option>)}
                                    </optgroup>
                                  )}
                                  {completed.length > 0 && (
                                    <optgroup label="Completed ✓">
                                      {completed.map(t => <option key={t.id} value={t.topic}>{t.topic}</option>)}
                                    </optgroup>
                                  )}
                                  <option value="__custom__">✏️  Custom topic…</option>
                                </select>
                                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </span>
                              </div>
                            ) : (
                              <input
                                autoFocus={isCustomTopic}
                                type="text"
                                value={topic}
                                onChange={e => setTopics(p => ({ ...p, [card.classId]: e.target.value }))}
                                placeholder="What are you teaching today?"
                                className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium text-slate-800 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
                                style={{ background: '#f8fafc' }}
                              />
                            )}
                            {!topic && !hasSyllabus && (
                              <p className="text-[11px] text-amber-500 font-medium mt-1 ml-1">No syllabus added yet — type a topic above</p>
                            )}
                          </div>
                        )
                      })()}

                      {/* Subtopic */}
                      {(() => {
                        const syllabus   = getClassSyllabus(card.classId)
                        const topicEntry = syllabus.find(t => t.topic === topic)
                        const subs       = topicEntry ? getTopicSubTopics(topicEntry.id) : []
                        const mode       = subMode[card.classId] ?? 'dropdown'
                        const isCustom   = mode === 'custom'
                        const currentVal = subtopics[card.classId] ?? ''

                        return (
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                              <span>Subtopic <span className="font-medium normal-case text-slate-400">(optional)</span></span>
                              {isCustom && subs.length > 0 && (
                                <button type="button" onClick={() => {
                                  setSubMode(p => ({ ...p, [card.classId]: 'dropdown' }))
                                  setSubtopics(p => ({ ...p, [card.classId]: '' }))
                                }} className="text-[10px] font-bold text-violet-500 normal-case tracking-normal">
                                  ← Back to list
                                </button>
                              )}
                            </label>
                            {subs.length > 0 && !isCustom ? (
                              <div className="relative">
                                <select
                                  value={currentVal}
                                  onChange={e => {
                                    if (e.target.value === '__custom__') {
                                      setSubMode(p => ({ ...p, [card.classId]: 'custom' }))
                                      setSubtopics(p => ({ ...p, [card.classId]: '' }))
                                    } else {
                                      setSubtopics(p => ({ ...p, [card.classId]: e.target.value }))
                                    }
                                  }}
                                  className="w-full appearance-none px-4 py-2.5 pr-9 rounded-2xl text-sm font-medium text-slate-800 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
                                  style={{ background: '#f8fafc' }}
                                >
                                  <option value="">— pick a subtopic (optional) —</option>
                                  {subs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                  <option value="__custom__">✏️  Custom subtopic…</option>
                                </select>
                                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </span>
                              </div>
                            ) : (
                              <input
                                autoFocus={isCustom}
                                type="text"
                                value={currentVal}
                                onChange={e => setSubtopics(p => ({ ...p, [card.classId]: e.target.value }))}
                                placeholder={isCustom ? 'Type your subtopic…' : `e.g. "line symmetry", "rotational symmetry"…`}
                                className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium text-slate-800 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
                                style={{ background: '#f8fafc' }}
                              />
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Generate button — hidden once result is ready */}
                    {!isDone && (
                      <button
                        onClick={() => generate(card.classId, card.grade)}
                        disabled={!topic.trim() || isLoad}
                        className="w-full py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
                        style={{
                          background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
                          boxShadow: '0 2px 12px rgba(124,58,237,0.3)',
                        }}
                      >
                        {isLoad
                          ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                          : <><Sparkles size={14} /> Generate Prep</>
                        }
                      </button>
                    )}

                    {state === 'error' && (
                      <div className="mt-2.5 flex items-center gap-2 text-red-500 text-xs font-medium">
                        <AlertCircle size={12} /> Failed to generate. Try again.
                      </div>
                    )}
                  </div>

                  {/* ── Slideshow ── */}
                  {isDone && result && (() => {
                    const slides  = buildSlides(result)
                    const slide   = slides[curSlide]
                    const isFirst = curSlide === 0
                    const isLast  = curSlide === slides.length - 1

                    let label  = ''
                    let accent = '#7c3aed'
                    let bg     = '#faf5ff'
                    let border = '#e9d5ff'

                    if (slide.kind === 'hook') {
                      label = 'Opening Hook'
                      accent = '#7c3aed'; bg = '#faf5ff'; border = '#e9d5ff'
                    } else if (slide.kind === 'section') {
                      const sec = result.lesson.sections[slide.idx]
                      label  = sec.type === 'check' ? 'Check' : `Step ${slide.stepNum} · Teach`
                      accent = sec.type === 'check' ? '#16a34a' : '#2563eb'
                      bg     = sec.type === 'check' ? '#f0fdf4' : '#eff6ff'
                      border = sec.type === 'check' ? '#bbf7d0' : '#bfdbfe'
                    } else {
                      label = 'Closing Activity'
                      accent = '#0891b2'; bg = '#ecfeff'; border = '#a5f3fc'
                    }

                    return (
                      <div className="border-t border-slate-100">
                        {/* Slide */}
                        <div className="mx-4 mt-4 rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${border}` }}>

                          {/* Label + counter */}
                          <div className="px-4 pt-3 pb-2 flex items-center justify-between" style={{ background: bg }}>
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: accent }}>
                              {label}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                              {curSlide + 1} / {slides.length}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="px-4 pb-5 pt-2 min-h-[110px]" style={{ background: bg }}>
                            {slide.kind === 'hook' && (
                              <p className="text-[15px] font-semibold text-slate-800 leading-relaxed italic">
                                &ldquo;{result.lesson.hook}&rdquo;
                              </p>
                            )}

                            {slide.kind === 'section' && (() => {
                              const sec = result.lesson.sections[slide.idx]
                              return (
                                <>
                                  <p className="text-base font-black text-slate-900 mb-2 leading-snug">{sec.title}</p>
                                  <p className="text-sm text-slate-700 leading-relaxed">{sec.content}</p>
                                  {sec.bridgeNote && (
                                    <div className="mt-3 pl-3 border-l-[3px] border-amber-300">
                                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-wide mb-0.5">
                                        ↺ {sec.bridgeNote.concept}
                                      </p>
                                      <p className="text-xs text-amber-800 leading-relaxed">{sec.bridgeNote.text}</p>
                                    </div>
                                  )}
                                </>
                              )
                            })()}

                            {slide.kind === 'closing' && (
                              <p className="text-sm text-slate-700 leading-relaxed">{result.lesson.closingActivity}</p>
                            )}
                          </div>

                          {/* Prev · dots · Next */}
                          <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setSlideIdx(p => ({ ...p, [card.classId]: Math.max(0, curSlide - 1) }))}
                              disabled={isFirst}
                              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 disabled:opacity-25 active:scale-90 transition-all"
                            >
                              <ChevronLeft size={16} className="text-slate-600" />
                            </button>

                            <div className="flex items-center gap-1.5">
                              {slides.map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setSlideIdx(p => ({ ...p, [card.classId]: i }))}
                                  className="rounded-full transition-all duration-200"
                                  style={{
                                    width:      i === curSlide ? 18 : 6,
                                    height:     6,
                                    background: i === curSlide ? accent : '#e2e8f0',
                                  }}
                                />
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => setSlideIdx(p => ({ ...p, [card.classId]: Math.min(slides.length - 1, curSlide + 1) }))}
                              disabled={isLast}
                              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 disabled:opacity-25 active:scale-90 transition-all"
                            >
                              <ChevronRight size={16} className="text-slate-600" />
                            </button>
                          </div>
                        </div>

                        {/* Saved badge + Regenerate */}
                        <div className="px-4 py-3 flex items-center gap-2">
                          {cached && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                              <CheckCircle2 size={9} /> Saved
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => generate(card.classId, card.grade, true)}
                            className="ml-auto flex items-center gap-1.5 text-xs font-bold text-slate-500 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all"
                          >
                            <RotateCcw size={12} /> Regenerate
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
