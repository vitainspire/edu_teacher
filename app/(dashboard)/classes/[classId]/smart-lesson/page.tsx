'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useApp } from '@/lib/context'
import { Zap, ChevronDown, Loader2, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import clsx from 'clsx'

interface LessonSection {
  type: 'teach' | 'gap' | 'check'
  title: string
  content: string
  gapTopic?: string
}

interface GapTopic {
  topic: string
  avgMastery: number
  weakStudentCount: number
  totalStudents: number
}

interface SmartLesson {
  hook: string
  sections: LessonSection[]
  closingActivity: string
}

interface ApiResponse {
  topic: string
  subject: string
  grade: string
  totalStudents: number
  gapTopics: GapTopic[]
  lesson: SmartLesson
}

export default function SmartLessonPage() {
  const { classId } = useParams<{ classId: string }>()
  const { classes, teacher, getClassSyllabus } = useApp()

  const cls = classes.find(c => c.id === classId)
  const syllabus = getClassSyllabus(classId)

  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const effectiveTopic = selectedTopicId
    ? (syllabus.find(t => t.id === selectedTopicId)?.topic ?? '')
    : customTopic.trim()

  async function generate() {
    if (!effectiveTopic) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/smart-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          topic: effectiveTopic,
          subject: teacher?.subject ?? cls?.name ?? 'General',
          grade: cls?.grade ?? '1',
          teacherId: teacher?.id ?? '',
        }),
      })
      const data = await res.json() as ApiResponse & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 pt-5 pb-10 max-w-lg mx-auto space-y-5">

      {/* Explainer card */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)', borderRadius: 20, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Zap size={18} color="#a78bfa" />
          <p style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>Smart Teach</p>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          Pick today&apos;s topic. The AI checks this class&apos;s past marks, finds what they&apos;re weak on,
          and writes a lesson that <span style={{ color: '#c4b5fd', fontWeight: 700 }}>naturally fills those gaps
          while teaching the new topic</span> — no detours, no separate remediation.
        </p>
      </div>

      {/* Topic selector */}
      <div style={{ background: '#fff', borderRadius: 18, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(15,23,42,.05)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Today&apos;s Topic
        </p>

        {syllabus.length > 0 && (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <select
              value={selectedTopicId}
              onChange={e => { setSelectedTopicId(e.target.value); setCustomTopic('') }}
              style={{ width: '100%', padding: '11px 36px 11px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14, fontWeight: 600, color: '#1e293b', background: '#f8fafc', appearance: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <option value="">— pick from syllabus —</option>
              {syllabus.map(t => (
                <option key={t.id} value={t.id}>{t.topic}</option>
              ))}
            </select>
            <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          </div>
        )}

        <input
          type="text"
          placeholder={syllabus.length > 0 ? 'Or type a custom topic…' : 'Type today\'s topic…'}
          value={customTopic}
          onChange={e => { setCustomTopic(e.target.value); setSelectedTopicId('') }}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14, fontWeight: 600, color: '#1e293b', background: '#f8fafc', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />

        <button
          onClick={() => void generate()}
          disabled={!effectiveTopic || loading}
          style={{
            marginTop: 14, width: '100%', padding: '13px', borderRadius: 14, border: 'none', cursor: effectiveTopic && !loading ? 'pointer' : 'not-allowed',
            background: effectiveTopic && !loading ? 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)' : '#e2e8f0',
            color: effectiveTopic && !loading ? '#fff' : '#94a3b8',
            fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit',
            boxShadow: effectiveTopic && !loading ? '0 4px 16px rgba(124,58,237,.35)' : 'none',
            transition: 'all .15s',
          }}
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Generating Smart Lesson…</>
            : <><Sparkles size={16} /> Generate Smart Lesson</>}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 10 }}>
          <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>
        </div>
      )}

      {/* Result — document layout */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Gap summary pill row */}
          {result.gapTopics.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 7 }}>
                Gaps detected &amp; embedded below
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.gapTopics.map(g => (
                  <span key={g.topic} style={{ fontSize: 11, fontWeight: 700, color: '#78350f', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 999, padding: '3px 10px' }}>
                    {g.topic} · {Math.round(g.avgMastery * 100)}% avg
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.gapTopics.length === 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <CheckCircle2 size={15} style={{ color: '#16a34a', flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>No significant gaps found — class is on track.</p>
            </div>
          )}

          {/* Lesson document */}
          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,.06)' }}>

            {/* Doc header */}
            <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '20px 22px 18px' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>Smart Lesson Plan</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{result.topic}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>{result.subject} · Grade {result.grade} · {result.totalStudents} students</p>
            </div>

            <div style={{ padding: '0 22px 22px' }}>

              {/* Opening Hook */}
              <div style={{ borderBottom: '1px solid #f1f5f9', paddingTop: 20, paddingBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>Opening Hook</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', lineHeight: 1.55, fontStyle: 'italic' }}>
                  &ldquo;{result.lesson.hook}&rdquo;
                </p>
              </div>

              {/* Sections */}
              {(() => {
                let stepNum = 0
                return result.lesson.sections.map((sec, i) => {
                  const isGap   = sec.type === 'gap'
                  const isCheck = sec.type === 'check'
                  if (!isGap && !isCheck) stepNum++
                  const isLast  = i === result.lesson.sections.length - 1

                  return (
                    <div key={i} style={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9', paddingTop: 20, paddingBottom: 20 }}>

                      {/* Row: step label + badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {isGap ? (
                          <span style={{ fontSize: 15, color: '#f59e0b', fontWeight: 900, lineHeight: 1 }}>↺</span>
                        ) : isCheck ? (
                          <CheckCircle2 size={15} style={{ color: '#16a34a', flexShrink: 0 }} />
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed' }}>Step {stepNum}</span>
                        )}
                        <span style={{
                          fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em',
                          color: isGap ? '#92400e' : isCheck ? '#15803d' : '#6d28d9',
                          background: isGap ? '#fef3c7' : isCheck ? '#dcfce7' : '#ede9fe',
                          borderRadius: 6, padding: '2px 8px',
                        }}>
                          {isGap ? 'Gap fill' : isCheck ? 'Check' : 'Teach'}
                        </span>
                      </div>

                      {/* Title */}
                      <p style={{ fontSize: 16, fontWeight: 800, color: isGap ? '#92400e' : isCheck ? '#15803d' : '#1e293b', marginBottom: isGap && sec.gapTopic ? 3 : 8, lineHeight: 1.3 }}>
                        {sec.title}
                      </p>

                      {/* Gap bridging label */}
                      {isGap && sec.gapTopic && (
                        <p style={{ fontSize: 11, color: '#b45309', fontWeight: 700, marginBottom: 8 }}>
                          Bridging: {sec.gapTopic}
                        </p>
                      )}

                      {/* Content */}
                      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{sec.content}</p>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Closing activity */}
            <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '18px 22px' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
                Closing Activity (2 min)
              </p>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{result.lesson.closingActivity}</p>
            </div>
          </div>

          {/* Legend + regenerate */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 14 }}>
            {[
              { color: '#6d28d9', bg: '#ede9fe', label: 'Teach' },
              { color: '#92400e', bg: '#fef3c7', label: 'Gap fill' },
              { color: '#15803d', bg: '#dcfce7', label: 'Check' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.color}` }} />
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{l.label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => void generate()}
            disabled={loading}
            style={{ marginTop: 14, width: '100%', padding: '11px', borderRadius: 14, border: '1.5px solid #7c3aed', background: '#fff', color: '#7c3aed', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            className={clsx(loading && 'opacity-50')}
          >
            <Sparkles size={14} /> Regenerate lesson
          </button>
        </div>
      )}
    </div>
  )
}
