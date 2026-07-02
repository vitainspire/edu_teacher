'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAdmin } from '@/lib/admin-context'
import {
  CalendarDays, Plus, Trash2, Loader2, Send, X, Wand2,
  Coffee, UtensilsCrossed, ChevronRight, Check, Edit2, ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import type { Class, SchoolTimetablePeriod, ScheduleSlot, SchoolSchedule } from '@/lib/types'

const DAYS_COUNT = 6

function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minsToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function generateSlots(
  startTime: string, endTime: string, periodMins: number,
  breaks: { label: string; startTime: string; endTime: string }[]
): ScheduleSlot[] {
  const end = timeToMins(endTime)
  const sortedBreaks = [...breaks].sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime))
  const slots: ScheduleSlot[] = []
  let cursor = timeToMins(startTime)
  let periodNumber = 1
  while (cursor + periodMins <= end) {
    const clash = sortedBreaks.find(b => {
      const bs = timeToMins(b.startTime), be = timeToMins(b.endTime)
      return (bs >= cursor && bs < cursor + periodMins) || (cursor >= bs && cursor < be)
    })
    if (clash) {
      const bs = timeToMins(clash.startTime)
      if (bs > cursor && bs - cursor >= periodMins) {
        slots.push({ type: 'period', periodNumber, label: `Period ${periodNumber}`, startTime: minsToTime(cursor), endTime: minsToTime(cursor + periodMins) })
        periodNumber++; cursor += periodMins
      } else { cursor = bs }
      if (!slots.find(s => s.type === 'break' && s.label === clash.label))
        slots.push({ type: 'break', label: clash.label, startTime: clash.startTime, endTime: clash.endTime })
      cursor = timeToMins(clash.endTime)
    } else {
      slots.push({ type: 'period', periodNumber, label: `Period ${periodNumber}`, startTime: minsToTime(cursor), endTime: minsToTime(cursor + periodMins) })
      periodNumber++; cursor += periodMins
    }
  }
  return slots
}

interface BreakInput { label: string; startTime: string; endTime: string }
interface SetupForm { startTime: string; endTime: string; periodMins: number; breaks: BreakInput[] }
const DEFAULT_FORM: SetupForm = {
  startTime: '09:00', endTime: '17:00', periodMins: 45,
  breaks: [
    { label: 'Short Break', startTime: '10:30', endTime: '10:45' },
    { label: 'Lunch Break', startTime: '13:00', endTime: '13:45' },
  ],
}

const CLASS_COLORS = ['#6366f1', '#0891b2', '#059669', '#d97706', '#e11d48', '#7c3aed']

export default function TimetablePage() {
  const { school } = useAdmin()
  const [schedule, setSchedule] = useState<SchoolSchedule | null>(null)
  const [periods, setPeriods] = useState<SchoolTimetablePeriod[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState('')

  // Setup form state
  const [setupForm, setSetupForm] = useState<SetupForm>(DEFAULT_FORM)
  const [previewSlots, setPreviewSlots] = useState<ScheduleSlot[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)

  const load = useCallback(() => {
    if (!school) { setLoading(false); return }
    Promise.all([
      fetch(`/api/admin/schools/${school.id}/schedule`).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/timetable`).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/classes`).then(r => r.json()),
    ]).then(([sd, tt, cd]) => {
      setSchedule(sd.schedule ?? null)
      setPeriods(tt.periods ?? [])
      setClasses(cd.classes ?? [])
    }).finally(() => setLoading(false))
  }, [school])

  useEffect(() => { load() }, [load])

  function handleGenerate() {
    setPreviewSlots(generateSlots(setupForm.startTime, setupForm.endTime, setupForm.periodMins, setupForm.breaks))
    setShowPreview(true)
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/admin/schedule-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      const data = await res.json()
      if (data.form) {
        setSetupForm(data.form)
        setPreviewSlots(generateSlots(data.form.startTime, data.form.endTime, data.form.periodMins, data.form.breaks))
        setShowPreview(true)
        setShowAiPanel(false)
      }
    } finally { setAiLoading(false) }
  }

  async function saveSchedule() {
    if (!school || previewSlots.length === 0) return
    setSavingSchedule(true)
    try {
      const res = await fetch(`/api/admin/schools/${school.id}/schedule`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: previewSlots }),
      })
      const data = await res.json()
      setSchedule(data.schedule)
      setShowPreview(false)
      setEditingTemplate(false)
    } finally { setSavingSchedule(false) }
  }

  async function publish() {
    if (!school) return
    setPublishing(true)
    const res = await fetch(`/api/admin/schools/${school.id}/timetable/publish`, { method: 'POST' })
    if (res.ok) { setPublishMsg('Timetable published to all teachers!'); setTimeout(() => setPublishMsg(''), 4000) }
    setPublishing(false)
  }

  // Per-class helpers
  const classAssignedCount = (classId: string) => periods.filter(p => p.classId === classId).length
  const periodSlotsCount = schedule?.slots.filter(s => s.type === 'period').length ?? 0

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>

  // ── SETUP VIEW ───────────────────────────────────────────────────────────────
  if (!schedule || editingTemplate) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe' }}>
            <CalendarDays className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {editingTemplate ? 'Edit Schedule Template' : 'Set Up School Schedule'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Define your school's daily period structure</p>
          </div>
          {editingTemplate && (
            <button onClick={() => { setEditingTemplate(false); setShowPreview(false) }} className="ml-auto text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* AI panel */}
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-indigo-600" />
              <p className="text-sm font-semibold text-indigo-800">Generate with AI</p>
            </div>
            <button onClick={() => setShowAiPanel(v => !v)} className="text-xs text-indigo-600 underline">
              {showAiPanel ? 'Hide' : 'Describe your schedule'}
            </button>
          </div>
          {showAiPanel ? (
            <div className="space-y-3">
              <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={3}
                placeholder='e.g. "School 9am–4pm, 45-min periods, short break 10:30–10:45, lunch 1pm–1:45pm"'
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
              />
              <button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-60"
                style={{ background: '#6366f1' }}>
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Generate Schedule
              </button>
            </div>
          ) : (
            <p className="text-xs text-indigo-500">Describe your school hours and breaks in plain text — AI will build the period structure for you.</p>
          )}
        </div>

        {/* Manual form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <p className="text-sm font-semibold text-gray-700">Or configure manually</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'School Start', key: 'startTime' as const },
              { label: 'School End', key: 'endTime' as const },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label}</label>
                <input type="time" value={setupForm[f.key] as string}
                  onChange={e => setSetupForm(s => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Period Duration (min)</label>
              <input type="number" min={20} max={120} value={setupForm.periodMins}
                onChange={e => setSetupForm(s => ({ ...s, periodMins: +e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Breaks</label>
              <button onClick={() => setSetupForm(s => ({ ...s, breaks: [...s.breaks, { label: 'Break', startTime: '12:00', endTime: '12:15' }] }))}
                className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Break
              </button>
            </div>
            <div className="space-y-2">
              {setupForm.breaks.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={b.label} placeholder="Break name"
                    onChange={e => setSetupForm(s => ({ ...s, breaks: s.breaks.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input type="time" value={b.startTime}
                    onChange={e => setSetupForm(s => ({ ...s, breaks: s.breaks.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x) }))}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <span className="text-gray-400 text-xs">to</span>
                  <input type="time" value={b.endTime}
                    onChange={e => setSetupForm(s => ({ ...s, breaks: s.breaks.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x) }))}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button onClick={() => setSetupForm(s => ({ ...s, breaks: s.breaks.filter((_, j) => j !== i) }))}
                    className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: '#4338ca' }}>
            <ChevronRight className="w-4 h-4" /> Generate Period Slots
          </button>
        </div>

        {/* Preview */}
        {showPreview && previewSlots.length > 0 && (
          <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="font-semibold text-gray-700 text-sm">
                Preview — {previewSlots.filter(s => s.type === 'period').length} periods/day
              </p>
              <p className="text-xs text-gray-400">{setupForm.startTime} – {setupForm.endTime}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {previewSlots.map((slot, i) => (
                <div key={i} className={`flex items-center gap-3 px-5 py-3 ${slot.type === 'break' ? 'bg-amber-50' : ''}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${slot.type === 'break' ? 'bg-amber-100' : 'bg-indigo-50'}`}>
                    {slot.type === 'break'
                      ? (slot.label.toLowerCase().includes('lunch') ? <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" /> : <Coffee className="w-3.5 h-3.5 text-amber-500" />)
                      : <span className="text-[10px] font-bold text-indigo-600">{slot.periodNumber}</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${slot.type === 'break' ? 'text-amber-700' : 'text-gray-700'}`}>{slot.label}</p>
                    <p className="text-xs text-gray-400">{slot.startTime} – {slot.endTime}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowPreview(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Edit</button>
              <button onClick={saveSchedule} disabled={savingSchedule}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#059669' }}>
                {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save Schedule
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── OVERVIEW VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-amber-600" /> Timetable
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {periodSlotsCount} periods/day · {classes.length} classes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditingTemplate(true); setShowPreview(false); setPreviewSlots([]) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Edit Template
          </button>
          <button onClick={publish} disabled={publishing || periods.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-60"
            style={{ background: '#059669' }}>
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publish to Teachers
          </button>
        </div>
      </div>

      {publishMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          {publishMsg} <button onClick={() => setPublishMsg('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Schedule summary strip */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 overflow-x-auto">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Daily Schedule</p>
        <div className="flex items-center gap-2 flex-nowrap">
          {schedule.slots.map((slot, i) => (
            <div key={i} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ${
              slot.type === 'break'
                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
            }`}>
              {slot.type === 'period' ? `P${slot.periodNumber}` : slot.label}
              <span className="block text-[10px] font-normal opacity-70">{slot.startTime}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Class cards */}
      {classes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No classes yet</p>
          <p className="text-sm text-gray-400 mt-1">Create classes first, then assign their timetables</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, i) => {
            const color = CLASS_COLORS[i % CLASS_COLORS.length]
            const assigned = classAssignedCount(cls.id)
            const total = periodSlotsCount * DAYS_COUNT
            const pct = total > 0 ? Math.round((assigned / total) * 100) : 0

            return (
              <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                <div className="h-1.5" style={{ background: color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{cls.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Grade {cls.grade} · Section {cls.section}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: pct === 100 ? '#d1fae5' : pct > 0 ? '#ede9fe' : '#f1f5f9', color: pct === 100 ? '#065f46' : pct > 0 ? '#6d28d9' : '#94a3b8' }}>
                      {pct}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>

                  <p className="text-xs text-gray-400 mb-4">
                    {assigned} of {total} period slots assigned
                  </p>

                  <Link href={`/admin/timetable/${cls.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: color }}>
                    {assigned > 0 ? 'Edit Timetable' : 'Set Up Timetable'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
