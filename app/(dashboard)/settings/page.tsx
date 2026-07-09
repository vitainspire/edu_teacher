'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, BookOpen, Clock, Trash2, HelpCircle, Copy, RefreshCw, CalendarDays, ChevronRight } from 'lucide-react'
import { useApp } from '@/lib/context'
import FeatureTour from '@/components/onboarding/FeatureTour'
import FlowGuide from '@/components/onboarding/FlowGuide'
import PageHeader from '@/components/theme/PageHeader'
import { Sticker } from '@/components/theme/StickerIcon'

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function SettingsPage() {
  const { teacher, classes, timetableEntries, removeTimetableEntry } = useApp()
  const router = useRouter()

  const [teacherCodeCopied, setTeacherCodeCopied] = useState(false)
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

  return (
    <div className="paper-page pb-28 md:pb-8">
      <PageHeader title="Settings" />

      <div className="px-5 pt-2 space-y-4 relative z-10">

        {/* Teacher Info (read-only) */}
        <div className="paper-card p-5 space-y-3">
          <p className="font-bold text-ink mb-1">Profile</p>
          {[
            { label: 'Name',    value: teacher?.name },
            { label: 'School',  value: teacher?.schoolName },
            { label: 'Subject', value: teacher?.subject },
            { label: 'Grade',   value: teacher?.grade },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className="flex items-center justify-between py-2"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(58,44,30,0.08)' : 'none' }}
            >
              <span className="text-xs font-bold text-ink-soft uppercase tracking-wide">{row.label}</span>
              <span className="text-sm font-semibold text-ink">{row.value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Scanner Teacher Code */}
        <div className="paper-card p-5 space-y-3">
          <div className="flex items-center gap-2.5 mb-1">
            <Sticker tone="coral" size={36} radius={14}>
              <BookOpen size={16} className="text-ink-soft" />
            </Sticker>
            <div>
              <p className="font-bold text-ink leading-none">Scanner Code</p>
              <p className="text-[11px] text-ink-soft mt-0.5">Give this to whoever scans your papers</p>
            </div>
          </div>
          {teacher?.teacherCode ? (
            <div className="flex items-center gap-3">
              <div
                className="flex-1 rounded-2xl py-3.5 text-center font-black text-2xl"
                style={{ background: 'rgba(58,44,30,0.06)', border: '2px dashed rgba(58,44,30,0.25)', letterSpacing: '0.4em', color: 'var(--ink)' }}
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
                style={{ background: 'rgba(58,44,30,0.06)' }}
                title="Copy scanner code"
              >
                {teacherCodeCopied ? <Check size={17} className="text-ink" /> : <Copy size={17} className="text-ink-soft" />}
              </button>
            </div>
          ) : (
            <p className="text-xs text-ink-soft text-center py-2">
              Sign out and sign in again to generate your scanner code.
            </p>
          )}
          <p className="text-[11px] text-ink-soft leading-relaxed">
            Non-teaching staff open the EduScanner app and enter this code to scan answer sheets for <span className="font-semibold text-ink">all your classes</span>. Marks sync straight back to you.
          </p>
        </div>

        {/* Academic Calendar */}
        <button
          type="button"
          onClick={() => router.push('/academic-calendar')}
          className="paper-card p-5 w-full flex items-center gap-3 text-left"
        >
          <Sticker tone="blue" size={36} radius={14}>
            <CalendarDays size={16} className="text-ink-soft" />
          </Sticker>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-ink leading-none">Academic Calendar</p>
            <p className="text-[11px] text-ink-soft mt-1">Holidays, exams, and term dates published by your school</p>
          </div>
          <ChevronRight size={16} className="text-ink-faint shrink-0" />
        </button>

        {/* Timetable */}
        <div className="paper-card p-5 space-y-4">
          <div className="flex items-center gap-2.5 mb-1">
            <Sticker tone="blue" size={36} radius={14}>
              <Clock size={16} className="text-ink-soft" />
            </Sticker>
            <p className="font-bold text-ink">Weekly Timetable</p>
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
                    <p className="text-xs font-bold text-ink-soft uppercase tracking-wide mb-1">{DAY_LABELS[day]}</p>
                    {dayEntries.map(entry => {
                      const cls = classes.find(c => c.id === entry.classId)
                      return (
                        <div key={entry.id} className="flex items-center gap-3 py-2 px-3 rounded-2xl mb-1" style={{ background: 'rgba(58,44,30,0.04)' }}>
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0" style={{ background: 'rgba(58,44,30,0.1)', color: 'var(--ink)' }}>
                            {entry.periodNumber}
                          </span>
                          <span className="text-xs text-ink-soft font-semibold shrink-0">
                            {entry.startTime}–{entry.endTime}
                          </span>
                          <span className="flex-1 text-sm font-bold text-ink truncate">{cls?.name ?? '—'}</span>
                          <button
                            type="button"
                            onClick={() => removeTimetableEntry(entry.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-xl text-ink-faint active:bg-red-50 active:text-red-500 transition-colors shrink-0"
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
            <p className="text-xs text-ink-soft text-center py-2">
              No timetable set. Your school admin manages the timetable.
            </p>
          )}
        </div>

        {/* App Guide */}
        <div className="paper-card p-5 space-y-4">
          <div className="flex items-center gap-2.5 mb-1">
            <Sticker tone="gold" size={36} radius={14}>
              <HelpCircle size={16} className="text-ink-soft" />
            </Sticker>
            <p className="font-bold text-ink">App Guide</p>
          </div>

          {/* Open app guide button — closes flow guide if open */}
          <button
            type="button"
            onClick={() => { setShowFlowGuide(false); setShowTour(true) }}
            className="paper-btn-primary w-full"
          >
            <HelpCircle size={15} />
            Open App Guide
          </button>

          {/* Open flow guide button — closes app guide if open */}
          <button
            type="button"
            onClick={() => { setShowTour(false); setShowFlowGuide(true) }}
            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-ink"
            style={{ background: 'rgba(58,44,30,0.06)' }}
          >
            <RefreshCw size={15} />
            How EduTeach Works — Flow Guide
          </button>

          {/* Show / hide floating "?" button toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-bold text-ink">Show &quot;?&quot; button on Home</p>
              <p className="text-xs text-ink-soft mt-0.5">
                Floating shortcut to reopen the guide anytime
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleGuideBtn(!showGuideBtn)}
              className="relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ml-3"
              style={{ background: showGuideBtn ? 'var(--ink)' : 'rgba(58,44,30,0.15)' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: showGuideBtn ? 'translateX(24px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

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
