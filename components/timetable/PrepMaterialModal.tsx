'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import Modal from '@/components/ui/Modal'
import {
  Sparkles, RotateCcw, AlertCircle, CheckCircle2, Database, ClipboardList,
  ChevronLeft, ChevronRight, Lightbulb, Flag,
} from 'lucide-react'
import type { GapTopic, LessonSection, SmartLesson } from '@/lib/types'

interface PrepMaterialModalProps {
  open: boolean
  onClose: () => void
  classId: string
  subject: string
  grade: string
}

type GenState = 'idle' | 'loading' | 'done' | 'error'

type Slide =
  | { kind: 'hook' }
  | { kind: 'section'; section: LessonSection; stepNum: number }
  | { kind: 'closing' }

export default function PrepMaterialModal({ open, onClose, classId, subject, grade }: PrepMaterialModalProps) {
  const router = useRouter()
  const {
    teacher, getClassSyllabus, getTopicSubTopics, getPrepMaterial, savePrepMaterial, saveTaughtTopic,
  } = useApp()

  const [topic, setTopic] = useState('')
  const [topicMode, setTopicMode] = useState<'dropdown' | 'custom'>('dropdown')
  const [subtopic, setSubtopic] = useState('')
  const [subMode, setSubMode] = useState<'dropdown' | 'custom'>('dropdown')
  const [state, setState] = useState<GenState>('idle')
  const [gapTopics, setGapTopics] = useState<GapTopic[]>([])
  const [lesson, setLesson] = useState<SmartLesson | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)

  // Reset topic/subtopic whenever a different class's modal is opened
  useEffect(() => {
    if (!open || !classId) return
    const syllabus = getClassSyllabus(classId)
    const next = syllabus.find(t => !t.isCompleted)?.topic ?? ''
    setTopic(next)
    setTopicMode('dropdown')
    setSubtopic('')
    setSubMode('dropdown')
    setState('idle')
    setLesson(null)
    setGapTopics([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId])

  // Whenever the topic/subtopic selection settles, check for saved prep material
  useEffect(() => {
    if (!open || !classId || !topic.trim()) return
    const cached = getPrepMaterial(classId, topic, subtopic)
    if (cached) {
      setLesson(cached.lesson)
      setGapTopics(cached.gapTopics)
      setFromCache(true)
      setState('done')
    } else {
      setLesson(null)
      setGapTopics([])
      setFromCache(false)
      setState('idle')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId, topic, subtopic])

  // Reset the slideshow position whenever a (new or cached) lesson is shown
  useEffect(() => { setSlideIndex(0) }, [lesson])

  // Recording that this topic/subtopic was covered today happens the moment
  // prep material becomes available — whether freshly generated or loaded from cache.
  useEffect(() => {
    if (!open || !classId || !lesson || !topic.trim()) return
    saveTaughtTopic({ classId, topic: topic.trim(), subtopic: subtopic.trim() || undefined }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson])

  const syllabus = getClassSyllabus(classId)
  const incomplete = syllabus.filter(t => !t.isCompleted)
  const completed = syllabus.filter(t => t.isCompleted)
  const hasSyllabus = syllabus.length > 0
  const isCustomTopic = topicMode === 'custom'

  const topicEntry = syllabus.find(t => t.topic === topic)
  const subs = topicEntry ? getTopicSubTopics(topicEntry.id) : []
  const isCustomSub = subMode === 'custom'

  const slides: Slide[] = useMemo(() => {
    if (!lesson) return []
    const arr: Slide[] = [{ kind: 'hook' }]
    let stepNum = 0
    for (const section of lesson.sections) {
      if (section.type !== 'check') stepNum++
      arr.push({ kind: 'section', section, stepNum })
    }
    arr.push({ kind: 'closing' })
    return arr
  }, [lesson])

  function pickTopic(val: string) {
    if (val === '__custom__') {
      setTopicMode('custom')
      setTopic('')
    } else {
      setTopicMode('dropdown')
      setTopic(val)
    }
    setSubtopic('')
    setSubMode('dropdown')
  }

  async function generate(force = false) {
    if (!topic.trim() || !classId) return
    if (!force) {
      const cached = getPrepMaterial(classId, topic, subtopic)
      if (cached) {
        setLesson(cached.lesson)
        setGapTopics(cached.gapTopics)
        setFromCache(true)
        setState('done')
        return
      }
    }
    setState('loading')
    try {
      const res = await fetch('/api/smart-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          topic: topic.trim(),
          subtopic: subtopic.trim() || undefined,
          subject,
          grade,
          teacherId: teacher?.id ?? '',
        }),
      })
      if (!res.ok) throw new Error('bad')
      const data = await res.json() as { gapTopics: GapTopic[]; lesson: SmartLesson }
      const saved = await savePrepMaterial({
        classId, subject, grade,
        topic: topic.trim(),
        subtopic: subtopic.trim() || undefined,
        gapTopics: data.gapTopics,
        lesson: data.lesson,
      })
      setLesson(saved.lesson)
      setGapTopics(saved.gapTopics)
      setFromCache(false)
      setState('done')
    } catch {
      setState('error')
    }
  }

  const isLoading = state === 'loading'
  const isDone = state === 'done' && lesson
  const currentSlide = slides[slideIndex]

  return (
    <Modal open={open} onClose={onClose} title="Prep Material">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-ink-soft font-medium">
          <ClipboardList size={14} style={{ color: '#31215C' }} className="shrink-0" />
          <span>{subject}{grade ? ` · Grade ${grade}` : ''}</span>
        </div>

        {/* Topic selector */}
        <div>
          <label className="text-[11px] font-bold text-ink-soft uppercase tracking-wide mb-1.5 flex items-center justify-between">
            <span>Today&apos;s Topic</span>
            {isCustomTopic && hasSyllabus && (
              <button
                type="button"
                onClick={() => pickTopic(incomplete[0]?.topic ?? completed[0]?.topic ?? '')}
                className="text-[10px] font-bold normal-case tracking-normal"
                style={{ color: '#7A5FB8' }}
              >
                ← Back to syllabus
              </button>
            )}
          </label>

          {hasSyllabus && !isCustomTopic ? (
            <div className="relative">
              <select
                value={topic}
                onChange={e => pickTopic(e.target.value)}
                className="w-full appearance-none px-4 py-2.5 pr-9 rounded-2xl text-sm font-medium text-ink focus:outline-none transition-all"
                style={{ background: 'rgba(58,44,30,0.04)', border: '1.5px solid rgba(58,44,30,0.1)' }}
              >
                <option value="" disabled>— pick a topic —</option>
                {incomplete.length > 0 && (
                  <optgroup label="Pending">
                    {incomplete.map(t => <option key={t.id} value={t.topic}>{t.topic}</option>)}
                  </optgroup>
                )}
                {completed.length > 0 && (
                  <optgroup label="Completed">
                    {completed.map(t => <option key={t.id} value={t.topic}>{t.topic}</option>)}
                  </optgroup>
                )}
                <option value="__custom__">Custom topic…</option>
              </select>
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
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
              onChange={e => setTopic(e.target.value)}
              placeholder="What are you teaching today?"
              className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium text-ink focus:outline-none transition-all"
              style={{ background: 'rgba(58,44,30,0.04)', border: '1.5px solid rgba(58,44,30,0.1)' }}
            />
          )}

          {!topic && !hasSyllabus && (
            <p className="text-[11px] font-medium mt-1 ml-1" style={{ color: '#8A6A1E' }}>
              No syllabus added yet — type a topic above
            </p>
          )}
        </div>

        {/* Subtopic selector */}
        <div>
          <label className="text-[11px] font-bold text-ink-soft uppercase tracking-wide mb-1.5 flex items-center justify-between">
            <span>Subtopic <span className="font-medium normal-case text-ink-faint">(optional)</span></span>
            {isCustomSub && subs.length > 0 && (
              <button
                type="button"
                onClick={() => { setSubMode('dropdown'); setSubtopic('') }}
                className="text-[10px] font-bold normal-case tracking-normal"
                style={{ color: '#7A5FB8' }}
              >
                ← Back to list
              </button>
            )}
          </label>

          {subs.length > 0 && !isCustomSub ? (
            <div className="relative">
              <select
                value={subtopic}
                onChange={e => {
                  if (e.target.value === '__custom__') { setSubMode('custom'); setSubtopic('') }
                  else setSubtopic(e.target.value)
                }}
                className="w-full appearance-none px-4 py-2.5 pr-9 rounded-2xl text-sm font-medium text-ink focus:outline-none transition-all"
                style={{ background: 'rgba(58,44,30,0.04)', border: '1.5px solid rgba(58,44,30,0.1)' }}
              >
                <option value="">— pick a subtopic (optional) —</option>
                {subs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                <option value="__custom__">Custom subtopic…</option>
              </select>
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
          ) : (
            <input
              autoFocus={isCustomSub}
              type="text"
              value={subtopic}
              onChange={e => setSubtopic(e.target.value)}
              placeholder={isCustomSub ? 'Type your subtopic…' : 'e.g. "line symmetry"…'}
              className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium text-ink focus:outline-none transition-all"
              style={{ background: 'rgba(58,44,30,0.04)', border: '1.5px solid rgba(58,44,30,0.1)' }}
            />
          )}
        </div>

        {/* Generate / regenerate button */}
        <button
          onClick={() => generate(isDone ? true : false)}
          disabled={!topic.trim() || isLoading}
          className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
          style={{ background: '#C7B7E8', color: '#31215C' }}
        >
          {isLoading ? (
            <><span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#31215C', borderTopColor: 'transparent' }} /> Generating Prep Material…</>
          ) : isDone ? (
            <><RotateCcw size={14} /> Regenerate</>
          ) : (
            <><Sparkles size={14} /> Generate Prep Material</>
          )}
        </button>

        {state === 'error' && (
          <div className="flex items-center gap-2 text-red-500 text-xs font-medium">
            <AlertCircle size={12} /> Failed to generate. Try again.
          </div>
        )}

        {/* Result — slideshow */}
        {isDone && lesson && currentSlide && (
          <div className="rounded-3xl overflow-hidden -mx-1" style={{ border: '1.5px solid rgba(58,44,30,0.08)' }}>
            {/* Doc header */}
            <div style={{ background: 'var(--ink)', padding: '16px 20px' }}>
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 10, fontWeight: 800, color: '#C7B7E8', textTransform: 'uppercase', letterSpacing: '.12em' }}>
                  Smart Lesson Plan
                </p>
                {fromCache && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: '#AAD6A0', background: 'rgba(170,214,160,.15)' }}>
                    <Database size={10} /> Saved
                  </span>
                )}
              </div>
              <p style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginTop: 2 }}>
                {topic}{subtopic ? ` — ${subtopic}` : ''}
              </p>
              {gapTopics.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {gapTopics.map(g => (
                    <span key={g.topic} style={{ fontSize: 10, fontWeight: 700, color: '#F8ECC9', background: 'rgba(234,201,104,.2)', border: '1px solid rgba(234,201,104,.4)', borderRadius: 999, padding: '2px 8px' }}>
                      ↺ {g.topic} · {Math.round(g.avgMastery * 100)}%
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Slide viewport */}
            <div style={{ minHeight: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '28px 24px', background: currentSlide.kind === 'closing' ? 'var(--paper-bg)' : '#fff' }}>
              {currentSlide.kind === 'hook' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <Lightbulb size={22} style={{ color: '#7A5FB8' }} />
                  </div>
                  <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>
                    Opening Hook
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic' }}>
                    &ldquo;{lesson.hook}&rdquo;
                  </p>
                </div>
              )}

              {currentSlide.kind === 'section' && (() => {
                const sec = currentSlide.section
                const isCheck = sec.type === 'check'
                return (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 12 }}>
                      {isCheck ? (
                        <CheckCircle2 size={16} style={{ color: '#5C8F52', flexShrink: 0 }} />
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#7A5FB8' }}>Step {currentSlide.stepNum}</span>
                      )}
                      <span style={{
                        fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.07em',
                        color: isCheck ? '#234A1D' : '#31215C',
                        background: isCheck ? '#DFF0DA' : '#E9E1F6',
                        borderRadius: 5, padding: '2px 7px',
                      }}>
                        {isCheck ? 'Check' : 'Teach'}
                      </span>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: isCheck ? '#234A1D' : 'var(--ink)', marginBottom: 12, lineHeight: 1.3 }}>
                      {sec.title}
                    </p>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.75 }}>{sec.content}</p>
                    {sec.bridgeNote && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed #EAC968', display: 'flex', flexDirection: 'column' as const, gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#8A6A1E', textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>
                          ↺ {sec.bridgeNote.concept}
                        </span>
                        <p style={{ fontSize: 12, color: '#4A3809', lineHeight: 1.6, maxWidth: 360 }}>{sec.bridgeNote.text}</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {currentSlide.kind === 'closing' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <Flag size={20} style={{ color: 'var(--ink-soft)' }} />
                  </div>
                  <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>
                    Closing Activity (2 min)
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-soft)', lineHeight: 1.7 }}>{lesson.closingActivity}</p>
                </div>
              )}
            </div>

            {/* Slide navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid rgba(58,44,30,0.08)' }}>
              <button
                type="button"
                onClick={() => setSlideIndex(i => Math.max(0, i - 1))}
                disabled={slideIndex === 0}
                className="w-9 h-9 flex items-center justify-center rounded-full text-ink-soft disabled:opacity-30 transition-colors"
                style={{ background: 'transparent' }}
              >
                <ChevronLeft size={18} />
              </button>

              <div style={{ display: 'flex', gap: 6 }}>
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSlideIndex(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    style={{
                      width: i === slideIndex ? 18 : 6, height: 6, borderRadius: 999,
                      background: i === slideIndex ? 'var(--ink)' : 'rgba(58,44,30,0.15)',
                      transition: 'all .15s',
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setSlideIndex(i => Math.min(slides.length - 1, i + 1))}
                disabled={slideIndex === slides.length - 1}
                className="w-9 h-9 flex items-center justify-center rounded-full text-ink-soft disabled:opacity-30 transition-colors"
                style={{ background: 'transparent' }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {classId && (
          <button
            type="button"
            onClick={() => { onClose(); router.push(`/classes/${classId}/attendance`) }}
            className="w-full py-2.5 rounded-2xl text-xs font-bold text-ink-soft transition-colors"
            style={{ border: '1.5px solid rgba(58,44,30,0.12)' }}
          >
            Take attendance for this class →
          </button>
        )}
      </div>
    </Modal>
  )
}
