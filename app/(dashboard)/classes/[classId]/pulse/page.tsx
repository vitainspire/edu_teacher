'use client'
import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Activity, RefreshCw, Heart, AlertTriangle, Trophy,
  Target, Users, Sparkles, Link2,
} from 'lucide-react'
import { useApp } from '@/lib/context'
import { aiKey, getAiCache, setAiCache, TTL } from '@/lib/ai-cache'
import clsx from 'clsx'

interface PulseReport {
  health: string
  concerns: string
  wins: string
  focus: string
}

interface PeerPair {
  mentor: string
  mentee: string
  sharedInterest: string
  activity: string
}

export default function ClassPulsePage() {
  const { classId } = useParams<{ classId: string }>()
  const {
    teacher, classes,
    getClassStudents, getClassSyllabus, getClassSessions,
    getClassAttendance, tests, marks,
    getStudentAvgMastery, getStudentAttendanceRate,
  } = useApp()

  const cls       = classes.find(c => c.id === classId)
  const students  = getClassStudents(classId)
  const syllabus  = getClassSyllabus(classId)
  const sessions  = getClassSessions(classId)

  // Pulse report
  const [pulse, setPulse]               = useState<PulseReport | null>(null)
  const [pulseLoading, setPulseLoading] = useState(false)
  const [pulseError, setPulseError]     = useState('')

  // Peer pairs
  const [pairs, setPairs]               = useState<PeerPair[]>([])
  const [pairsLoading, setPairsLoading] = useState(false)
  const [pairsError, setPairsError]     = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState('')

  // ── Aggregate class stats ────────────────────────────────────────────────
  const classTests = tests.filter(t => t.classId === classId)

  const testSummary = classTests.map(t => {
    const testMarks = marks.filter(m => m.testId === t.id)
    const avg = testMarks.length
      ? testMarks.reduce((s, m) => s + m.score, 0) / testMarks.length
      : 0
    return { topic: t.topic, avgScore: avg, totalMarks: t.totalMarks }
  })

  const classAttendance = getClassAttendance(classId)
  const totalPossible   = sessions.length * students.length
  // Count unique students present per session to avoid inflating the rate with
  // duplicate or legacy attendance records that share the same classId.
  const presentCount = sessions.reduce((sum, session) => {
    const ids = new Set(
      classAttendance
        .filter(a => a.sessionId === session.id && a.status !== 'absent')
        .map(a => a.studentId)
    )
    return sum + ids.size
  }, 0)
  const classAttRate = totalPossible > 0 ? presentCount / totalPossible : 0

  const studentStats = students.map(s => ({
    id: s.id,
    name: s.name,
    avgMastery: getStudentAvgMastery(s.id),
    attendanceRate: getStudentAttendanceRate(s.id),
    interests: s.interests,
    goal: s.goal,
  }))

  const topicCoverage = syllabus.map(t => {
    const taught = sessions.some(s => s.syllabusTopicId === t.id)
    return { topic: t.topic, status: t.isCompleted ? 'completed' : taught ? 'taught' : 'not taught yet' }
  })

  // ── Fetch pulse report ───────────────────────────────────────────────────
  const fetchPulse = useCallback(async (force = false) => {
    // Don't call the API before IndexedDB has loaded — would cache empty results
    if (students.length === 0) return
    const attBucket = classAttRate < 0.6 ? 'low' : classAttRate < 0.85 ? 'mid' : 'high'
    const testKey = testSummary.map(t => t.topic).sort().join('~')
    const ck = aiKey('class-pulse', { classId, attBucket, testKey, sc: students.length, tc: testSummary.length })
    if (!force) {
      const cached = getAiCache<PulseReport>(ck)
      if (cached) { setPulse(cached); return }
    }
    setPulseLoading(true)
    setPulseError('')
    try {
      const res = await fetch('/api/class-pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: cls?.name ?? classId,
          subject: teacher?.subject ?? '',
          grade: cls?.grade ?? teacher?.grade ?? '',
          students: studentStats.map(s => ({
            name: s.name,
            avgMastery: s.avgMastery,
            attendanceRate: s.attendanceRate,
            interests: s.interests,
          })),
          tests: testSummary,
          attendanceRate: classAttRate,
          topicCoverage,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setPulse(data)
      setAiCache(ck, data, TTL.ONE_DAY)
    } catch {
      setPulseError('Could not generate pulse report. Please try again.')
    } finally {
      setPulseLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, cls, teacher, classAttRate, students.length, sessions.length, testSummary.length, topicCoverage.length])

  // ── Fetch peer pairs ─────────────────────────────────────────────────────
  const fetchPairs = useCallback(async () => {
    if (students.length < 2) return
    const topic = syllabus.find(t => t.id === selectedTopicId)?.topic ?? 'General'
    const studentKey = students.map(s => s.id).sort().join('~')
    const ck = aiKey('peer-pair', { topic: topic.toLowerCase().trim(), subject: (teacher?.subject ?? '').toLowerCase(), studentKey })
    const cached = getAiCache<PeerPair[]>(ck)
    if (cached) { setPairs(cached); return }
    setPairsLoading(true)
    setPairsError('')
    setPairs([])
    try {
      const res = await fetch('/api/peer-pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: studentStats,
          topic,
          subject: teacher?.subject ?? '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const { pairs: p } = await res.json()
      setAiCache(ck, p ?? [], TTL.ONE_DAY)
      setPairs(p ?? [])
    } catch {
      setPairsError('Could not generate peer pairs. Please try again.')
    } finally {
      setPairsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, students.length, selectedTopicId, teacher])

  useEffect(() => { fetchPulse() }, [fetchPulse])

  // ── Mastery distribution ─────────────────────────────────────────────────
  const proficient  = studentStats.filter(s => s.avgMastery >= 0.75).length
  const developing  = studentStats.filter(s => s.avgMastery >= 0.5 && s.avgMastery < 0.75).length
  const struggling  = studentStats.filter(s => s.avgMastery > 0 && s.avgMastery < 0.5).length
  const notAssessed = studentStats.filter(s => s.avgMastery === 0).length

  const PULSE_CARDS = [
    { label: 'Class Health',      icon: <Heart size={14} className="text-emerald-500" />, bg: 'bg-emerald-50 border-emerald-100', key: 'health' as const },
    { label: 'Concern Areas',     icon: <AlertTriangle size={14} className="text-amber-500" />, bg: 'bg-amber-50 border-amber-100', key: 'concerns' as const },
    { label: 'Wins to Celebrate', icon: <Trophy size={14} className="text-yellow-500" />, bg: 'bg-yellow-50 border-yellow-100', key: 'wins' as const },
    { label: "This Week's Focus", icon: <Target size={14} className="text-blue-500" />, bg: 'bg-blue-50 border-blue-100', key: 'focus' as const },
  ]

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Strong', n: proficient, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Improving', n: developing, color: 'text-amber-700',   bg: 'bg-amber-50' },
          { label: 'Needs Help', n: struggling, color: 'text-red-700',     bg: 'bg-red-50' },
          { label: 'Not tested', n: notAssessed, color: 'text-slate-500',  bg: 'bg-slate-50' },
        ].map(({ label, n, color, bg }) => (
          <div key={label} className={clsx('rounded-2xl p-2.5 text-center border border-white/60', bg)}>
            <p className={clsx('text-xl font-black', color)}>{n}</p>
            <p className="text-[10px] text-slate-500 font-semibold leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Attendance bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-700">Class Attendance</span>
          <span className="text-sm font-black text-blue-700">{Math.round(classAttRate * 100)}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div
            className={clsx('h-2.5 rounded-full transition-all', classAttRate >= 0.75 ? 'bg-emerald-500' : classAttRate >= 0.5 ? 'bg-amber-400' : 'bg-red-500')}
            style={{ width: `${Math.round(classAttRate * 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1.5">{sessions.length} sessions · {students.length} students</p>
      </div>

      {/* AI Pulse Report */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
              <Activity size={15} className="text-violet-600" />
            </div>
            <span className="font-bold text-slate-800">Class Report</span>
          </div>
          {!pulseLoading && (
            <button
              onClick={() => fetchPulse(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className="text-slate-400" />
            </button>
          )}
        </div>

        {pulseLoading && (
          <div className="space-y-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="card space-y-2">
                <div className="h-3 bg-slate-100 rounded-full animate-pulse w-28" />
                <div className="h-4 bg-slate-100 rounded-full animate-pulse w-full" />
                <div className="h-4 bg-slate-100 rounded-full animate-pulse w-4/5" />
              </div>
            ))}
          </div>
        )}

        {!pulseLoading && pulseError && (
          <div className="card text-center py-5">
            <p className="text-sm text-red-600">{pulseError}</p>
            <button onClick={() => fetchPulse(true)} className="mt-2 text-sm text-blue-600 font-semibold">Retry</button>
          </div>
        )}

        {!pulseLoading && !pulseError && pulse && (
          <>
            {PULSE_CARDS.map(({ label, icon, bg, key }) => (
              <div key={key} className={clsx('border rounded-2xl p-4', bg)}>
                <div className="flex items-center gap-1.5 mb-2">
                  {icon}
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{label}</p>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{pulse[key]}</p>
              </div>
            ))}
          </>
        )}

        {!pulseLoading && !pulseError && !pulse && students.length === 0 && (
          <div className="card text-center py-8">
            <Users size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Add students and record sessions to generate a class pulse.</p>
          </div>
        )}
      </div>

      {/* Peer Pairing */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
            <Link2 size={15} className="text-blue-600" />
          </div>
          <span className="font-bold text-slate-800">Study Partners</span>
        </div>

        <p className="text-sm text-slate-500">
          Pairs a stronger student with a weaker one who shares interests — peer support without the teacher being everywhere.
        </p>

        {/* Topic selector for context */}
        <div>
          <label className="label">Topic context (optional)</label>
          <select
            value={selectedTopicId}
            onChange={e => setSelectedTopicId(e.target.value)}
            className="input-field"
          >
            <option value="">General class performance</option>
            {syllabus.map(t => <option key={t.id} value={t.id}>{t.topic}</option>)}
          </select>
        </div>

        <button
          onClick={fetchPairs}
          disabled={pairsLoading || students.length < 2}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-700 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
        >
          {pairsLoading
            ? <><RefreshCw size={15} className="animate-spin" /> Generating Pairs…</>
            : <><Sparkles size={15} /> Generate Peer Pairs</>}
        </button>

        {students.length < 2 && (
          <p className="text-xs text-slate-400 text-center">Need at least 2 students to generate pairs.</p>
        )}

        {pairsError && (
          <p className="text-sm text-red-600 text-center">{pairsError}</p>
        )}

        {!pairsLoading && pairs.length > 0 && (
          <div className="space-y-2">
            {pairs.map((pair, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-xs font-black text-emerald-700">
                      {pair.mentor[0]}
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-bold">Mentor</p>
                      <p className="text-sm font-semibold text-slate-800">{pair.mentor}</p>
                    </div>
                  </div>
                  <Link2 size={14} className="text-slate-300 shrink-0" />
                  <div className="flex-1 flex items-center gap-2 justify-end">
                    <div className="text-right">
                      <p className="text-xs text-blue-600 font-bold">Mentee</p>
                      <p className="text-sm font-semibold text-slate-800">{pair.mentee}</p>
                    </div>
                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center text-xs font-black text-blue-700">
                      {pair.mentee[0]}
                    </div>
                  </div>
                </div>
                {pair.sharedInterest && pair.sharedInterest !== 'different interests' && (
                  <p className="text-xs text-violet-600 font-semibold mb-1.5">
                    Shared: {pair.sharedInterest}
                  </p>
                )}
                <div className="bg-slate-50 rounded-xl px-3 py-2">
                  <p className="text-xs font-bold text-slate-500 mb-0.5">Activity</p>
                  <p className="text-sm text-slate-700">{pair.activity}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
