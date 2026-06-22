'use client'
import { useState, useEffect } from 'react'
import { X, Loader2, Pencil, Trash2, Plus, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useApp } from '@/lib/context'
import { aiKey, getAiCache, setAiCache, TTL } from '@/lib/ai-cache'

interface Props {
  studentId: string
  studentName: string
  topic: string
  score?: number
  onClose: () => void
}

export default function CatchupModal({ studentId, studentName, topic, score, onClose }: Props) {
  const { teacher, classes, students, saveCatchupMaterial } = useApp()

  const student   = students.find(s => s.id === studentId)
  const cls       = classes.find(c => c.id === student?.classId)
  const subject   = teacher?.subject ?? ''
  const grade     = cls?.grade ?? teacher?.grade ?? ''

  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [manual, setManual]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  // Editable fields
  const [explanation, setExplanation]   = useState('')
  const [questions, setQuestions]       = useState<string[]>(['', '', ''])
  const [activity, setActivity]         = useState('')
  const [focusNote, setFocusNote]       = useState('')

  const generate = async () => {
    setLoading(true)
    setError(false)
    try {
      const scoreBucket = score == null ? 'none' : score < 50 ? 'low' : score < 75 ? 'medium' : 'high'
      const ck = aiKey('catchup', { topic: topic.toLowerCase().trim(), subject: subject.toLowerCase(), grade, scoreBucket })
      const cached = getAiCache<{ explanation: string; practiceQuestions: string[]; activity: string; focusNote: string }>(ck)
      if (cached) {
        setExplanation(cached.explanation ?? '')
        setQuestions(cached.practiceQuestions ?? ['', '', ''])
        setActivity(cached.activity ?? '')
        setFocusNote(cached.focusNote ?? '')
        setLoading(false)
        return
      }
      const res = await fetch('/api/catchup-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, topic, subject, grade, score }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAiCache(ck, data, TTL.ONE_WEEK)
      setExplanation(data.explanation ?? '')
      setQuestions(data.practiceQuestions ?? ['', '', ''])
      setActivity(data.activity ?? '')
      setFocusNote(data.focusNote ?? '')
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { generate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async () => {
    setSaving(true)
    await saveCatchupMaterial({
      studentId, studentName, topic, subject, grade,
      explanation, practiceQuestions: questions,
      activity, focusNote, status: 'approved',
    })
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(7,21,58,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full md:max-w-lg bg-white md:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col"
        style={{ boxShadow: '0 -8px 40px rgba(7,21,58,0.18)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Catch-up Plan</p>
            <p className="font-black text-slate-900 text-base leading-tight">{studentName}</p>
            <p className="text-xs text-slate-400 font-medium">{topic} · {subject} Grade {grade}</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="text-blue-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Generating plan for {studentName}…</p>
            </div>
          )}

          {error && !manual && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">AI generation failed</p>
                <p className="text-xs text-slate-400 mt-1">No internet or API issue.</p>
              </div>
              <div className="flex gap-3 w-full px-4">
                <button type="button" onClick={generate}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)' }}>
                  Retry
                </button>
                <button type="button" onClick={() => { setError(false); setManual(true) }}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-slate-600 border-2 border-slate-200">
                  Write manually
                </button>
              </div>
            </div>
          )}

          {!loading && (!error || manual) && (
            <>
              {/* Focus note — teacher instruction */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">Teacher Focus</p>
                <input
                  value={focusNote}
                  onChange={e => setFocusNote(e.target.value)}
                  className="w-full text-sm font-semibold text-slate-800 bg-transparent focus:outline-none"
                />
              </div>

              {/* Explanation */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Explanation for student</p>
                <textarea
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  rows={4}
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-400 resize-none leading-relaxed"
                />
              </div>

              {/* Practice questions */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Practice Questions</p>
                <div className="space-y-2">
                  {questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center shrink-0 mt-1">{i + 1}</span>
                      <input
                        value={q}
                        onChange={e => setQuestions(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                        className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-400"
                      />
                      <button type="button" onClick={() => setQuestions(prev => prev.filter((_, j) => j !== i))}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 active:text-red-400 shrink-0 mt-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => setQuestions(prev => [...prev, ''])}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 mt-1 px-2 py-1">
                    <Plus size={13} /> Add question
                  </button>
                </div>
              </div>

              {/* Activity */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">10-min Activity</p>
                <textarea
                  value={activity}
                  onChange={e => setActivity(e.target.value)}
                  rows={3}
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-400 resize-none leading-relaxed"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (!error || manual) && (
          <div className="px-5 pb-6 pt-3 border-t border-slate-100 shrink-0 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-600 active:bg-slate-50">
              Discard
            </button>
            <button type="button" onClick={handleApprove} disabled={saving || saved}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
              style={{ background: saved ? 'linear-gradient(135deg,#059669,#34d399)' : 'linear-gradient(135deg,#1d4ed8,#2563eb)' }}>
              {saved ? <><CheckCircle2 size={15} /> Saved!</> : saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Pencil size={15} /> Approve & Save</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
