'use client'
import { useEffect, useState } from 'react'
import { useAdmin } from '@/lib/admin-context'
import { BookOpen, Plus, Trash2, Loader2, Users, UserCheck, ListOrdered } from 'lucide-react'
import type { Class } from '@/lib/types'
import Link from 'next/link'

interface CreateForm { name: string; grade: string; section: string; academicYear: string }
const EMPTY: CreateForm = { name: '', grade: '', section: '', academicYear: new Date().getFullYear().toString() }

export default function ClassesPage() {
  const { school } = useAdmin()
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function load() {
    if (!school) { setLoading(false); return }
    fetch(`/api/admin/schools/${school.id}/classes`)
      .then(r => r.json())
      .then(cd => setClasses(cd.classes ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [school])

  async function createClass(e: React.FormEvent) {
    e.preventDefault()
    if (!school) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/schools/${school.id}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSaveError(body.error ?? `Error ${res.status}`)
        return
      }
      setShowCreate(false)
      setForm(EMPTY)
      load()
    } catch {
      setSaveError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function deleteClass(classId: string) {
    if (!school) return
    if (!confirm('Delete this class and all its students?')) return
    setDeleting(classId)
    await fetch(`/api/admin/schools/${school.id}/classes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId }),
    })
    setDeleting(null)
    load()
  }

  const CLASS_COLORS = ['#2563eb']

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-600" /> Classes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{classes.length} class{classes.length !== 1 ? 'es' : ''} in {school?.name}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ background: '#4338ca' }}
        >
          <Plus className="w-4 h-4" /> Create Class
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No classes yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first class to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, i) => {
            const color = CLASS_COLORS[i % CLASS_COLORS.length]
            return (
              <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1.5" style={{ background: color }} />
                <div className="p-5">
                  <Link href={`/admin/classes/${cls.id}/students`} className="block mb-3 group">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">{cls.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Grade {cls.grade} · Section {cls.section}</p>
                      </div>
                      <button
                        onClick={e => { e.preventDefault(); deleteClass(cls.id) }}
                        disabled={deleting === cls.id}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {deleting === cls.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                    {cls.classCode && (
                      <p className="text-xs text-gray-400 mt-1">
                        Code: <span className="font-mono font-medium text-gray-600">{cls.classCode}</span>
                      </p>
                    )}
                  </Link>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/classes/${cls.id}/students`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" /> Students
                    </Link>
                    <Link
                      href={`/admin/classes/${cls.id}/assign`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Assign
                    </Link>
                    <Link
                      href={`/admin/classes/${cls.id}/syllabus`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                    >
                      <ListOrdered className="w-3.5 h-3.5" /> Syllabus
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Create Class</h2>
            <form onSubmit={createClass} className="space-y-4">
              {[
                { label: 'Class Name', key: 'name', placeholder: 'e.g. Class 10A - Mathematics' },
                { label: 'Grade', key: 'grade', placeholder: 'e.g. 10' },
                { label: 'Section', key: 'section', placeholder: 'e.g. A' },
                { label: 'Academic Year', key: 'academicYear', placeholder: '2025' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key as keyof CreateForm]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required={['name','grade','section'].includes(key)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setSaveError(null) }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: '#4338ca' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
