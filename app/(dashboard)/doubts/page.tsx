'use client'
import { useState, useEffect } from 'react'
import { MessageCircle, CheckCircle2, Clock, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '@/lib/context'
import * as sbq from '@/lib/supabase-queries'
import type { StudentDoubt } from '@/lib/types'

interface ClassGroup {
  classId: string
  label: string
  doubts: StudentDoubt[]
  pendingCount: number
}

export default function DoubtsPage() {
  const { classes } = useApp()
  const [groups, setGroups]          = useState<ClassGroup[]>([])
  const [loading, setLoading]        = useState(true)
  const [expandedClass, setExpanded] = useState<string | null>(null)
  const [answers, setAnswers]        = useState<Record<string, string>>({})
  const [saving, setSaving]          = useState<string | null>(null)

  useEffect(() => {
    if (!classes.length) return
    loadDoubts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes])

  const loadDoubts = async () => {
    setLoading(true)
    try {
      const classIds = classes.map(c => c.id)
      const all = await sbq.fetchStudentDoubtsByClasses(classIds)

      const built: ClassGroup[] = classes.map(cls => {
        const clsDoubts = all.filter(d => d.classId === cls.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        return {
          classId: cls.id,
          label: `Grade ${cls.grade}${cls.section ? ` · ${cls.section}` : ''} — ${cls.name}`,
          doubts: clsDoubts,
          pendingCount: clsDoubts.filter(d => d.status === 'pending').length,
        }
      }).filter(g => g.doubts.length > 0)
        .sort((a, b) => b.pendingCount - a.pendingCount)

      setGroups(built)
      if (built.length > 0) setExpanded(built[0].classId)
    } finally {
      setLoading(false)
    }
  }

  const saveAnswer = async (doubt: StudentDoubt) => {
    const answer = (answers[doubt.id] ?? '').trim()
    if (!answer) return
    setSaving(doubt.id)
    try {
      await sbq.updateDoubtAnswer(doubt.id, answer)
      setGroups(prev => prev.map(g => ({
        ...g,
        doubts: g.doubts.map(d => d.id === doubt.id ? { ...d, answer, status: 'answered' as const } : d),
        pendingCount: g.doubts.filter(d => d.id !== doubt.id && d.status === 'pending').length,
      })))
      setAnswers(prev => { const n = { ...prev }; delete n[doubt.id]; return n })
    } finally {
      setSaving(null)
    }
  }

  const totalPending = groups.reduce((n, g) => n + g.pendingCount, 0)

  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>

      <div className="px-5 pt-10 pb-20 relative overflow-hidden"
        style={{ background: totalPending > 0
          ? 'linear-gradient(145deg, #1e3a8a 0%, #1d4ed8 100%)'
          : 'linear-gradient(145deg, #064e3b 0%, #059669 100%)' }}>
        <div className="absolute -right-8 -top-8 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)' }} />
        <p className="text-xs font-black uppercase tracking-widest mb-2 text-blue-300">Student Questions</p>
        <h1 className="text-3xl font-black text-white leading-tight">
          {loading ? 'Loading…' : totalPending > 0 ? `${totalPending} Unanswered` : 'All Answered!'}
        </h1>
        <p className="text-sm mt-1.5 font-medium text-blue-200/80">
          {groups.length > 0 ? `${groups.length} class${groups.length !== 1 ? 'es' : ''} · ${groups.reduce((n, g) => n + g.doubts.length, 0)} total questions` : 'No questions yet'}
        </p>
      </div>

      <div className="-mt-10 px-4 pb-32 space-y-3 relative z-10">

        {loading && (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading questions…</p>
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
            <MessageCircle size={40} className="text-slate-200 mx-auto mb-4" />
            <p className="font-bold text-slate-700 text-lg">No questions yet</p>
            <p className="text-sm text-slate-400 mt-1">When students submit questions from the Student Portal, they will appear here.</p>
          </div>
        )}

        {groups.map(group => {
          const isOpen = expandedClass === group.classId
          return (
            <div key={group.classId} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">

              <button type="button"
                onClick={() => setExpanded(isOpen ? null : group.classId)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-sm">{group.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {group.pendingCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <Clock size={9} /> {group.pendingCount} unanswered
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 font-medium">{group.doubts.length} question{group.doubts.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {group.doubts.map(doubt => (
                    <div key={doubt.id} className="px-5 py-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-slate-400">?</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Anonymous</span>
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{doubt.subject}</span>
                            <span className="text-[10px] text-slate-400">{new Date(doubt.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          </div>
                          <p className="text-sm text-slate-700 mt-1 leading-relaxed">{doubt.question}</p>
                        </div>
                        {doubt.status === 'answered'
                          ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                          : <Clock size={16} className="text-amber-400 shrink-0 mt-0.5" />}
                      </div>

                      {doubt.status === 'answered' && doubt.answer && (
                        <div className="ml-11 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-1">Your Answer</p>
                          <p className="text-sm text-slate-700">{doubt.answer}</p>
                        </div>
                      )}

                      {doubt.status === 'pending' && (
                        <div className="ml-11 space-y-2">
                          <textarea
                            value={answers[doubt.id] ?? ''}
                            onChange={e => setAnswers(prev => ({ ...prev, [doubt.id]: e.target.value }))}
                            placeholder="Type your answer here…"
                            rows={2}
                            className="w-full border-2 border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 resize-none"
                          />
                          <button
                            onClick={() => saveAnswer(doubt)}
                            disabled={!(answers[doubt.id] ?? '').trim() || saving === doubt.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white active:scale-95 disabled:opacity-50 transition-all"
                            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                            {saving === doubt.id ? 'Saving…' : <><Send size={12} /> Send Answer</>}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
