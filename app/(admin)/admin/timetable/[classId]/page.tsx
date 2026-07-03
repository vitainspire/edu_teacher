'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAdmin } from '@/lib/admin-context'
import {
  ArrowLeft, Loader2, Send, X, Check, Edit2, Trash2,
  Plus, Coffee, UtensilsCrossed, AlertCircle, ExternalLink, Copy, CalendarCheck
} from 'lucide-react'
import Link from 'next/link'
import type { Class, SchoolTimetablePeriod, ScheduleSlot, SchoolSchedule } from '@/lib/types'

const DAYS      = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface ClassAssignment { teacherId: string; classId: string; subject?: string }
interface TeacherInfo     { id: string; name: string }

export default function ClassTimetablePage() {
  const params  = useParams()
  const router  = useRouter()
  const classId = params.classId as string
  const { school } = useAdmin()

  const [schedule,    setSchedule]    = useState<SchoolSchedule | null>(null)
  const [periods,     setPeriods]     = useState<SchoolTimetablePeriod[]>([])
  const [classInfo,   setClassInfo]   = useState<Class | null>(null)
  const [assignments, setAssignments] = useState<ClassAssignment[]>([])
  const [teachers,    setTeachers]    = useState<TeacherInfo[]>([])
  const [loading,     setLoading]     = useState(true)

  // Modal state
  const [modal,            setModal]            = useState<{ slot: ScheduleSlot; day: number } | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')
  const [selectedLabel,    setSelectedLabel]    = useState<string>('')
  const [applyToAllDays,   setApplyToAllDays]   = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [conflictErrors,   setConflictErrors]   = useState<string[]>([])

  // Action states
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [copyingDay,  setCopyingDay]  = useState<number | null>(null)
  const [publishing,  setPublishing]  = useState(false)
  const [publishMsg,  setPublishMsg]  = useState('')

  const load = useCallback(() => {
    if (!school) { setLoading(false); return }
    Promise.all([
      fetch(`/api/admin/schools/${school.id}/schedule`).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/timetable`).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/classes`).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/classes/${classId}/assign-teacher`).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/teachers`).then(r => r.json()),
    ]).then(([sd, tt, cd, at, td]) => {
      setSchedule(sd.schedule ?? null)
      setPeriods((tt.periods ?? []).filter((p: SchoolTimetablePeriod) => p.classId === classId))
      setClassInfo((cd.classes ?? []).find((c: Class) => c.id === classId) ?? null)
      setAssignments(at.assignments ?? [])
      setTeachers(td.teachers ?? [])
    }).finally(() => setLoading(false))
  }, [school, classId])

  useEffect(() => { load() }, [load])

  const teacherName = (tid: string) => teachers.find(t => t.id === tid)?.name ?? '—'

  function periodAt(slot: ScheduleSlot, day: number) {
    return periods.find(p => p.dayOfWeek === day && p.periodNumber === slot.periodNumber)
  }

  function openModal(slot: ScheduleSlot, day: number, forAllDays = false) {
    const existing = periodAt(slot, day)
    setSelectedTeacherId(existing?.teacherId ?? '')
    setSelectedLabel(existing?.label ?? '')
    setApplyToAllDays(forAllDays)
    setModal({ slot, day })
  }

  async function savePeriod() {
    if (!school || !modal || !selectedTeacherId) return
    setSaving(true)
    setConflictErrors([])
    const { slot } = modal
    const daysToSave = applyToAllDays ? [1, 2, 3, 4, 5, 6] : [modal.day]

    const results = await Promise.all(daysToSave.map(async day => {
      const existing = periodAt(slot, day)
      const res = await fetch(`/api/admin/schools/${school.id}/timetable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existing?.id,
          dayOfWeek: day,
          periodNumber: slot.periodNumber,
          startTime: slot.startTime,
          endTime: slot.endTime,
          classId,
          teacherId: selectedTeacherId,
          label: selectedLabel || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return body.message as string ?? `Could not save ${DAYS[day - 1]}`
      }
      return null
    }))

    setSaving(false)
    const errors = results.filter((e): e is string => e !== null)
    if (errors.length > 0) {
      setConflictErrors(errors)
      load()
    } else {
      setModal(null)
      load()
    }
  }

  async function clearPeriod(slot: ScheduleSlot, day: number) {
    if (!school) return
    const existing = periodAt(slot, day)
    if (!existing) return
    setDeletingId(existing.id)
    await fetch(`/api/admin/schools/${school.id}/timetable`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId: existing.id }),
    })
    setDeletingId(null)
    load()
  }

  async function copyDayToAll(sourceDay: number) {
    if (!school || !schedule) return
    const sourcePeriods = periods.filter(p => p.dayOfWeek === sourceDay)
    if (sourcePeriods.length === 0) return
    setCopyingDay(sourceDay)

    const otherDays = [1, 2, 3, 4, 5, 6].filter(d => d !== sourceDay)
    await Promise.all(otherDays.flatMap(day =>
      sourcePeriods.map(sp => {
        const existing = periods.find(p => p.dayOfWeek === day && p.periodNumber === sp.periodNumber)
        return fetch(`/api/admin/schools/${school.id}/timetable`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existing?.id,
            dayOfWeek: day,
            periodNumber: sp.periodNumber,
            startTime: sp.startTime,
            endTime: sp.endTime,
            classId,
            teacherId: sp.teacherId,
            label: sp.label,
          }),
        })
      })
    ))

    setCopyingDay(null)
    load()
  }

  async function publish() {
    if (!school) return
    setPublishing(true)
    const res = await fetch(`/api/admin/schools/${school.id}/timetable/publish`, { method: 'POST' })
    if (res.ok) { setPublishMsg('Published!'); setTimeout(() => setPublishMsg(''), 3000) }
    setPublishing(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
    </div>
  )

  if (!schedule) return (
    <div className="p-6 max-w-xl mx-auto text-center py-20">
      <p className="text-gray-500 mb-3">No school schedule template set up yet.</p>
      <Link href="/admin/timetable" className="text-indigo-600 underline text-sm">Set up schedule →</Link>
    </div>
  )

  const slots         = schedule.slots
  const assignedCount = periods.length
  const totalSlots    = slots.filter(s => s.type === 'period').length * 6

  return (
    <div className="p-6 max-w-full mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.push('/admin/timetable')}
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {classInfo?.name ?? 'Class'} — Timetable
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Grade {classInfo?.grade} · Section {classInfo?.section} · {assignedCount} of {totalSlots} slots filled
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {publishMsg && (
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
              {publishMsg}
            </span>
          )}
          <button
            onClick={publish}
            disabled={publishing || periods.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-60"
            style={{ background: '#059669' }}
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publish
          </button>
        </div>
      </div>

      {/* ── No subjects warning ── */}
      {assignments.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Step required: Assign subjects first</p>
            <p className="text-xs text-amber-600 mt-1 leading-relaxed">
              Before filling the timetable, go to <strong>Classes → {classInfo?.name} → Assign</strong> and add
              subject–teacher pairs (e.g. Maths → Mr. Raj, Science → Ms. Priya). Once done, come back here — the
              timetable slots will show a picker with those subject cards.
            </p>
          </div>
          <Link
            href={`/admin/classes/${classId}/assign`}
            className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors px-3 py-1.5 rounded-lg flex-shrink-0 whitespace-nowrap"
          >
            Go to Assign <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* ── Subjects legend ── */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subjects in this class</p>
            <p className="text-xs text-gray-400">Click a period number to fill all days at once</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {assignments.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: SUBJECT_COLORS[i % SUBJECT_COLORS.length].bg, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length].text }}
              >
                <span className="font-semibold">{a.subject ?? 'Subject'}</span>
                <span className="opacity-60">·</span>
                <span>{teacherName(a.teacherId)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Timetable grid ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 720 }}>
            <thead>
              {/* Row 1: Day names */}
              <tr>
                <th className="w-28 px-4 py-3 text-left border-b border-r border-gray-100" style={{ background: '#f8fafc' }}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</p>
                </th>
                {DAYS.map((day, i) => (
                  <th
                    key={day}
                    className="px-3 py-3 text-center border-b border-r border-gray-100 last:border-r-0"
                    style={{ background: '#f8fafc' }}
                  >
                    <p className="text-xs font-bold text-gray-700">{DAY_SHORT[i]}</p>
                    <p className="text-[10px] text-gray-400 font-normal">{day}</p>
                  </th>
                ))}
              </tr>

              {/* Row 2: Copy-day-to-all action row */}
              <tr style={{ background: '#faf5ff' }}>
                <td className="px-4 py-2 border-b border-r border-purple-100">
                  <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide">Copy day →</p>
                  <p className="text-[9px] text-gray-400 leading-tight mt-0.5">
                    Fills all other days<br />with that day&apos;s schedule
                  </p>
                </td>
                {DAYS.map((day, i) => {
                  const dayNum   = i + 1
                  const dayFilled = periods.filter(p => p.dayOfWeek === dayNum).length
                  const isCopying = copyingDay === dayNum
                  return (
                    <td key={day} className="px-2 py-2 text-center border-b border-r border-purple-100 last:border-r-0">
                      {dayFilled > 0 ? (
                        <button
                          onClick={() => copyDayToAll(dayNum)}
                          disabled={!!copyingDay}
                          title={`Copy all of ${day}'s schedule to the other 5 days`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-40 hover:opacity-80"
                          style={{ background: '#ede9fe', color: '#6d28d9' }}
                        >
                          {isCopying
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Copy className="w-3 h-3" />}
                          Copy {DAY_SHORT[i]}
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {slots.map((slot, idx) => {

                // Break row
                if (slot.type === 'break') {
                  return (
                    <tr key={idx} style={{ background: '#fffbeb' }}>
                      <td className="px-4 py-2.5 border-b border-r border-amber-100">
                        <div className="flex items-center gap-2">
                          {slot.label.toLowerCase().includes('lunch')
                            ? <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                            : <Coffee className="w-3.5 h-3.5 text-amber-400" />}
                          <div>
                            <p className="text-xs font-semibold text-amber-700">{slot.label}</p>
                            <p className="text-[10px] text-amber-400">{slot.startTime}–{slot.endTime}</p>
                          </div>
                        </div>
                      </td>
                      <td colSpan={6} className="border-b border-amber-100 text-center">
                        <p className="text-xs text-amber-300 italic py-2.5">{slot.startTime} – {slot.endTime}</p>
                      </td>
                    </tr>
                  )
                }

                // Period row
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">

                    {/* Period label — click to fill ALL days */}
                    <td
                      className="px-4 py-3 border-b border-r border-gray-100 align-middle group/period cursor-pointer"
                      style={{ background: '#f8fafc' }}
                      onClick={() => openModal(slot, 1, true)}
                      title="Click to assign this period across all days at once"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors group-hover/period:bg-indigo-200"
                          style={{ background: '#ede9fe', color: '#6d28d9' }}
                        >
                          {slot.periodNumber}
                        </span>
                        <div>
                          <p className="text-[10px] font-medium text-gray-500">{slot.startTime}</p>
                          <p className="text-[10px] text-gray-400">{slot.endTime}</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-indigo-400 mt-1 opacity-0 group-hover/period:opacity-100 transition-opacity flex items-center gap-0.5">
                        <CalendarCheck className="w-2.5 h-2.5" /> Fill all days
                      </p>
                    </td>

                    {/* Day cells */}
                    {DAYS.map((_, di) => {
                      const day       = di + 1
                      const period    = periodAt(slot, day)
                      const isDeleting = period && deletingId === period.id
                      const aIdx      = period
                        ? assignments.findIndex(a => a.teacherId === period.teacherId && a.subject === period.label)
                        : -1
                      const aColor    = aIdx >= 0 ? SUBJECT_COLORS[aIdx % SUBJECT_COLORS.length] : null

                      return (
                        <td
                          key={day}
                          className="px-2 py-2 border-b border-r border-gray-100 last:border-r-0 align-middle"
                          style={{ minWidth: 115 }}
                        >
                          {period ? (
                            <div
                              className="rounded-xl p-2 relative group/cell"
                              style={{
                                background: aColor?.bg ?? '#f0fdf4',
                                border: `1px solid ${aColor?.border ?? '#bbf7d0'}`,
                              }}
                            >
                              <p className="text-xs font-semibold leading-tight truncate" style={{ color: aColor?.text ?? '#065f46' }}>
                                {period.label ?? '—'}
                              </p>
                              <p className="text-[10px] mt-0.5 leading-tight truncate opacity-70" style={{ color: aColor?.text ?? '#065f46' }}>
                                {teacherName(period.teacherId ?? '')}
                              </p>
                              {/* Hover overlay */}
                              <div className="absolute inset-0 rounded-xl bg-white/90 flex items-center justify-center gap-1.5 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openModal(slot, day)}
                                  className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => clearPeriod(slot, day)}
                                  disabled={!!isDeleting}
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"
                                  title="Clear"
                                >
                                  {isDeleting
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openModal(slot, day)}
                              className="w-full h-12 rounded-xl border-2 border-dashed border-gray-200 text-gray-300
                                hover:border-indigo-300 hover:text-indigo-400 hover:bg-indigo-50 transition-all
                                flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Assignment modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-base font-bold text-gray-900">{modal.slot.label}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modal.slot.startTime} – {modal.slot.endTime} · {classInfo?.name}
                </p>
              </div>
              <button onClick={() => { setModal(null); setConflictErrors([]) }} className="text-gray-300 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Apply to all days toggle */}
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-4 mt-3">
              <button
                onClick={() => setApplyToAllDays(v => !v)}
                className="relative w-10 h-5 rounded-full flex-shrink-0 transition-colors"
                style={{ background: applyToAllDays ? '#4338ca' : '#cbd5e1' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                  style={{ left: applyToAllDays ? '22px' : '2px' }}
                />
              </button>
              <div>
                <p className="text-xs font-semibold text-indigo-800">Apply to all days (Mon – Sat)</p>
                <p className="text-[10px] text-indigo-400 mt-0.5">
                  {applyToAllDays ? 'Will fill all 6 days for this period' : 'Will fill only ' + DAYS[modal.day - 1]}
                </p>
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Subject Label <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={selectedLabel}
              onChange={e => setSelectedLabel(e.target.value)}
              placeholder="e.g. Mathematics, English, Science…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4"
            />

            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Select Teacher
            </label>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
              {teachers.map((t, i) => {
                const color    = SUBJECT_COLORS[i % SUBJECT_COLORS.length]
                const selected = selectedTeacherId === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTeacherId(t.id); setConflictErrors([]) }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all"
                    style={{
                      borderColor: selected ? color.text : '#e5e7eb',
                      background:  selected ? color.bg   : 'white',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: selected ? color.text : '#f1f5f9' }}
                    >
                      <span className="text-xs font-bold" style={{ color: selected ? 'white' : '#64748b' }}>
                        {t.name[0]?.toUpperCase() ?? 'T'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{t.name}</p>
                    </div>
                    {selected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: color.text }} />}
                  </button>
                )
              })}
            </div>

            {/* Conflict errors */}
            {conflictErrors.length > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm font-bold text-red-700">
                    {conflictErrors.length === 1 ? 'Conflict detected' : `${conflictErrors.length} conflicts detected`}
                  </p>
                </div>
                {conflictErrors.map((msg, i) => (
                  <p key={i} className="text-xs text-red-600 leading-relaxed pl-6">{msg}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setModal(null); setConflictErrors([]) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={savePeriod}
                disabled={saving || !selectedTeacherId}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#4338ca' }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {applyToAllDays ? 'Save to All Days' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const SUBJECT_COLORS = [
  { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#cffafe', text: '#164e63', border: '#67e8f9' },
  { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  { bg: '#f0fdf4', text: '#14532d', border: '#86efac' },
]
