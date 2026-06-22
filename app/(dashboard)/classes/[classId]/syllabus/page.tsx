'use client'
import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, CheckCircle2, Circle, Trash2, BookOpen,
  Calendar, Users, Sparkles, ChevronDown, ChevronUp,
  RefreshCw, FileText, Image as ImageIcon, Upload,
  X, Check, AlertCircle, Loader2, CalendarDays,
} from 'lucide-react'
import { useApp } from '@/lib/context'
import { computePacing } from '@/lib/logic/pacing'
import clsx from 'clsx'

interface WeekPlan { week: number; topics: string[]; tip: string; activity: string }
interface ExtractedTopic { topic: string; description: string; weekNumber: number; subTopics?: string[] }

export default function ClassSyllabusPage() {
  const { classId } = useParams<{ classId: string }>()
  const {
    teacher, classes, getClassSyllabus, addSyllabusTopic, deleteSyllabusTopic,
    updateSyllabusTopicEstimate, getTopicSessions, getClassStudents, getClassAttendance,
    syllabusSubTopics, addSubTopic, deleteSubTopic, toggleSubTopicComplete,
    ensureClassSyllabus,
  } = useApp()

  // Backfill this section with any grade-level topics it's missing (e.g. a
  // section created after the syllabus was built). Runs once per class.
  useEffect(() => {
    void ensureClassSyllabus(classId)
  }, [classId, ensureClassSyllabus])

  const currentClass = classes.find(c => c.id === classId)
  const grade = currentClass?.grade ?? ''
  const gradeSectionCount = classes.filter(c => (c.grade ?? '') === grade).length

  // ── Sub-topic UI state ─────────────────────────────────
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)
  const [addingSubFor, setAddingSubFor]       = useState<string | null>(null)
  const [newSubName, setNewSubName]           = useState('')
  const [savingSub, setSavingSub]             = useState(false)

  // ── Add single topic ──────────────────────────────────
  const [newTopic, setNewTopic]   = useState('')
  const [week, setWeek]           = useState('')
  const [adding, setAdding]       = useState(false)
  const [showAdd, setShowAdd]     = useState(false)

  // ── AI Lesson Plan ─────────────────────────────────────
  const [planOpen, setPlanOpen]       = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [planWeeks, setPlanWeeks]     = useState<WeekPlan[]>([])
  const [planError, setPlanError]     = useState('')

  // ── Year Plan ──────────────────────────────────────────
  const [yearPlanOpen, setYearPlanOpen]     = useState(false)
  const [totalWeeks, setTotalWeeks]         = useState('40')
  const [sessionsPerWeek, setSessionsPerWeek] = useState('5')
  const [yearPlanLoading, setYearPlanLoading] = useState(false)
  const [yearPlanError, setYearPlanError]   = useState('')
  const [yearPlanResult, setYearPlanResult] = useState<Array<{ id: string; estimatedSessions: number; rationale: string }>>([])
  const [savingPlan, setSavingPlan]         = useState(false)
  const [planSaved, setPlanSaved]           = useState(false)

  // ── Import Syllabus ────────────────────────────────────
  const [importOpen, setImportOpen]   = useState(false)
  const [importMode, setImportMode]   = useState<'text' | 'image'>('text')
  const [importText, setImportText]   = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [extracting, setExtracting]   = useState(false)
  const [extractError, setExtractError] = useState('')
  const [extracted, setExtracted]     = useState<ExtractedTopic[]>([])
  const [saving, setSaving]           = useState(false)
  const imgInputRef = useRef<HTMLInputElement>(null)

  const topics   = getClassSyllabus(classId)
  const students = getClassStudents(classId)
  const completed = topics.filter(t => t.isCompleted).length
  const pct       = topics.length ? Math.round((completed / topics.length) * 100) : 0
  const pacing    = computePacing(teacher?.academicYearStart, topics)

  const interestCount: Record<string, number> = {}
  students.forEach(s => s.interests.forEach(i => { interestCount[i] = (interestCount[i] ?? 0) + 1 }))
  const topInterests = Object.entries(interestCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([i]) => i)

  // ── Single add ──────────────────────────────────────────
  const handleAdd = async () => {
    if (!newTopic.trim()) return
    setAdding(true)
    await addSyllabusTopic(classId, { topic: newTopic.trim(), weekNumber: week ? parseInt(week) : undefined })
    setNewTopic(''); setWeek(''); setAdding(false); setShowAdd(false)
  }

  // ── Year Plan ────────────────────────────────────────────
  const generateYearPlan = async () => {
    setYearPlanLoading(true); setYearPlanError(''); setYearPlanResult([]); setPlanSaved(false)
    try {
      const res = await fetch('/api/year-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: topics.map(t => ({ id: t.id, topic: t.topic, description: t.description })),
          totalWeeks: parseInt(totalWeeks) || 40,
          sessionsPerWeek: parseInt(sessionsPerWeek) || 5,
          subject: teacher?.subject ?? '',
          grade: teacher?.grade ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed')
      setYearPlanResult(data.plan ?? [])
    } catch { setYearPlanError('Could not generate plan. Please try again.') }
    finally { setYearPlanLoading(false) }
  }

  const saveYearPlan = async () => {
    setSavingPlan(true)
    for (const entry of yearPlanResult) {
      await updateSyllabusTopicEstimate(entry.id, entry.estimatedSessions)
    }
    setSavingPlan(false)
    setPlanSaved(true)
  }

  // ── Lesson plan ─────────────────────────────────────────
  const generatePlan = async () => {
    setPlanLoading(true); setPlanError('')
    try {
      const res = await fetch('/api/lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: topics.map(t => ({ topic: t.topic, description: t.description, weekNumber: t.weekNumber, isCompleted: t.isCompleted })),
          className: classId,
          subject: teacher?.subject ?? '',
          studentInterests: topInterests,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const { weeks } = await res.json()
      setPlanWeeks(weeks ?? [])
      if (!weeks?.length) setPlanError('No pending topics to plan.')
    } catch { setPlanError('Could not generate plan.') }
    finally { setPlanLoading(false) }
  }

  // ── Image select ─────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImagePreview(reader.result as string)
      setExtracted([])
      setExtractError('')
    }
    reader.readAsDataURL(file)
  }

  // ── Extract from AI ──────────────────────────────────────
  const handleExtract = async () => {
    if (importMode === 'text' && !importText.trim()) return
    if (importMode === 'image' && !imagePreview) return

    setExtracting(true); setExtractError(''); setExtracted([])
    try {
      const body = importMode === 'text'
        ? { text: importText }
        : { image: imagePreview }

      const res = await fetch('/api/extract-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Extraction failed')
      if (!data.topics?.length) throw new Error('No topics found in the input.')
      setExtracted(data.topics)
    } catch (e: unknown) {
      setExtractError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  // ── Save all extracted ────────────────────────────────────
  const handleSaveAll = async () => {
    if (!extracted.length) return
    setSaving(true)
    for (const t of extracted) {
      const topicId = await addSyllabusTopic(classId, {
        topic: t.topic,
        description: t.description,
        weekNumber: t.weekNumber,
      })
      if (t.subTopics?.length) {
        for (const subName of t.subTopics) {
          await addSubTopic(topicId, classId, { name: subName })
        }
      }
    }
    setExtracted([])
    setImportText('')
    setImagePreview(null)
    setImportOpen(false)
    setSaving(false)
  }

  const removeExtracted = (i: number) =>
    setExtracted(prev => prev.filter((_, idx) => idx !== i))

  const resetImport = () => {
    setExtracted([]); setImportText(''); setImagePreview(null); setExtractError('')
  }

  return (
    <div className="px-4 pt-4 pb-6">

      {/* ── Shared-across-grade note ──────────────────────── */}
      {gradeSectionCount > 1 && (
        <div className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3 bg-indigo-50 border border-indigo-100">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-indigo-100">
            <Users size={15} className="text-indigo-600" />
          </div>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            This syllabus is shared across all <span className="font-bold text-indigo-700">{gradeSectionCount} Grade {grade} sections</span>.
            Adding or removing topics updates every section. Ticking a topic complete only affects <span className="font-bold">this section</span>.
          </p>
        </div>
      )}

      {/* ── Progress card ─────────────────────────────────── */}
      {topics.length > 0 && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-bold text-slate-800">Syllabus Progress</span>
            <span className="text-sm font-black text-blue-700">{pct}% done</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div className="bg-blue-700 h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">{completed} of {topics.length} topics completed</p>
        </div>
      )}

      {/* ── Pacing indicator ───────────────────────────────── */}
      {pacing && pacing.status !== 'not-started' && (
        <div className={clsx(
          'rounded-2xl px-4 py-3 mb-4 flex items-start gap-3',
          pacing.status === 'behind'   && 'bg-red-50 border border-red-200',
          pacing.status === 'ahead'    && 'bg-emerald-50 border border-emerald-200',
          pacing.status === 'on-track' && 'bg-blue-50 border border-blue-100',
        )}>
          <div className={clsx(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
            pacing.status === 'behind'   && 'bg-red-100',
            pacing.status === 'ahead'    && 'bg-emerald-100',
            pacing.status === 'on-track' && 'bg-blue-100',
          )}>
            <CalendarDays size={15} className={clsx(
              pacing.status === 'behind'   && 'text-red-500',
              pacing.status === 'ahead'    && 'text-emerald-600',
              pacing.status === 'on-track' && 'text-blue-600',
            )} />
          </div>
          <div className="flex-1">
            <p className={clsx(
              'text-sm font-bold',
              pacing.status === 'behind'   && 'text-red-800',
              pacing.status === 'ahead'    && 'text-emerald-800',
              pacing.status === 'on-track' && 'text-blue-800',
            )}>
              Week {pacing.currentWeek} · {
                pacing.status === 'on-track' ? 'On track' :
                pacing.status === 'ahead'    ? `${pacing.weeksAhead} topic${pacing.weeksAhead !== 1 ? 's' : ''} ahead` :
                `${Math.abs(pacing.weeksAhead)} topic${Math.abs(pacing.weeksAhead) !== 1 ? 's' : ''} behind`
              }
            </p>
            <p className={clsx(
              'text-xs mt-0.5',
              pacing.status === 'behind'   && 'text-red-600',
              pacing.status === 'ahead'    && 'text-emerald-600',
              pacing.status === 'on-track' && 'text-blue-600',
            )}>
              {pacing.status === 'behind'
                ? `Should be on "${pacing.expectedTopicName}" by now`
                : pacing.status === 'ahead' && pacing.actualTopicName
                ? `Last completed: "${pacing.actualTopicName}"`
                : `On schedule — ${pacing.completedCount}/${pacing.totalCount} topics done`}
            </p>
          </div>
        </div>
      )}

      {/* ── AI Lesson Plan ──────────────────────────────────── */}
      {topics.length > 0 && (
        <button
          type="button"
          onClick={() => { setPlanOpen(p => !p); if (!planOpen && !planWeeks.length) generatePlan() }}
          className="w-full flex items-center justify-between gap-2 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 mb-4 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
              <Sparkles size={15} className="text-violet-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-violet-900">AI Lesson Plan</p>
              <p className="text-xs text-violet-500">4-week plan based on your syllabus</p>
            </div>
          </div>
          {planOpen ? <ChevronUp size={16} className="text-violet-400" /> : <ChevronDown size={16} className="text-violet-400" />}
        </button>
      )}

      {planOpen && (
        <div className="card mb-4 border-violet-100 bg-violet-50/30 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-violet-900">4-Week Plan</p>
            <button type="button" onClick={generatePlan} disabled={planLoading}
              className="flex items-center gap-1 text-xs text-violet-600 font-semibold px-2 py-1 rounded-lg hover:bg-violet-100 transition-colors">
              <RefreshCw size={12} className={planLoading ? 'animate-spin' : ''} /> Regenerate
            </button>
          </div>
          {planLoading && [1,2,3,4].map(i => <div key={i} className="h-16 bg-violet-100 rounded-2xl animate-pulse" />)}
          {!planLoading && planError && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{planError}</p>}
          {!planLoading && planWeeks.map(w => (
            <div key={w.week} className="bg-white rounded-2xl p-4 border border-violet-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-violet-600 text-white rounded-full text-xs font-black flex items-center justify-center shrink-0">{w.week}</span>
                <p className="font-bold text-slate-800 text-sm">{w.topics.join(', ')}</p>
              </div>
              <p className="text-xs text-violet-700 font-semibold mb-1">Teaching hook</p>
              <p className="text-sm text-slate-700 mb-2">{w.tip}</p>
              <p className="text-xs text-emerald-700 font-semibold mb-1">Activity</p>
              <p className="text-sm text-slate-600">{w.activity}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Plan Full Year ──────────────────────────────────── */}
      {topics.length > 0 && (
        <button
          type="button"
          onClick={() => setYearPlanOpen(p => !p)}
          className="w-full flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-3 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CalendarDays size={15} className="text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-emerald-900">Plan Full Academic Year</p>
              <p className="text-xs text-emerald-600">AI estimates how many sessions each topic needs</p>
            </div>
          </div>
          {yearPlanOpen ? <ChevronUp size={16} className="text-emerald-400" /> : <ChevronDown size={16} className="text-emerald-400" />}
        </button>
      )}

      {yearPlanOpen && topics.length > 0 && (
        <div className="card border-emerald-100 bg-emerald-50/20 mb-4 space-y-4">
          {/* Config row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Teaching weeks / year</label>
              <input
                type="number" min="10" max="52"
                value={totalWeeks}
                onChange={e => { setTotalWeeks(e.target.value); setYearPlanResult([]); setPlanSaved(false) }}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Sessions / week</label>
              <input
                type="number" min="1" max="7"
                value={sessionsPerWeek}
                onChange={e => { setSessionsPerWeek(e.target.value); setYearPlanResult([]); setPlanSaved(false) }}
                className="input-field text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 -mt-2">
            Total: ~{(parseInt(totalWeeks) || 40) * (parseInt(sessionsPerWeek) || 5)} sessions across {topics.length} topics
          </p>

          <button
            type="button"
            onClick={generateYearPlan}
            disabled={yearPlanLoading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {yearPlanLoading
              ? <><Loader2 size={15} className="animate-spin" /> Generating plan…</>
              : <><Sparkles size={15} /> Generate Year Plan</>}
          </button>

          {yearPlanError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{yearPlanError}</p>
            </div>
          )}

          {yearPlanResult.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Estimated sessions per topic</p>
              {yearPlanResult.map(entry => {
                const topic = topics.find(t => t.id === entry.id)
                if (!topic) return null
                return (
                  <div key={entry.id} className="bg-white rounded-2xl px-3.5 py-3 border border-emerald-100 flex items-start gap-3">
                    <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-sm font-black text-emerald-700">{entry.estimatedSessions}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 leading-tight">{topic.topic}</p>
                      {entry.rationale && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{entry.rationale}</p>}
                    </div>
                  </div>
                )
              })}

              {planSaved ? (
                <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <Check size={15} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700">Plan saved — visible on each topic</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={saveYearPlan}
                  disabled={savingPlan}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
                >
                  {savingPlan
                    ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                    : <><Check size={15} /> Save Plan to Syllabus</>}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Import Syllabus (AI) ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setImportOpen(p => !p); if (importOpen) resetImport() }}
        className="w-full flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-3 active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
            <Sparkles size={15} className="text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-blue-900">Import Syllabus via AI</p>
            <p className="text-xs text-blue-500">Paste text or upload image · AI extracts all topics</p>
          </div>
        </div>
        {importOpen ? <ChevronUp size={16} className="text-blue-400" /> : <ChevronDown size={16} className="text-blue-400" />}
      </button>

      {importOpen && (
        <div className="card border-blue-100 bg-blue-50/20 mb-4 space-y-4">

          {/* Mode tabs */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setImportMode('text'); resetImport() }}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
                importMode === 'text'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200',
              )}
            >
              <FileText size={14} /> Paste Text
            </button>
            <button
              type="button"
              onClick={() => { setImportMode('image'); resetImport() }}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
                importMode === 'image'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200',
              )}
            >
              <ImageIcon size={14} /> Upload Image
            </button>
          </div>

          {/* ── TEXT MODE ── */}
          {importMode === 'text' && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">
                  Paste your syllabus — any format works (table, list, plain text)
                </p>
                <textarea
                  value={importText}
                  onChange={e => { setImportText(e.target.value); setExtracted([]); setExtractError('') }}
                  placeholder={`Unit\tTopics\nNumbers\tLarge numbers, place value, comparison\nArithmetic\tAddition, subtraction, multiplication\nFractions\tProper fractions, equivalent fractions...`}
                  rows={7}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white resize-none font-mono text-slate-700 placeholder:text-slate-300 placeholder:font-sans"
                />
              </div>
              <button
                type="button"
                onClick={handleExtract}
                disabled={!importText.trim() || extracting}
                className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {extracting ? <><Loader2 size={15} className="animate-spin" /> Analysing...</> : <><Sparkles size={15} /> Extract Topics with AI</>}
              </button>
            </div>
          )}

          {/* ── IMAGE MODE ── */}
          {importMode === 'image' && (
            <div className="space-y-3">
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Syllabus"
                    className="w-full rounded-2xl border border-slate-200 object-contain max-h-64"
                  />
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); setExtracted([]); setExtractError('') }}
                    className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow-sm flex items-center justify-center border border-slate-200"
                  >
                    <X size={13} className="text-slate-600" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-blue-300 bg-white text-blue-600 active:bg-blue-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <Upload size={22} className="text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm">Tap to upload syllabus photo</p>
                    <p className="text-xs text-slate-400 mt-0.5">JPG, PNG — textbook page, printed sheet, handwritten</p>
                  </div>
                </button>
              )}

              {imagePreview && (
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={extracting}
                  className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  {extracting ? <><Loader2 size={15} className="animate-spin" /> Extracting...</> : <><Sparkles size={15} /> Extract Topics from Image</>}
                </button>
              )}
            </div>
          )}

          {/* ── Error ── */}
          {extractError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={15} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{extractError}</p>
            </div>
          )}

          {/* ── Preview extracted topics ── */}
          {extracted.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">
                  {extracted.length} topics extracted · review before saving
                </p>
                <button type="button" onClick={() => setExtracted([])} className="text-xs text-slate-400 hover:text-slate-600">
                  Clear
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {extracted.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2.5">
                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-lg text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                      {t.weekNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-tight">{t.topic}</p>
                      {t.description && (
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed italic">{t.description}</p>
                      )}
                      {t.subTopics && t.subTopics.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {t.subTopics.map((sub, si) => (
                            <li key={si} className="text-xs text-slate-600 flex items-start gap-1.5">
                              <span className="text-blue-400 shrink-0 mt-0.5">·</span>
                              <span>{sub}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExtracted(i)}
                      className="text-slate-300 hover:text-red-400 transition-colors shrink-0 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
              >
                {saving
                  ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
                  : <><Check size={15} /> Save {extracted.length} Topics{extracted.some(t => t.subTopics?.length) ? ' + Sub-topics' : ''} to Syllabus</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Manual add ──────────────────────────────────────── */}
      {showAdd ? (
        <div className="card border-2 border-slate-200 mb-4 space-y-3">
          <input
            type="text"
            value={newTopic}
            onChange={e => setNewTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Topic name (e.g. Fractions)"
            className="input-field"
            autoFocus
          />
          <input
            type="number"
            value={week}
            onChange={e => setWeek(e.target.value)}
            placeholder="Week number (optional)"
            className="input-field"
            min="1"
          />
          <div className="flex gap-2.5">
            <button type="button"
              onClick={() => { setShowAdd(false); setNewTopic(''); setWeek('') }}
              className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-semibold text-sm active:scale-95 transition-transform">
              Cancel
            </button>
            <button type="button" onClick={handleAdd} disabled={!newTopic.trim() || adding} className="flex-1 btn-primary text-sm">
              {adding ? 'Adding…' : 'Add Topic'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-3xl border-2 border-dashed border-slate-300 text-slate-500 font-semibold text-sm mb-4 active:scale-[0.98] transition-transform"
        >
          <Plus size={17} strokeWidth={2.5} /> Add Single Topic Manually
        </button>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {topics.length === 0 && !showAdd && !importOpen && (
        <div className="text-center py-14 card">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen size={22} className="text-blue-500" />
          </div>
          <p className="font-semibold text-slate-700">No syllabus yet</p>
          <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
            Use <strong>Import via AI</strong> to add your full year at once, or add topics one by one.
          </p>
        </div>
      )}

      {/* ── Topic list ──────────────────────────────────────── */}
      <div className="space-y-2">
        {topics.map((topic) => {
          const topicSessions  = getTopicSessions(topic.id)
          const sessionCount   = topicSessions.length
          const latestDate     = topicSessions[0]?.date
          const subTopics      = syllabusSubTopics.filter(s => s.topicId === topic.id)
            .sort((a, b) => a.orderIndex - b.orderIndex)
          const doneSubTopics  = subTopics.filter(s => s.isCompleted).length
          const isExpanded     = expandedTopicId === topic.id
          const isAddingHere   = addingSubFor === topic.id

          let attendancePct: number | null = null
          if (sessionCount > 0 && students.length > 0) {
            const sessionIds = new Set(topicSessions.map(s => s.id))
            const allAtt = getClassAttendance(classId).filter(a => sessionIds.has(a.sessionId))
            const present = allAtt.filter(a => a.status !== 'absent').length
            const total   = allAtt.length
            attendancePct = total > 0 ? Math.round((present / total) * 100) : null
          }

          return (
            <div
              key={topic.id}
              className={clsx(
                'card transition-colors',
                topic.isCompleted ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100',
              )}
            >
              {/* ── Topic header row ── */}
              <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div className="shrink-0 mt-0.5">
                  {subTopics.length > 0 ? (
                    topic.isCompleted ? (
                      <CheckCircle2 size={22} className="text-emerald-500" />
                    ) : doneSubTopics > 0 ? (
                      <div className="w-[22px] h-[22px] rounded-full bg-violet-100 border-2 border-violet-400 flex items-center justify-center">
                        <span className="text-[8px] font-black text-violet-600 leading-none">{doneSubTopics}/{subTopics.length}</span>
                      </div>
                    ) : (
                      <Circle size={22} className="text-slate-200" />
                    )
                  ) : (
                    topic.isCompleted ? (
                      <CheckCircle2 size={22} className="text-emerald-500" />
                    ) : sessionCount > 0 ? (
                      <div className="w-[22px] h-[22px] rounded-full bg-violet-100 border-2 border-violet-400 flex items-center justify-center">
                        <span className="text-[9px] font-black text-violet-600">{sessionCount}</span>
                      </div>
                    ) : (
                      <Circle size={22} className="text-slate-200" />
                    )
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={clsx('font-semibold text-sm', topic.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900')}>
                    {topic.topic}
                  </p>
                  {topic.description && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{topic.description}</p>
                  )}
                  {topic.weekNumber != null && (
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">Week {topic.weekNumber}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {subTopics.length > 0 ? (
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-semibold',
                        topic.isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700',
                      )}>
                        {doneSubTopics}/{subTopics.length} sub-topics done
                      </span>
                    ) : sessionCount > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full font-semibold">
                        <Calendar size={10} />
                        {sessionCount} session{sessionCount !== 1 ? 's' : ''}
                        {latestDate && ` · ${new Date(latestDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                      </span>
                    ) : topic.estimatedSessions ? (
                      <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full font-semibold">
                        <Calendar size={10} /> ~{topic.estimatedSessions} sessions planned
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No sub-topics yet</span>
                    )}
                    {attendancePct !== null && (
                      <span className={clsx(
                        'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold',
                        attendancePct >= 75 ? 'bg-emerald-50 text-emerald-700'
                          : attendancePct >= 50 ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700',
                      )}>
                        <Users size={10} /> {attendancePct}% attendance
                      </span>
                    )}
                  </div>
                </div>

                {/* Expand sub-topics */}
                <button type="button"
                  onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                  className="p-2 text-slate-400 hover:text-violet-600 transition-colors rounded-xl shrink-0">
                  {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                <button type="button"
                  onClick={() => deleteSyllabusTopic(topic.id)}
                  className="p-2 text-slate-300 hover:text-red-400 transition-colors rounded-xl shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>

              {/* ── Sub-topics panel (expanded) ── */}
              {isExpanded && (
                <div className="mt-3 ml-8 space-y-1.5">
                  {subTopics.length === 0 && !isAddingHere && (
                    <p className="text-xs text-slate-400 italic py-1">
                      No sub-topics yet. Add the specific parts/sections of this topic below.
                    </p>
                  )}

                  {subTopics.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleSubTopicComplete(sub.id, !sub.isCompleted)}
                        className="shrink-0"
                      >
                        {sub.isCompleted
                          ? <CheckCircle2 size={17} className="text-emerald-500" />
                          : <Circle size={17} className="text-slate-300" />}
                      </button>
                      <span className={clsx(
                        'flex-1 text-sm font-medium',
                        sub.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700',
                      )}>
                        {sub.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteSubTopic(sub.id)}
                        className="p-1 text-slate-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}

                  {/* Add sub-topic inline form */}
                  {isAddingHere ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        autoFocus
                        type="text"
                        value={newSubName}
                        onChange={e => setNewSubName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newSubName.trim()) {
                            setSavingSub(true)
                            addSubTopic(topic.id, classId, { name: newSubName.trim() })
                              .then(() => { setNewSubName(''); setAddingSubFor(null); setSavingSub(false) })
                          }
                          if (e.key === 'Escape') { setAddingSubFor(null); setNewSubName('') }
                        }}
                        placeholder="Sub-topic name (e.g. Natural Numbers)"
                        className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                      />
                      <button
                        type="button"
                        disabled={!newSubName.trim() || savingSub}
                        onClick={() => {
                          setSavingSub(true)
                          addSubTopic(topic.id, classId, { name: newSubName.trim() })
                            .then(() => { setNewSubName(''); setAddingSubFor(null); setSavingSub(false) })
                        }}
                        className="px-3 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
                      >
                        {savingSub ? '…' : 'Add'}
                      </button>
                      <button type="button" onClick={() => { setAddingSubFor(null); setNewSubName('') }}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingSubFor(topic.id)}
                      className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold py-1.5 px-2 rounded-xl hover:bg-violet-50 transition-colors active:scale-95"
                    >
                      <Plus size={13} strokeWidth={2.5} /> Add sub-topic
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
