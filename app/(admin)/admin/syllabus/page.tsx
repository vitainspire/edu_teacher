'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAdmin } from '@/lib/admin-context'
import {
  BookOpen, Sparkles, Loader2, Plus, X, Trash2, ChevronDown, ChevronUp,
  FileText, Image as ImageIcon, Upload, AlertCircle, Check, AlertTriangle, Clock, List,
} from 'lucide-react'
import PageHeader from '@/components/theme/PageHeader'
import clsx from 'clsx'

interface Topic {
  id: string
  definitionId: string
  subject: string
  topic: string
  description: string
  weekNumber?: number
  orderIndex: number
  estimatedSessions?: number
  wasLegacy?: boolean
}
interface SubTopic {
  id: string
  definitionId: string
  name: string
  description: string
  orderIndex: number
  estimatedSessions?: number
}
interface ExtractedTopic { topic: string; description: string; weekNumber: number; subTopics?: string[] }
interface GradeSubjectRow { subject: string }

export default function AdminSyllabusPage() {
  const { school } = useAdmin()

  const [classGrades, setClassGrades] = useState<string[]>([])
  const [grade, setGrade] = useState('')
  const [gradeSubjects, setGradeSubjects] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [customSubject, setCustomSubject] = useState('')

  const [topics, setTopics] = useState<Topic[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [availableSessions, setAvailableSessions] = useState<number | null>(null)
  const [academicYearEnd, setAcademicYearEnd] = useState<string | null>(null)
  const [availabilityError, setAvailabilityError] = useState('')
  const [matchedPeriodsPerWeek, setMatchedPeriodsPerWeek] = useState<number | null>(null)
  const [otherTimetableLabels, setOtherTimetableLabels] = useState<string[]>([])

  // Sub-topics, keyed by parent topic's definitionId
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)
  const [subtopicsByTopic, setSubtopicsByTopic] = useState<Record<string, SubTopic[]>>({})
  const [loadingSubtopics, setLoadingSubtopics] = useState<string | null>(null)
  const [newSubtopicName, setNewSubtopicName] = useState('')
  const [addingSubtopic, setAddingSubtopic] = useState(false)
  const [estimatingSubtopics, setEstimatingSubtopics] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<'text' | 'image'>('text')
  const [importText, setImportText] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [extracted, setExtracted] = useState<ExtractedTopic[]>([])
  const [saving, setSaving] = useState(false)

  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState('')

  const [newTopic, setNewTopic] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)

  const activeSubject = subject === '__other__' ? customSubject.trim() : subject

  // ── Load grades that actually have classes ──────────────────────────────
  useEffect(() => {
    if (!school) return
    fetch(`/api/admin/schools/${school.id}/classes`)
      .then(r => r.json())
      .then(d => {
        const grades = [...new Set((d.classes ?? []).map((c: { grade: string }) => c.grade))].sort() as string[]
        setClassGrades(grades)
      })
  }, [school])

  // ── Load subjects configured for the selected grade ─────────────────────
  useEffect(() => {
    if (!school || !grade) { setGradeSubjects([]); return }
    fetch(`/api/admin/schools/${school.id}/grade-subjects?grade=${encodeURIComponent(grade)}`)
      .then(r => r.json())
      .then(d => setGradeSubjects([...new Set((d.subjects ?? []).map((s: GradeSubjectRow) => s.subject))] as string[]))
  }, [school, grade])

  const loadTopics = useCallback(() => {
    if (!school || !grade || !activeSubject) { setTopics([]); return }
    setLoadingTopics(true)
    fetch(`/api/admin/schools/${school.id}/syllabus?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(activeSubject)}`)
      .then(r => r.json())
      .then(d => setTopics(d.topics ?? []))
      .finally(() => setLoadingTopics(false))
  }, [school, grade, activeSubject])

  useEffect(() => { loadTopics() }, [loadTopics])

  useEffect(() => {
    if (!school || !grade || !activeSubject) { setAvailableSessions(null); return }
    setAvailabilityError('')
    fetch(`/api/admin/schools/${school.id}/syllabus/availability?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(activeSubject)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setAvailabilityError(d.error)
        setAvailableSessions(d.availableSessions ?? null)
        setAcademicYearEnd(d.academicYearEnd ?? null)
        setMatchedPeriodsPerWeek(d.matchedPeriodsPerWeek ?? null)
        setOtherTimetableLabels(d.otherTimetableLabels ?? [])
      })
  }, [school, grade, activeSubject])

  const totalEstimated = topics.reduce((sum, t) => sum + (t.estimatedSessions ?? 0), 0)
  const overBudget = availableSessions != null && totalEstimated > availableSessions

  // ── Import via AI ───────────────────────────────────────────────────────
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setImagePreview(reader.result as string); setExtracted([]); setExtractError('') }
    reader.readAsDataURL(file)
  }

  async function handleExtract() {
    if (importMode === 'text' && !importText.trim()) return
    if (importMode === 'image' && !imagePreview) return
    setExtracting(true); setExtractError(''); setExtracted([])
    try {
      const body = importMode === 'text' ? { text: importText } : { image: imagePreview }
      const res = await fetch('/api/extract-syllabus', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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

  async function saveExtracted() {
    if (!school || !grade || !activeSubject || extracted.length === 0) return
    setSaving(true)
    for (const t of extracted) {
      const res = await fetch(`/api/admin/schools/${school.id}/syllabus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, subject: activeSubject, topic: t.topic, description: t.description, weekNumber: t.weekNumber }),
      })
      const data = await res.json().catch(() => null)
      if (data?.definitionId && t.subTopics?.length) {
        for (const name of t.subTopics) {
          await fetch(`/api/admin/schools/${school.id}/syllabus/subtopics`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topicDefinitionId: data.definitionId, name }),
          })
        }
      }
    }
    setExtracted([]); setImportText(''); setImagePreview(null); setImportOpen(false)
    setSaving(false)
    loadTopics()
  }

  async function addTopicManually() {
    if (!school || !grade || !activeSubject || !newTopic.trim()) return
    setAddingTopic(true)
    await fetch(`/api/admin/schools/${school.id}/syllabus`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade, subject: activeSubject, topic: newTopic.trim() }),
    })
    setNewTopic(''); setAddingTopic(false)
    loadTopics()
  }

  async function deleteTopic(definitionId: string) {
    if (!school || !confirm('Remove this topic for every section of this grade?')) return
    setTopics(prev => prev.filter(t => t.definitionId !== definitionId))
    await fetch(`/api/admin/schools/${school!.id}/syllabus`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definitionId }),
    })
  }

  async function updateEstimate(definitionId: string, estimatedSessions: number) {
    setTopics(prev => prev.map(t => t.definitionId === definitionId ? { ...t, estimatedSessions } : t))
    if (!school) return
    await fetch(`/api/admin/schools/${school.id}/syllabus`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definitionId, estimatedSessions }),
    })
  }

  // ── AI session estimate, grounded in real availability ──────────────────
  async function generateEstimates() {
    if (!school || topics.length === 0) return
    setEstimating(true); setEstimateError('')
    try {
      const today = new Date()
      const yearEnd = academicYearEnd ? new Date(academicYearEnd + 'T00:00:00') : null
      const weeksRemaining = yearEnd ? Math.max(1, Math.round((yearEnd.getTime() - today.getTime()) / (7 * 86_400_000))) : 20
      const sessionsPerWeek = availableSessions != null ? Math.max(1, Math.round(availableSessions / weeksRemaining)) : 4

      const res = await fetch('/api/year-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: topics.map(t => ({ id: t.id, topic: t.topic, description: t.description })),
          totalWeeks: weeksRemaining, sessionsPerWeek, subject: activeSubject, grade,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to generate estimate')

      for (const entry of data.plan ?? []) {
        const t = topics.find(t => t.id === entry.id)
        if (t) await updateEstimate(t.definitionId, entry.estimatedSessions)
      }
    } catch (e: unknown) {
      setEstimateError(e instanceof Error ? e.message : 'Failed to generate estimate')
    } finally {
      setEstimating(false)
    }
  }

  // ── Sub-topics ───────────────────────────────────────────────────────────
  async function loadSubtopics(topicDefinitionId: string) {
    if (!school) return
    setLoadingSubtopics(topicDefinitionId)
    const res = await fetch(`/api/admin/schools/${school.id}/syllabus/subtopics?topicDefinitionId=${encodeURIComponent(topicDefinitionId)}`)
    const data = await res.json().catch(() => ({}))
    setSubtopicsByTopic(prev => ({ ...prev, [topicDefinitionId]: data.subtopics ?? [] }))
    setLoadingSubtopics(null)
  }

  function toggleExpand(topicDefinitionId: string) {
    if (expandedTopicId === topicDefinitionId) { setExpandedTopicId(null); return }
    setExpandedTopicId(topicDefinitionId)
    if (!subtopicsByTopic[topicDefinitionId]) loadSubtopics(topicDefinitionId)
  }

  async function addSubtopic(topicDefinitionId: string) {
    if (!school || !newSubtopicName.trim()) return
    setAddingSubtopic(true)
    await fetch(`/api/admin/schools/${school.id}/syllabus/subtopics`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicDefinitionId, name: newSubtopicName.trim() }),
    })
    setNewSubtopicName(''); setAddingSubtopic(false)
    loadSubtopics(topicDefinitionId)
  }

  async function deleteSubtopic(topicDefinitionId: string, definitionId: string) {
    if (!school) return
    setSubtopicsByTopic(prev => ({ ...prev, [topicDefinitionId]: (prev[topicDefinitionId] ?? []).filter(s => s.definitionId !== definitionId) }))
    await fetch(`/api/admin/schools/${school.id}/syllabus/subtopics`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definitionId }),
    })
  }

  async function updateSubtopicEstimate(topicDefinitionId: string, definitionId: string, estimatedSessions: number) {
    setSubtopicsByTopic(prev => ({
      ...prev,
      [topicDefinitionId]: (prev[topicDefinitionId] ?? []).map(s => s.definitionId === definitionId ? { ...s, estimatedSessions } : s),
    }))
    if (!school) return
    await fetch(`/api/admin/schools/${school.id}/syllabus/subtopics`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definitionId, estimatedSessions }),
    })
  }

  // Splits the PARENT topic's own estimate across its sub-topics — reuses
  // /api/year-plan by forcing its total (totalWeeks × sessionsPerWeek) to
  // equal exactly the parent's estimate, so no new AI endpoint is needed.
  async function generateSubtopicEstimates(topic: Topic) {
    if (!school || !topic.estimatedSessions) return
    const subtopics = subtopicsByTopic[topic.definitionId] ?? []
    if (subtopics.length === 0) return
    setEstimatingSubtopics(topic.definitionId)
    try {
      const res = await fetch('/api/year-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: subtopics.map(s => ({ id: s.id, topic: s.name, description: s.description })),
          totalWeeks: 1, sessionsPerWeek: topic.estimatedSessions, subject: activeSubject, grade,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      for (const entry of data.plan ?? []) {
        const s = subtopics.find(s => s.id === entry.id)
        if (s) await updateSubtopicEstimate(topic.definitionId, s.definitionId, entry.estimatedSessions)
      }
    } catch { /* best-effort — subtopic estimates stay editable manually either way */ }
    finally { setEstimatingSubtopics(null) }
  }

  return (
    <div className="paper-page pb-16">
      <PageHeader title="Syllabus" subtitle="Set up each grade's syllabus once — every teacher of that subject just follows it" />

      <div className="px-5 pt-2 max-w-3xl mx-auto space-y-5 relative z-10">

        {/* ── Grade + subject picker ── */}
        <div className="paper-card p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Grade</label>
            <select value={grade} onChange={e => { setGrade(e.target.value); setSubject(''); setCustomSubject('') }} className="input-field">
              <option value="">Select grade…</option>
              {classGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)} disabled={!grade} className="input-field disabled:opacity-50">
              <option value="">Select subject…</option>
              {gradeSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__other__">Other (custom)…</option>
            </select>
            {subject === '__other__' && (
              <input value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="Subject name"
                className="input-field mt-2" />
            )}
          </div>
        </div>

        {!grade || !activeSubject ? (
          <div className="paper-card p-8 text-center">
            <BookOpen className="w-8 h-8 text-ink-faint mx-auto mb-3" />
            <p className="text-sm text-ink-soft">Pick a grade and subject to manage its syllabus.</p>
          </div>
        ) : (
          <>
            {/* ── Real availability vs estimated total ── */}
            <div className={clsx('paper-card p-5', overBudget ? 'border-2' : '')} style={overBudget ? { borderColor: '#f59e0b' } : undefined}>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-ink-soft" />
                <h2 className="font-display font-bold text-ink">Real Session Availability</h2>
              </div>
              {availabilityError ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">{availabilityError}</p>
              ) : availableSessions == null ? (
                <p className="text-xs text-ink-soft">Loading…</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl px-4 py-3 text-center" style={{ background: 'rgba(58,44,30,0.04)' }}>
                    <p className="text-2xl font-black text-ink">{availableSessions}</p>
                    <p className="text-[11px] text-ink-soft font-semibold mt-1">Real sessions left this year</p>
                  </div>
                  <div className="rounded-2xl px-4 py-3 text-center" style={{ background: overBudget ? '#fffbeb' : 'rgba(58,44,30,0.04)' }}>
                    <p className={clsx('text-2xl font-black', overBudget ? 'text-amber-700' : 'text-ink')}>{totalEstimated}</p>
                    <p className="text-[11px] text-ink-soft font-semibold mt-1">Estimated across topics</p>
                  </div>
                </div>
              )}
              {overBudget && (
                <div className="flex items-start gap-2 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">The estimated sessions add up to more than what's actually available this year — adjust individual topic estimates below.</p>
                </div>
              )}
              {availableSessions === 0 && matchedPeriodsPerWeek === 0 && (
                <div className="flex items-start gap-2 mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-red-800 font-semibold">No timetable periods found labeled exactly &quot;{activeSubject}&quot;.</p>
                    <p className="text-xs text-red-700 mt-1">
                      {otherTimetableLabels.length > 0
                        ? <>This grade&apos;s timetable uses: {otherTimetableLabels.map(l => `"${l}"`).join(', ')} — make sure the subject name matches exactly.</>
                        : 'This grade has no timetable set up yet, or periods have no label set.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Import via AI ── */}
            <button type="button" onClick={() => setImportOpen(p => !p)}
              className="w-full flex items-center justify-between gap-2 bg-[#DCEBF8] border border-[#AACDEA] rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#AACDEA]/60 rounded-xl flex items-center justify-center"><Sparkles className="w-4 h-4 text-[#1E3A55]" /></div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#1E3A55]">Import Syllabus via AI</p>
                  <p className="text-xs text-[#5B87AD]">Paste text or upload a textbook photo</p>
                </div>
              </div>
              {importOpen ? <ChevronUp className="w-4 h-4 text-[#5B87AD]" /> : <ChevronDown className="w-4 h-4 text-[#5B87AD]" />}
            </button>

            {importOpen && (
              <div className="rounded-3xl p-4 border border-[#AACDEA] bg-[#DCEBF8]/20 space-y-4">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setImportMode('text')}
                    className={clsx('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold', importMode === 'text' ? 'text-white' : 'bg-white text-ink-soft border border-black/10')}
                    style={importMode === 'text' ? { background: 'var(--ink)' } : undefined}>
                    <FileText className="w-3.5 h-3.5" /> Paste Text
                  </button>
                  <button type="button" onClick={() => setImportMode('image')}
                    className={clsx('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold', importMode === 'image' ? 'text-white' : 'bg-white text-ink-soft border border-black/10')}
                    style={importMode === 'image' ? { background: 'var(--ink)' } : undefined}>
                    <ImageIcon className="w-3.5 h-3.5" /> Upload Photo
                  </button>
                </div>

                {importMode === 'text' ? (
                  <textarea value={importText} onChange={e => { setImportText(e.target.value); setExtracted([]); setExtractError('') }}
                    placeholder={"Unit\tTopics\nNumbers\tLarge numbers, place value\nFractions\tProper fractions, equivalent fractions..."}
                    rows={7} className="w-full border border-black/10 rounded-2xl px-4 py-3 text-sm bg-white resize-none font-mono text-ink-soft placeholder:font-sans" />
                ) : (
                  <div className="space-y-3">
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="syllabus-img-input" />
                    {imagePreview ? (
                      <div className="relative">
                        <img src={imagePreview} alt="Syllabus" className="w-full rounded-2xl border border-black/10 object-contain max-h-64" />
                        <button type="button" onClick={() => { setImagePreview(null); setExtracted([]) }}
                          className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center border border-black/10">
                          <X className="w-3.5 h-3.5 text-ink-soft" />
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="syllabus-img-input"
                        className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-[#AACDEA] bg-white text-[#5B87AD] cursor-pointer">
                        <Upload className="w-5 h-5" />
                        <p className="font-bold text-sm">Tap to upload a textbook photo</p>
                      </label>
                    )}
                  </div>
                )}

                <button type="button" onClick={handleExtract} disabled={extracting || (importMode === 'text' ? !importText.trim() : !imagePreview)}
                  className="w-full flex items-center justify-center gap-2 bg-[#5B87AD] text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40">
                  {extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing...</> : <><Sparkles className="w-4 h-4" /> Extract Topics with AI</>}
                </button>

                {extractError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" /><p className="text-sm text-red-700">{extractError}</p>
                  </div>
                )}

                {extracted.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-sm font-bold text-ink">{extracted.length} topics extracted · review before saving</p>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {extracted.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 bg-white rounded-xl border border-black/10 px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-ink leading-tight">{t.topic}</p>
                            {t.description && <p className="text-xs text-ink-soft mt-0.5 italic">{t.description}</p>}
                          </div>
                          <button type="button" onClick={() => setExtracted(prev => prev.filter((_, idx) => idx !== i))} className="text-ink-faint hover:text-red-400 p-0.5">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={saveExtracted} disabled={saving}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
                      {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save {extracted.length} Topics</>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Topic list ── */}
            <div className="paper-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-ink flex items-center gap-2"><BookOpen className="w-4 h-4 text-ink-soft" /> Topics ({topics.length})</h2>
                {topics.length > 0 && (
                  <button type="button" onClick={generateEstimates} disabled={estimating}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#8069B0] px-3 py-1.5 rounded-lg hover:bg-[#E9E1F6] transition-colors disabled:opacity-50">
                    {estimating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Session Estimate
                  </button>
                )}
              </div>

              {estimateError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{estimateError}</p>}

              {loadingTopics ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-ink-soft" /></div>
              ) : topics.length === 0 ? (
                <p className="text-sm text-ink-soft text-center py-6">No topics yet — import via AI above, or add one manually below.</p>
              ) : (
                <div className="space-y-2">
                  {topics.map(t => (
                    <div key={t.definitionId} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(58,44,30,0.03)' }}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button type="button" onClick={() => toggleExpand(t.definitionId)} className="p-1 -ml-1 rounded-lg text-ink-faint hover:text-ink hover:bg-black/5 transition-colors shrink-0">
                          {expandedTopicId === t.definitionId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-ink">
                            {t.topic}
                            {t.wasLegacy && <span className="ml-2 text-[10px] font-bold text-ink-faint bg-black/5 px-2 py-0.5 rounded-full align-middle">from existing syllabus</span>}
                          </p>
                          {t.description && <p className="text-xs text-ink-soft mt-0.5">{t.description}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number" min={1}
                            value={t.estimatedSessions ?? ''}
                            onChange={e => updateEstimate(t.definitionId, Math.max(1, Number(e.target.value) || 1))}
                            placeholder="—"
                            className="w-16 px-2 py-1.5 rounded-xl border text-sm text-center bg-white"
                            style={{ borderColor: 'rgba(58,44,30,0.18)' }}
                          />
                          <span className="text-[10px] text-ink-faint">sessions</span>
                        </div>
                        <button type="button" onClick={() => deleteTopic(t.definitionId)} className="p-1.5 rounded-lg text-ink-faint hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {expandedTopicId === t.definitionId && (
                        <div className="px-4 pb-4 pl-11 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-ink-faint uppercase tracking-wide flex items-center gap-1.5">
                              <List className="w-3 h-3" /> Sub-topics
                            </p>
                            {(subtopicsByTopic[t.definitionId]?.length ?? 0) > 0 && !!t.estimatedSessions && (
                              <button
                                type="button"
                                onClick={() => generateSubtopicEstimates(t)}
                                disabled={estimatingSubtopics === t.definitionId}
                                className="flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-900 disabled:opacity-50 transition-colors"
                              >
                                {estimatingSubtopics === t.definitionId
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Sparkles className="w-3 h-3" />}
                                AI Session Estimate
                              </button>
                            )}
                          </div>

                          {loadingSubtopics === t.definitionId ? (
                            <div className="flex items-center gap-2 text-xs text-ink-faint py-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {(subtopicsByTopic[t.definitionId] ?? []).map(s => (
                                <div key={s.definitionId} className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white/70">
                                  <p className="flex-1 min-w-0 text-xs font-medium text-ink truncate">{s.name}</p>
                                  <input
                                    type="number" min={1}
                                    value={s.estimatedSessions ?? ''}
                                    onChange={e => updateSubtopicEstimate(t.definitionId, s.definitionId, Math.max(1, Number(e.target.value) || 1))}
                                    placeholder="—"
                                    className="w-14 px-1.5 py-1 rounded-lg border text-xs text-center bg-white"
                                    style={{ borderColor: 'rgba(58,44,30,0.18)' }}
                                  />
                                  <span className="text-[9px] text-ink-faint shrink-0">sess.</span>
                                  <button type="button" onClick={() => deleteSubtopic(t.definitionId, s.definitionId)} className="p-1 rounded-lg text-ink-faint hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {(subtopicsByTopic[t.definitionId] ?? []).length === 0 && (
                                <p className="text-xs text-ink-faint italic py-1">No sub-topics yet.</p>
                              )}
                            </div>
                          )}

                          <form
                            onSubmit={e => { e.preventDefault(); addSubtopic(t.definitionId) }}
                            className="flex items-center gap-2 pt-1"
                          >
                            <input
                              value={newSubtopicName}
                              onChange={e => setNewSubtopicName(e.target.value)}
                              placeholder="Add a sub-topic…"
                              className="flex-1 px-3 py-1.5 rounded-xl border text-xs bg-white"
                              style={{ borderColor: 'rgba(58,44,30,0.18)' }}
                            />
                            <button
                              type="submit"
                              disabled={addingSubtopic || !newSubtopicName.trim()}
                              className="p-1.5 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 disabled:opacity-50 transition-colors shrink-0"
                            >
                              {addingSubtopic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={e => { e.preventDefault(); addTopicManually() }} className="flex items-center gap-2 mt-4">
                <input value={newTopic} onChange={e => setNewTopic(e.target.value)} placeholder="Add a topic manually…" className="input-field flex-1" />
                <button type="submit" disabled={!newTopic.trim() || addingTopic} className="px-3 py-2 rounded-xl disabled:opacity-50" style={{ background: 'var(--ink)', color: 'var(--paper-soft)' }}>
                  {addingTopic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
