'use client'
import { useState, useCallback, useMemo } from 'react'
import { useApp } from '@/lib/context'
import {
  Clock, ChevronDown, ChevronUp,
  Zap, BookOpen, AlertCircle, CheckCircle2, RotateCcw,
  UserX, AlertTriangle, BarChart2, Sparkles,
} from 'lucide-react'

const CLASS_COLORS = [
  '#2563eb', '#7c3aed', '#059669', '#d97706',
  '#dc2626', '#0891b2', '#9333ea', '#16a34a',
]

function relativeDate(dateStr: string): string {
  const d    = new Date(dateStr)
  const now  = new Date()
  const diff = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface BridgeNote {
  concept: string
  text: string
}

interface LessonSection {
  type: 'teach' | 'check'
  title: string
  content: string
  bridgeNote?: BridgeNote
}

interface GapTopic {
  topic: string
  avgMastery: number
  weakStudentCount: number
  totalStudents: number
}

interface SmartResult {
  topic: string
  gapTopics: GapTopic[]
  lesson: { hook: string; sections: LessonSection[]; closingActivity: string }
}

type GenState = 'idle' | 'loading' | 'done' | 'error'

function fmt(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function TodayPage() {
  const { teacher, classes, getTodaySchedule, getClassSyllabus, getBriefingData } = useApp()

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
          }
        })
    : classes.map((cls, i) => ({
        classId: cls.id,
        className: cls.name,
        grade: cls.grade,
        section: cls.section ?? '',
        period: null, start: null, end: null,
        color: CLASS_COLORS[i % CLASS_COLORS.length],
      }))

  const [topics,    setTopics]    = useState<Record<string, string>>({})
  const [subtopics, setSubtopics] = useState<Record<string, string>>({})
  const [states,    setStates]    = useState<Record<string, GenState>>({})
  const [results,   setResults]   = useState<Record<string, SmartResult>>({})
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({})

  const getNextTopic = useCallback((classId: string) => {
    const b = briefingMap[classId]
    if (b?.nextTopic) return b.nextTopic
    return getClassSyllabus(classId).find(t => !t.isCompleted)?.topic ?? ''
  }, [briefingMap, getClassSyllabus])

  const topicFor = (classId: string) =>
    topics[classId] !== undefined ? topics[classId] : getNextTopic(classId)

  const generate = useCallback(async (classId: string, grade: string) => {
    const topic = topicFor(classId)
    if (!topic.trim()) return
    setStates(p => ({ ...p, [classId]: 'loading' }))
    setExpanded(p => ({ ...p, [classId]: false }))
    try {
      const res = await fetch('/api/smart-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          topic: topic.trim(),
          subject: teacher?.subject ?? '',
          grade,
          teacherId: teacher?.id ?? '',
        }),
      })
      if (!res.ok) throw new Error('bad')
      const data = await res.json() as SmartResult
      setResults(p => ({ ...p, [classId]: data }))
      setStates(p => ({ ...p, [classId]: 'done' }))
      setExpanded(p => ({ ...p, [classId]: true }))
    } catch {
      setStates(p => ({ ...p, [classId]: 'error' }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, subtopics, teacher, getNextTopic])

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
              <Zap size={14} />
              {anyLoading ? 'Generating…' : allDone ? 'All Ready ✓' : 'Generate All'}
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {cards.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{ background: '#ede9fe' }}>
              <BookOpen size={28} className="text-violet-600" />
            </div>
            <p className="text-slate-700 font-bold text-lg">No classes yet</p>
            <p className="text-slate-400 text-sm mt-1">Add classes in the Classes tab to get started.</p>
          </div>
        )}

        {cards.map(card => {
          const state  = states[card.classId]  ?? 'idle'
          const result = results[card.classId]
          const isOpen = expanded[card.classId]
          const topic  = topicFor(card.classId)
          const isDone = state === 'done'
          const isLoad = state === 'loading'
          const b      = briefingMap[card.classId]

          return (
            <div key={card.classId} className="rounded-3xl overflow-hidden bg-white"
              style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>

              {/* Card header */}
              <div className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-sm"
                    style={{ background: card.color }}>
                    {card.grade || card.className[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-base leading-tight">
                      {card.className}{card.section ? ` · ${card.section}` : ''}
                    </p>
                    {card.start && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={11} className="text-slate-400" />
                        <span className="text-xs text-slate-400 font-medium">
                          Period {card.period} · {fmt(card.start)} – {fmt(card.end!)}
                        </span>
                      </div>
                    )}
                  </div>
                  {isDone && (
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={11} /> Ready
                    </span>
                  )}
                </div>

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
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                      Today&apos;s Topic
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={e => setTopics(p => ({ ...p, [card.classId]: e.target.value }))}
                      placeholder="What are you teaching today?"
                      className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium text-slate-800 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
                      style={{ background: '#f8fafc' }}
                    />
                    {!topic && (
                      <p className="text-[11px] text-amber-500 font-medium mt-1 ml-1">
                        No syllabus topic found — type a topic above
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                      Subtopic <span className="font-medium normal-case text-slate-400">(optional — focus AI on a specific part)</span>
                    </label>
                    <input
                      type="text"
                      value={subtopics[card.classId] ?? ''}
                      onChange={e => setSubtopics(p => ({ ...p, [card.classId]: e.target.value }))}
                      placeholder={`e.g. "line symmetry", "rotational symmetry"…`}
                      className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium text-slate-800 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
                      style={{ background: '#f8fafc' }}
                    />
                  </div>
                </div>

                {/* Generate button */}
                <button
                  onClick={() => generate(card.classId, card.grade)}
                  disabled={!topic.trim() || isLoad}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
                  style={{
                    background: isDone
                      ? 'linear-gradient(135deg, #6d28d9, #7c3aed)'
                      : 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
                    boxShadow: '0 2px 12px rgba(124,58,237,0.3)',
                  }}
                >
                  {isLoad ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating Smart Lesson…</>
                  ) : isDone ? (
                    <><RotateCcw size={14} /> Regenerate</>
                  ) : (
                    <><Sparkles size={14} /> Generate Prep</>
                  )}
                </button>

                {state === 'error' && (
                  <div className="mt-2.5 flex items-center gap-2 text-red-500 text-xs font-medium">
                    <AlertCircle size={12} /> Failed to generate. Try again.
                  </div>
                )}
              </div>

              {/* Smart lesson result */}
              {isDone && result && (
                <>
                  <button
                    onClick={() => setExpanded(p => ({ ...p, [card.classId]: !isOpen }))}
                    className="w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm font-bold text-slate-600 hover:bg-violet-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Zap size={13} className="text-violet-500" />
                      {isOpen ? 'Hide lesson' : 'View lesson'}
                      {result.gapTopics.length > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          {result.gapTopics.length} gap{result.gapTopics.length !== 1 ? 's' : ''} embedded
                        </span>
                      )}
                    </span>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100">
                      {/* Doc header */}
                      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '16px 20px' }}>
                        <p style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 2 }}>Smart Lesson Plan</p>
                        <p style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{result.topic}</p>
                        {result.gapTopics.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                            {result.gapTopics.map(g => (
                              <span key={g.topic} style={{ fontSize: 10, fontWeight: 700, color: '#fef3c7', background: 'rgba(245,158,11,.25)', border: '1px solid rgba(245,158,11,.4)', borderRadius: 999, padding: '2px 8px' }}>
                                ↺ {g.topic} · {Math.round(g.avgMastery * 100)}%
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ padding: '0 20px 20px' }}>
                        {/* Opening Hook */}
                        <div style={{ borderBottom: '1px solid #f1f5f9', paddingTop: 16, paddingBottom: 16 }}>
                          <p style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Opening Hook</p>
                          <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', lineHeight: 1.55, fontStyle: 'italic' }}>
                            &ldquo;{result.lesson.hook}&rdquo;
                          </p>
                        </div>

                        {/* Sections */}
                        {(() => {
                          let stepNum = 0
                          return result.lesson.sections.map((sec, i) => {
                            const isCheck = sec.type === 'check'
                            if (!isCheck) stepNum++
                            const isLast = i === result.lesson.sections.length - 1
                            return (
                              <div key={i} style={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9', paddingTop: 14, paddingBottom: 14 }}>
                                {/* Label row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                                  {isCheck ? (
                                    <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                                  ) : (
                                    <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed' }}>Step {stepNum}</span>
                                  )}
                                  <span style={{
                                    fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.07em',
                                    color: isCheck ? '#15803d' : '#6d28d9',
                                    background: isCheck ? '#dcfce7' : '#ede9fe',
                                    borderRadius: 5, padding: '2px 7px',
                                  }}>
                                    {isCheck ? 'Check' : 'Teach'}
                                  </span>
                                </div>

                                {/* Title */}
                                <p style={{ fontSize: 15, fontWeight: 800, color: isCheck ? '#15803d' : '#1e293b', marginBottom: 6, lineHeight: 1.3 }}>
                                  {sec.title}
                                </p>

                                {/* Teaching content */}
                                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{sec.content}</p>

                                {/* Bridge note — inline aside, not a separate block */}
                                {sec.bridgeNote && (
                                  <div style={{
                                    marginTop: 10,
                                    paddingLeft: 12,
                                    borderLeft: '3px solid #fcd34d',
                                    display: 'flex',
                                    flexDirection: 'column' as const,
                                    gap: 2,
                                  }}>
                                    <span style={{ fontSize: 9, fontWeight: 800, color: '#b45309', textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>
                                      ↺ {sec.bridgeNote.concept}
                                    </span>
                                    <p style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>{sec.bridgeNote.text}</p>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>

                      {/* Closing activity */}
                      <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 20px' }}>
                        <p style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
                          Closing Activity (2 min)
                        </p>
                        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>{result.lesson.closingActivity}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
