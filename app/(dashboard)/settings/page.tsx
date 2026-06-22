'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Check, Calendar, BookOpen, Clock, Plus, Trash2, HelpCircle, Copy } from 'lucide-react'
import { useApp } from '@/lib/context'
import FeatureTour from '@/components/onboarding/FeatureTour'
import FlowGuide from '@/components/onboarding/FlowGuide'
import clsx from 'clsx'

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TERMS = ['Term 1', 'Term 2', 'Term 3']

export default function SettingsPage() {
  const { teacher, classes, updateTeacherSettings, timetableEntries, addTimetableEntry, removeTimetableEntry } = useApp()
  const router = useRouter()

  const [yearStart, setYearStart]   = useState(teacher?.academicYearStart ?? '')
  const [term, setTerm]             = useState(teacher?.currentTerm ?? 'Term 1')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [teacherCodeCopied, setTeacherCodeCopied] = useState(false)

  // Timetable add-form state
  const [ttDay, setTtDay]         = useState(1)
  const [ttPeriod, setTtPeriod]   = useState('1')
  const [ttStart, setTtStart]     = useState('09:00')
  const [ttEnd, setTtEnd]         = useState('09:45')
  const [ttClassId, setTtClassId] = useState(classes[0]?.id ?? '')
  const [ttAdding, setTtAdding]   = useState(false)
  const [showTour, setShowTour]         = useState(false)
  const [showFlowGuide, setShowFlowGuide] = useState(false)
  const [showGuideBtn, setShowGuideBtn] = useState(true)
  const guideBtnKey = teacher ? `eduteach_show_guide_btn_${teacher.id}` : null

  useEffect(() => {
    if (!guideBtnKey) return
    setShowGuideBtn(localStorage.getItem(guideBtnKey) !== 'false')
  }, [guideBtnKey])

  const toggleGuideBtn = (val: boolean) => {
    setShowGuideBtn(val)
    if (guideBtnKey) localStorage.setItem(guideBtnKey, String(val))
  }

  const handleAddEntry = async () => {
    if (!ttClassId) return
    setTtAdding(true)
    await addTimetableEntry({
      classId: ttClassId,
      dayOfWeek: ttDay,
      periodNumber: parseInt(ttPeriod) || 1,
      startTime: ttStart,
      endTime: ttEnd,
    })
    setTtAdding(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await updateTeacherSettings({ academicYearStart: yearStart || undefined, currentTerm: term })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Derive week number from academicYearStart
  const currentWeek = (() => {
    if (!yearStart) return null
    const start = new Date(yearStart + 'T00:00:00')
    const now   = new Date()
    const diff  = now.getTime() - start.getTime()
    if (diff < 0) return null
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  })()

  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-5 pb-4 flex items-center gap-3 sticky top-0 z-10" style={{ boxShadow: '0 1px 12px rgba(15,23,42,0.06)' }}>
        <button onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{ background: '#f1f5f9' }}>
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-lg font-black text-slate-900">Settings</h2>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Academic Year */}
        <div className="bg-white rounded-3xl p-5 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
              <Calendar size={16} className="text-blue-600" />
            </div>
            <p className="font-black text-slate-800">Academic Year</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
              Year Start Date
            </label>
            <input
              type="date"
              value={yearStart}
              onChange={e => setYearStart(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-400 bg-white"
            />
            {currentWeek !== null && (
              <p className="text-xs text-blue-600 font-semibold mt-1.5">
                Currently Week {currentWeek} of the academic year
              </p>
            )}
            {!yearStart && (
              <p className="text-xs text-slate-400 mt-1.5">
                Set this so the app can track pacing and show progress over time.
              </p>
            )}
          </div>
        </div>

        {/* Current Term */}
        <div className="bg-white rounded-3xl p-5 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' }}>
              <BookOpen size={16} className="text-violet-600" />
            </div>
            <p className="font-black text-slate-800">Current Term</p>
          </div>

          <div className="flex gap-3">
            {TERMS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={clsx(
                  'flex-1 py-3 rounded-2xl font-bold text-sm border-2 transition-all',
                  term === t
                    ? 'bg-violet-700 border-violet-700 text-white'
                    : 'bg-white border-slate-200 text-slate-600',
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            New tests will be tagged with the current term automatically.
          </p>
        </div>

        {/* Teacher Info (read-only) */}
        <div className="bg-white rounded-3xl p-5 space-y-3" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="font-black text-slate-800 mb-1">Profile</p>
          {[
            { label: 'Name',    value: teacher?.name },
            { label: 'School',  value: teacher?.schoolName },
            { label: 'Subject', value: teacher?.subject },
            { label: 'Grade',   value: teacher?.grade },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{row.label}</span>
              <span className="text-sm font-semibold text-slate-700">{row.value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Scanner Teacher Code */}
        <div className="bg-white rounded-3xl p-5 space-y-3" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
              <BookOpen size={16} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-black text-slate-800 leading-none">Scanner Code</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Give this to whoever scans your papers</p>
            </div>
          </div>
          {teacher?.teacherCode ? (
            <div className="flex items-center gap-3">
              <div
                className="flex-1 rounded-2xl py-3.5 text-center font-black text-2xl text-indigo-700"
                style={{ background: '#eef2ff', border: '2px dashed #a5b4fc', letterSpacing: '0.4em' }}
              >
                {teacher.teacherCode}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(teacher.teacherCode!).catch(() => {})
                  setTeacherCodeCopied(true)
                  setTimeout(() => setTeacherCodeCopied(false), 2000)
                }}
                className="w-11 h-11 flex items-center justify-center rounded-2xl transition-all active:scale-90"
                style={{ background: teacherCodeCopied ? '#e0e7ff' : '#f1f5f9' }}
                title="Copy scanner code"
              >
                {teacherCodeCopied ? <Check size={17} className="text-indigo-600" /> : <Copy size={17} className="text-slate-500" />}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-2">
              Sign out and sign in again to generate your scanner code.
            </p>
          )}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Non-teaching staff open the EduScanner app and enter this code to scan answer sheets for <span className="font-semibold text-slate-500">all your classes</span>. Marks sync straight back to you.
          </p>
        </div>

        {/* Timetable */}
        <div className="bg-white rounded-3xl p-5 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
              <Clock size={16} className="text-blue-600" />
            </div>
            <p className="font-black text-slate-800">Weekly Timetable</p>
          </div>

          {/* Existing entries */}
          {timetableEntries.length > 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map(day => {
                const dayEntries = timetableEntries
                  .filter(e => e.dayOfWeek === day)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                if (dayEntries.length === 0) return null
                return (
                  <div key={day}>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{DAY_LABELS[day]}</p>
                    {dayEntries.map(entry => {
                      const cls = classes.find(c => c.id === entry.classId)
                      return (
                        <div key={entry.id} className="flex items-center gap-3 py-2 px-3 rounded-2xl bg-slate-50 mb-1">
                          <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black shrink-0">
                            {entry.periodNumber}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold shrink-0">
                            {entry.startTime}–{entry.endTime}
                          </span>
                          <span className="flex-1 text-sm font-bold text-slate-700 truncate">{cls?.name ?? '—'}</span>
                          <button
                            type="button"
                            onClick={() => removeTimetableEntry(entry.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-400 active:bg-red-50 active:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-2">No periods added yet.</p>
          )}

          {/* Add entry form */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Add Period</p>

            <div className="grid grid-cols-3 gap-2">
              {/* Day */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Day</label>
                <select
                  value={ttDay}
                  onChange={e => setTtDay(Number(e.target.value))}
                  className="w-full border-2 border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-400 bg-white"
                >
                  {[1, 2, 3, 4, 5, 6].map(d => (
                    <option key={d} value={d}>{DAY_LABELS[d]}</option>
                  ))}
                </select>
              </div>
              {/* Period # */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Period</label>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={ttPeriod}
                  onChange={e => setTtPeriod(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-400 bg-white"
                />
              </div>
              {/* Class */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Class</label>
                <select
                  value={ttClassId}
                  onChange={e => setTtClassId(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-400 bg-white"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Start</label>
                <input
                  type="time"
                  value={ttStart}
                  onChange={e => setTtStart(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-400 bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">End</label>
                <input
                  type="time"
                  value={ttEnd}
                  onChange={e => setTtEnd(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-400 bg-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddEntry}
              disabled={ttAdding || !ttClassId}
              className="w-full py-2.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}
            >
              <Plus size={15} />
              {ttAdding ? 'Adding…' : 'Add Period'}
            </button>
          </div>
        </div>

        {/* App Guide */}
        <div className="bg-white rounded-3xl p-5 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
              <HelpCircle size={16} className="text-blue-600" />
            </div>
            <p className="font-black text-slate-800">App Guide</p>
          </div>

          {/* Open app guide button — closes flow guide if open */}
          <button
            type="button"
            onClick={() => { setShowFlowGuide(false); setShowTour(true) }}
            className="w-full py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}
          >
            <HelpCircle size={15} />
            Open App Guide
          </button>

          {/* Open flow guide button — closes app guide if open */}
          <button
            type="button"
            onClick={() => { setShowTour(false); setShowFlowGuide(true) }}
            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
            style={{ background: '#f1f5f9', color: '#1d4ed8', border: '1.5px solid #dbeafe' }}
          >
            <span className="text-base leading-none">🔄</span>
            How EduTeach Works — Flow Guide
          </button>

          {/* Show / hide floating "?" button toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-bold text-slate-700">Show &quot;?&quot; button on Home</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Floating shortcut to reopen the guide anytime
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleGuideBtn(!showGuideBtn)}
              className="relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ml-3"
              style={{ background: showGuideBtn ? '#2563eb' : '#e2e8f0' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: showGuideBtn ? 'translateX(24px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 text-white"
          style={saved
            ? { background: 'linear-gradient(135deg, #059669 0%, #34d399 100%)', boxShadow: '0 4px 16px rgba(5,150,105,0.4)' }
            : { background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', boxShadow: '0 4px 16px rgba(79,70,229,0.4)' }
          }
        >
          {saved ? <><Check size={18} /> Saved!</> : saving ? 'Saving…' : <><Save size={18} /> Save Settings</>}
        </button>
      </div>

      {teacher && (
        <FeatureTour
          teacherId={teacher.id}
          open={showTour}
          onClose={() => setShowTour(false)}
        />
      )}

      <FlowGuide
        open={showFlowGuide}
        onClose={() => setShowFlowGuide(false)}
      />
    </div>
  )
}
