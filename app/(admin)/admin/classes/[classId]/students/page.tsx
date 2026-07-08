'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAdmin } from '@/lib/admin-context'
import { GraduationCap, Upload, Loader2, Plus, X, Trash2, Users, Copy, Check } from 'lucide-react'
import { useParams } from 'next/navigation'
import type { Student } from '@/lib/types'
import PageHeader from '@/components/theme/PageHeader'

interface StudentRow { name: string; rollNumber: string }

export default function StudentsPage() {
  const { school } = useAdmin()
  const params = useParams()
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
    <div className="paper-page pb-16">

      <PageHeader
        eyebrow={className || 'Class'}
        title="Students"
        subtitle={`${students.length} student${students.length !== 1 ? 's' : ''} enrolled`}
      />

      <div className="px-5 pt-2 max-w-4xl mx-auto space-y-6 relative z-10">

        {/* Feedback banners */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-2xl px-4 py-3 flex items-center justify-between">
            {success}
            <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-800"><X className="w-4 h-4" /></button>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-2xl px-4 py-3 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Student list */}
        <div className="paper-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1.5px solid rgba(58,44,30,0.1)' }}>
            <Users className="w-4 h-4 text-ink-soft" />
            <h2 className="font-display font-bold text-ink">Student Roster</h2>
          </div>

          {loadingStudents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-ink-soft" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="w-10 h-10 text-ink-faint mx-auto mb-3" />
              <p className="text-ink-soft text-sm">No students yet. Add them below.</p>
            </div>
          ) : (
            <div>
              {students.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-5 py-3 gap-3"
                  style={{ borderTop: i > 0 ? '1px solid rgba(58,44,30,0.08)' : 'none' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black flex-shrink-0"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length].bg, color: AVATAR_COLORS[i % AVATAR_COLORS.length].text }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{s.name}</p>
                      <p className="text-xs text-ink-soft">Roll No. {s.rollNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.studentCode ? (
                      <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1" style={{ background: 'rgba(58,44,30,0.06)' }}>
                        <span className="text-xs font-black text-ink tracking-widest">{s.studentCode}</span>
                        <button
                          onClick={() => copyCode(s.studentCode!, s.id)}
                          className="text-ink-soft hover:text-ink transition-colors"
                          title="Copy Student ID"
                        >
                          {copiedId === s.id
                            ? <Check className="w-3 h-3 text-emerald-600" />
                            : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-faint italic">no code</span>
                    )}
                    <button onClick={() => removeStudent(s.id)}
                      disabled={deletingId === s.id}
                      className="p-1.5 rounded-xl text-ink-faint hover:text-red-600 hover:bg-red-50 transition-colors">
                      {deletingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Add student forms ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-4">

          {/* Single student */}
          <div className="paper-card p-5">
            <h2 className="font-display font-bold text-ink flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-ink-soft" /> Add Single Student
            </h2>
            <form onSubmit={addSingle} className="space-y-3">
              <div>
                <label className="label" style={{ color: 'var(--ink-soft)' }}>Student Name</label>
                <input type="text" value={singleName} onChange={e => setSingleName(e.target.value)}
                  placeholder="Full name" required
                  className="input-field"
                />
              </div>
              <div>
                <label className="label" style={{ color: 'var(--ink-soft)' }}>Roll Number</label>
                <input type="text" value={singleRoll} onChange={e => setSingleRoll(e.target.value)}
                  placeholder="e.g. 1 or A001" required
                  className="input-field"
                />
              </div>
              <button type="submit" disabled={importing}
                className="paper-btn-primary w-full text-sm disabled:opacity-60">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Student
              </button>
            </form>
          </div>

          {/* Bulk import */}
          <div className="paper-card p-5">
            <h2 className="font-display font-bold text-ink flex items-center gap-2 mb-4">
              <Upload className="w-4 h-4 text-ink-soft" /> Bulk Import
            </h2>
            <p className="text-xs text-ink-soft mb-3">
              One per line: <span className="font-mono">Name, RollNumber</span><br />
              Roll number is optional (auto-assigned if missing)
            </p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"Arjun Sharma, 1\nPriya Patel, 2\nRohan Kumar"}
              rows={6}
              className="input-field resize-none font-mono"
            />
            {preview.length > 0 && (
              <p className="text-xs font-semibold text-ink-soft mt-1 mb-3">{preview.length} students detected</p>
            )}
            <button
              onClick={importStudents}
              disabled={importing || preview.length === 0}
              className="paper-btn-primary w-full text-sm disabled:opacity-60">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import {preview.length > 0 ? `${preview.length} Students` : 'Students'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const AVATAR_COLORS = [
  { bg: '#C7B7E8', text: '#31215C' },
  { bg: '#AACDEA', text: '#1E3A55' },
  { bg: '#AAD6A0', text: '#234A1D' },
  { bg: '#EAC968', text: '#4A3809' },
  { bg: '#F0AFC6', text: '#5C1F38' },
  { bg: '#9FDDE0', text: '#164e63' },
  { bg: '#F0A491', text: '#5C2416' },
]
