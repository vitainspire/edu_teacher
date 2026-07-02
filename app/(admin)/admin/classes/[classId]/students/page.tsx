'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAdmin } from '@/lib/admin-context'
import { GraduationCap, Upload, Loader2, ArrowLeft, Plus, X, Trash2, Users, Copy, Check } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import type { Student } from '@/lib/types'

interface StudentRow { name: string; rollNumber: string }

export default function StudentsPage() {
  const { school } = useAdmin()
  const params = useParams()
  const router = useRouter()
  const classId = params.classId as string

  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [className, setClassName] = useState('')

  // Single add form
  const [singleName, setSingleName] = useState('')
  const [singleRoll, setSingleRoll] = useState('')

  // Bulk import
  const [bulkText, setBulkText] = useState('')
  const [preview, setPreview] = useState<StudentRow[]>([])

  const [importing, setImporting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const load = useCallback(() => {
    if (!school) { setLoadingStudents(false); return }
    Promise.all([
      fetch(`/api/admin/schools/${school.id}/classes/${classId}/students`).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/classes`).then(r => r.json()),
    ]).then(([sd, cd]) => {
      setStudents(sd.students ?? [])
      const cls = (cd.classes ?? []).find((c: { id: string; name: string }) => c.id === classId)
      setClassName(cls?.name ?? '')
    }).finally(() => setLoadingStudents(false))
  }, [school, classId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setPreview(parseText(bulkText))
  }, [bulkText])

  function parseText(text: string): StudentRow[] {
    return text.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        const parts = line.split(',').map(p => p.trim())
        return { name: parts[0] ?? line, rollNumber: parts[1] ?? String(i + 1) }
      })
  }

  async function addSingle(e: React.FormEvent) {
    e.preventDefault()
    if (!school || !singleName || !singleRoll) return
    setImporting(true)
    setError('')
    const res = await fetch(`/api/admin/schools/${school.id}/classes/${classId}/students/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: [{ name: singleName, rollNumber: singleRoll }] }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Add failed'); setImporting(false); return }
    setSuccess(`${singleName} added successfully`)
    setSingleName('')
    setSingleRoll('')
    setImporting(false)
    load()
  }

  async function importStudents() {
    if (!school || preview.length === 0) return
    setImporting(true)
    setError('')
    const res = await fetch(`/api/admin/schools/${school.id}/classes/${classId}/students/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: preview }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Import failed'); setImporting(false); return }
    setSuccess(`${data.inserted} students imported successfully`)
    setBulkText('')
    setPreview([])
    setImporting(false)
    load()
  }

  async function removeStudent(studentId: string) {
    if (!school || !confirm('Remove this student?')) return
    setDeletingId(studentId)
    const res = await fetch(`/api/admin/schools/${school.id}/classes/${classId}/students`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    })
    if (!res.ok) { setError('Failed to remove student'); }
    setDeletingId(null)
    load()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Classes
      </button>

      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-1">
        <GraduationCap className="w-5 h-5 text-green-600" />
        {className || 'Class'} — Students
      </h1>
      <p className="text-sm text-gray-400 mb-6">{students.length} student{students.length !== 1 ? 's' : ''} enrolled</p>

      {/* Feedback banners */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Student list ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Users className="w-4 h-4 text-indigo-600" />
          <h2 className="font-semibold text-gray-800">Student Roster</h2>
        </div>

        {loadingStudents ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No students yet. Add them below.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {students.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length].bg, color: AVATAR_COLORS[i % AVATAR_COLORS.length].text }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-400">Roll No. {s.rollNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.studentCode ? (
                    <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1">
                      <span className="text-xs font-black text-indigo-700 tracking-widest">{s.studentCode}</span>
                      <button
                        onClick={() => copyCode(s.studentCode!, s.id)}
                        className="text-indigo-400 hover:text-indigo-700 transition-colors"
                        title="Copy Student ID"
                      >
                        {copiedId === s.id
                          ? <Check className="w-3 h-3 text-emerald-500" />
                          : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 italic">no code</span>
                  )}
                  <button onClick={() => removeStudent(s.id)}
                    disabled={deletingId === s.id}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    {deletingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add student forms ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Single student */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-indigo-600" /> Add Single Student
          </h2>
          <form onSubmit={addSingle} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Student Name</label>
              <input type="text" value={singleName} onChange={e => setSingleName(e.target.value)}
                placeholder="Full name" required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Roll Number</label>
              <input type="text" value={singleRoll} onChange={e => setSingleRoll(e.target.value)}
                placeholder="e.g. 1 or A001" required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button type="submit" disabled={importing}
              className="w-full py-2 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: '#4338ca' }}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Student
            </button>
          </form>
        </div>

        {/* Bulk import */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Upload className="w-4 h-4 text-indigo-600" /> Bulk Import
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            One per line: <span className="font-mono">Name, RollNumber</span><br />
            Roll number is optional (auto-assigned if missing)
          </p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={"Arjun Sharma, 1\nPriya Patel, 2\nRohan Kumar"}
            rows={6}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {preview.length > 0 && (
            <p className="text-xs text-indigo-600 mt-1 mb-3">{preview.length} students detected</p>
          )}
          <button
            onClick={importStudents}
            disabled={importing || preview.length === 0}
            className="w-full py-2 rounded-xl text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: '#059669' }}>
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import {preview.length > 0 ? `${preview.length} Students` : 'Students'}
          </button>
        </div>
      </div>
    </div>
  )
}

const AVATAR_COLORS = [
  { bg: '#ede9fe', text: '#6d28d9' },
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#cffafe', text: '#164e63' },
  { bg: '#ffedd5', text: '#9a3412' },
]
