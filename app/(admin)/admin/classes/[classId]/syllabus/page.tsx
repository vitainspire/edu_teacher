'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAdmin } from '@/lib/admin-context'
import { useParams, useRouter } from 'next/navigation'
import {
  BookOpen, Plus, Trash2, Loader2, ArrowLeft,
  CheckCircle2, Circle, GripVertical, AlertCircle,
} from 'lucide-react'

interface Topic {
  id: string
  topic: string
  description: string
  weekNumber: number | null
  orderIndex: number
  isCompleted: boolean
}

export default function AdminSyllabusPage() {
  const { school } = useAdmin()
  const params    = useParams()
  const router    = useRouter()
  const classId   = params.classId as string

  const [topics,    setTopics]    = useState<Topic[]>([])
  const [className, setClassName] = useState('')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Add form state
  const [adding,    setAdding]    = useState(false)
  const [newTopic,  setNewTopic]  = useState('')
  const [newDesc,   setNewDesc]   = useState('')
  const [newWeek,   setNewWeek]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveErr,   setSaveErr]   = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const apiBase = school
    ? `/api/admin/schools/${school.id}/classes/${classId}/syllabus`
    : null

  const load = useCallback(() => {
    if (!school) { setLoading(false); return }
    setLoading(true)
    // Fetch topics + class name in parallel
    Promise.all([
      fetch(apiBase!).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/classes`).then(r => r.json()),
    ]).then(([td, cd]) => {
      setTopics(td.topics ?? [])
      const cls = (cd.classes ?? []).find((c: { id: string; name: string }) => c.id === classId)
      setClassName(cls?.name ?? 'Class')
    }).catch(() => setError('Failed to load syllabus'))
      .finally(() => setLoading(false))
  }, [school, classId, apiBase])

  useEffect(() => { load() }, [load])

  async function addTopic(e: React.FormEvent) {
    e.preventDefault()
    if (!newTopic.trim() || !apiBase) return
    setSaving(true)
    setSaveErr(null)
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic:       newTopic.trim(),
          description: newDesc.trim(),
          weekNumber:  newWeek ? parseInt(newWeek, 10) : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSaveErr(body.error ?? `Error ${res.status}`)
        return
      }
      setNewTopic('')
      setNewDesc('')
      setNewWeek('')
      setAdding(false)
      load()
    } catch {
      setSaveErr('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTopic(id: string) {
    if (!apiBase || !confirm('Delete this topic?')) return
    setDeletingId(id)
    await fetch(apiBase, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeletingId(null)
    load()
  }

  async function toggleTopic(t: Topic) {
    if (!apiBase) return
    setTogglingId(t.id)
    await fetch(apiBase, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, isCompleted: !t.isCompleted }),
    })
    setTogglingId(null)
    load()
  }

  const done  = topics.filter(t => t.isCompleted).length
  const total = topics.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" /> Syllabus
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{className}</p>
        </div>
        <button
          onClick={() => { setAdding(true); setSaveErr(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ background: '#4338ca' }}
        >
          <Plus className="w-4 h-4" /> Add Topic
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">{done}/{total} topics covered</span>
            <span className="text-sm font-bold text-indigo-600">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }}
            />
          </div>
        </div>
      )}

      {/* Add topic form */}
      {adding && (
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4 mb-4">
          <form onSubmit={addTopic} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-indigo-700 mb-1">Topic *</label>
              <input
                autoFocus
                value={newTopic}
                onChange={e => setNewTopic(e.target.value)}
                placeholder="e.g. Photosynthesis"
                required
                className="w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-indigo-700 mb-1">Description</label>
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Optional brief description"
                className="w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-indigo-700 mb-1">Week number</label>
              <input
                type="number"
                min={1}
                value={newWeek}
                onChange={e => setNewWeek(e.target.value)}
                placeholder="e.g. 3"
                className="w-32 px-3 py-2 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
            {saveErr && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {saveErr}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setAdding(false); setSaveErr(null) }}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !newTopic.trim()}
                className="flex-1 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#4338ca' }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Topic'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No topics yet</p>
          <p className="text-sm text-gray-400 mt-1">Add topics to build the curriculum for this class.</p>
          <button
            onClick={() => setAdding(true)}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium"
            style={{ background: '#4338ca' }}
          >
            <Plus className="w-4 h-4" /> Add First Topic
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {topics.map((t, idx) => (
            <div
              key={t.id}
              className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group"
            >
              {/* Drag handle (visual only) */}
              <GripVertical className="w-4 h-4 text-gray-200 mt-0.5 shrink-0 group-hover:text-gray-300 transition-colors" />

              {/* Completion toggle */}
              <button
                onClick={() => toggleTopic(t)}
                disabled={togglingId === t.id}
                className="mt-0.5 shrink-0 text-gray-300 hover:text-indigo-500 transition-colors disabled:opacity-50"
              >
                {togglingId === t.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : t.isCompleted
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <Circle className="w-4 h-4" />}
              </button>

              {/* Topic content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold leading-snug ${t.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {t.topic}
                  </span>
                  {t.weekNumber != null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 shrink-0">
                      Week {t.weekNumber}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>
                )}
              </div>

              {/* Order badge + delete */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono text-gray-300 w-5 text-right">{idx + 1}</span>
                <button
                  onClick={() => deleteTopic(t.id)}
                  disabled={deletingId === t.id}
                  className="p-1 rounded-lg text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                >
                  {deletingId === t.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
