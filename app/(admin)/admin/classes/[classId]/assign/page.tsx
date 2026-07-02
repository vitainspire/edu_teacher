'use client'
import { useEffect, useState } from 'react'
import { useAdmin } from '@/lib/admin-context'
import { UserCheck, Loader2, ArrowLeft, Check, X } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import type { Teacher } from '@/lib/types'

interface Assignment {
  teacherId: string
  subject: string
}

export default function AssignTeacherPage() {
  const { school } = useAdmin()
  const params = useParams()
  const router = useRouter()
  const classId = params.classId as string

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assigned, setAssigned] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState('')

  // subject modal state
  const [pendingTeacher, setPendingTeacher] = useState<Teacher | null>(null)
  const [subjectInput, setSubjectInput] = useState('')

  useEffect(() => {
    if (!school) { setLoading(false); return }
    Promise.all([
      fetch(`/api/admin/schools/${school.id}/teachers`).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/classes/${classId}/assign-teacher`).then(r => r.json()),
    ]).then(([td, ad]) => {
      setTeachers(td.teachers ?? [])
      setAssigned(ad.assignments ?? [])
    }).finally(() => setLoading(false))
  }, [school, classId])

  function isAssigned(teacherId: string) {
    return assigned.some(a => a.teacherId === teacherId)
  }

  function getSubject(teacherId: string) {
    return assigned.find(a => a.teacherId === teacherId)?.subject ?? ''
  }

  function openAssign(t: Teacher) {
    setSubjectInput(t.subject || '')
    setPendingTeacher(t)
  }

  async function confirmAssign() {
    if (!school || !pendingTeacher) return
    setSaving(pendingTeacher.id)
    setPendingTeacher(null)
    await fetch(`/api/admin/schools/${school.id}/classes/${classId}/assign-teacher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: pendingTeacher.id, subject: subjectInput.trim() }),
    })
    setAssigned(a => {
      const filtered = a.filter(x => x.teacherId !== pendingTeacher.id)
      return [...filtered, { teacherId: pendingTeacher.id, subject: subjectInput.trim() }]
    })
    setSuccess(`${pendingTeacher.name} assigned successfully`)
    setTimeout(() => setSuccess(''), 3000)
    setSaving(null)
  }

  async function removeAssignment(teacherId: string) {
    if (!school) return
    setSaving(teacherId)
    await fetch(`/api/admin/schools/${school.id}/classes/${classId}/assign-teacher`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
    })
    setAssigned(a => a.filter(x => x.teacherId !== teacherId))
    setSaving(null)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Classes
      </button>

      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
        <UserCheck className="w-5 h-5 text-indigo-600" /> Assign Teachers
      </h1>
      <p className="text-sm text-gray-500 mb-6">Assign teachers to this class and specify which subject each one teaches.</p>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No teachers in school yet</p>
          <p className="text-sm text-gray-400 mt-1">Add teachers first from the Teachers page</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {teachers.map((t, i) => {
            const assigned_ = isAssigned(t.id)
            const subject = getSubject(t.id)
            return (
              <div key={t.id} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: '#4338ca' }}>
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    {assigned_ && subject ? (
                      <p className="text-xs font-semibold text-indigo-600 mt-0.5">{subject}</p>
                    ) : (
                      <p className="text-xs text-gray-400">{t.subject || 'No default subject'}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {assigned_ && (
                    <button
                      onClick={() => openAssign(t)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    >
                      Edit Subject
                    </button>
                  )}
                  <button
                    onClick={() => assigned_ ? removeAssignment(t.id) : openAssign(t)}
                    disabled={saving === t.id}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: assigned_ ? '#ecfdf5' : '#f3f4f6',
                      color: assigned_ ? '#059669' : '#6b7280',
                      border: `1px solid ${assigned_ ? '#6ee7b7' : '#e5e7eb'}`,
                    }}
                  >
                    {saving === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : assigned_ ? <Check className="w-3.5 h-3.5" /> : null}
                    {assigned_ ? 'Assigned' : 'Assign'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Subject modal */}
      {pendingTeacher && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Assign {pendingTeacher.name}</h2>
              <button onClick={() => setPendingTeacher(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Subject they teach in this class</label>
              <input
                type="text"
                value={subjectInput}
                onChange={e => setSubjectInput(e.target.value)}
                placeholder="e.g. Mathematics, Science, English"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && confirmAssign()}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPendingTeacher(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={confirmAssign}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ background: '#4338ca' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
