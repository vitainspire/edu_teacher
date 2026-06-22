'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { useApp } from '@/lib/context'

const CACHE_KEY = 'eduteach_briefing_v7'

interface ClassPoint {
  label: string
  lastTopic: string | null
  lastSubTopics: string[]
  absentCount: number | null
  nextTopic: string | null
  nextSubTopic: string | null
  atRiskCount: number
  hasSession: boolean
}
interface BriefingData { greeting: string; points: ClassPoint[] }

export default function DailyBriefing({ dark = false }: { dark?: boolean }) {
  const { teacher, getBriefingData } = useApp()
  const [data, setData]       = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(false)

  const load = useCallback(async (force = false) => {
    const classData = getBriefingData()
    if (!teacher) return
    const today = new Date().toDateString()
    const fingerprint = classData
      .map(c => `${c.lastSession?.date ?? ''}:${c.lastSession?.absentCount ?? 0}:${c.nextSubTopic ?? ''}:${(c.lastSubTopics ?? []).length}`)
      .join('|')
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { date, fp, payload } = JSON.parse(cached)
          if (date === today && fp === fingerprint && payload) { setData(payload); return }
        }
      } catch { /* ignore */ }
    }
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classData, teacherName: teacher.name }),
      })
      if (!res.ok) throw new Error('Failed')
      const payload: BriefingData = await res.json()
      setData(payload)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, fp: fingerprint, payload }))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [teacher, getBriefingData])

  useEffect(() => { load() }, [load])

  return (
    <div className="relative">
      {/* Refresh button */}
      <button
        onClick={() => load(true)}
        disabled={loading}
        className={`absolute top-0 right-0 w-7 h-7 flex items-center justify-center rounded-xl transition-colors ${dark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
        title="Refresh briefing"
      >
        <RefreshCw size={13} className={`${dark ? 'text-blue-300/60' : 'text-slate-400'} ${loading ? 'animate-spin' : ''}`} />
      </button>

      {loading && (
        <div className="space-y-2.5 pr-8">
          <div className={`h-3 rounded-full animate-pulse w-3/5 ${dark ? 'bg-white/10' : 'bg-slate-100'}`} />
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-10 rounded-xl animate-pulse ${dark ? 'bg-white/10' : 'bg-slate-100'}`} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="pr-8">
          <p className={`text-sm ${dark ? 'text-blue-200/60' : 'text-slate-400'}`}>Couldn&apos;t load briefing.{' '}
            <button onClick={() => load(true)} className={`font-semibold underline ${dark ? 'text-blue-300' : 'text-blue-500'}`}>Retry</button>
          </p>
        </div>
      )}

      {!loading && !error && data && data.points.length > 0 && (
        <div className="pr-8 space-y-2">
          {/* AI greeting */}
          {data.greeting && (
            <p className={`text-sm font-medium mb-3 ${dark ? 'text-blue-100/70' : 'text-slate-500'}`}>
              {data.greeting}
            </p>
          )}

          {/* One card per class */}
          {data.points.map((pt, i) => (
            <div
              key={i}
              className={`rounded-2xl px-3 py-2.5 ${dark ? 'bg-white/8' : 'bg-slate-50 border border-slate-100'}`}
            >
              {/* Class label */}
              <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 ${dark ? 'text-blue-300/80' : 'text-indigo-600'}`}>
                {pt.label}
              </p>

              <div className={`space-y-0.5 text-sm ${dark ? 'text-blue-100/85' : 'text-slate-700'}`}>
                {/* Last session */}
                {!pt.hasSession && (
                  <p className={`text-xs ${dark ? 'text-white/40' : 'text-slate-400'}`}>No sessions recorded yet</p>
                )}
                {pt.lastTopic && (
                  <div>
                    <p>
                      <span className={`font-semibold ${dark ? 'text-blue-300/60' : 'text-slate-400'}`}>Last class: </span>
                      {pt.lastTopic}
                      {pt.absentCount != null && pt.absentCount > 0 && (
                        <span className={`ml-1.5 text-xs font-semibold ${dark ? 'text-amber-300' : 'text-amber-600'}`}>
                          · {pt.absentCount} absent
                        </span>
                      )}
                      {pt.absentCount === 0 && (
                        <span className={`ml-1.5 text-xs ${dark ? 'text-emerald-400/70' : 'text-emerald-600'}`}>· Full attendance</span>
                      )}
                    </p>
                    {pt.lastSubTopics.length > 0 && (
                      <p className={`text-xs mt-0.5 pl-1 ${dark ? 'text-blue-200/50' : 'text-slate-400'}`}>
                        {pt.lastSubTopics.join(', ')}
                      </p>
                    )}
                  </div>
                )}
                {/* Next topic — hide if same as last topic and no subtopic to distinguish */}
                {pt.nextTopic && (pt.nextTopic !== pt.lastTopic || pt.nextSubTopic) && (
                  <div>
                    <p>
                      <span className={`font-semibold ${dark ? 'text-blue-300/60' : 'text-slate-400'}`}>Teach today: </span>
                      {pt.nextTopic}
                    </p>
                    {pt.nextSubTopic && (
                      <p className={`text-xs mt-0.5 pl-1 ${dark ? 'text-blue-200/50' : 'text-slate-400'}`}>
                        {pt.nextSubTopic}
                      </p>
                    )}
                  </div>
                )}
                {/* At risk */}
                {pt.atRiskCount > 0 && (
                  <p className={`text-xs font-semibold ${dark ? 'text-red-300' : 'text-red-500'}`}>
                    ⚠ {pt.atRiskCount} student{pt.atRiskCount > 1 ? 's' : ''} need attention
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (!data || data.points.length === 0) && (
        <p className={`text-sm pr-8 ${dark ? 'text-white/30' : 'text-slate-400'}`}>
          Add classes and record sessions to get your daily briefing here.
        </p>
      )}
    </div>
  )
}
