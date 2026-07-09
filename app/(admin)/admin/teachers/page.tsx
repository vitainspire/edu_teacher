'use client'
import { useEffect, useState } from 'react'
import { useAdmin } from '@/lib/admin-context'
import { Users, Trash2, Loader2, UserPlus, Eye, EyeOff, Gauge, GraduationCap, Plus, Pencil } from 'lucide-react'
import type { Teacher, TeacherQualification } from '@/lib/types'
import PageHeader from '@/components/theme/PageHeader'
import { Sticker } from '@/components/theme/StickerIcon'
import Modal from '@/components/ui/Modal'

interface CreateForm {
  name: string
  email: string
  password: string
  subject: string
}

const EMPTY_FORM: CreateForm = { name: '', email: '', password: '', subject: '' }

const EMPTY_QUAL_FORM = { subject: '', grade: '', section: '' }

export default function TeachersPage() {
  const { school } = useAdmin()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [limitsTeacher, setLimitsTeacher] = useState<Teacher | null>(null)
  const [limitsForm, setLimitsForm] = useState({ maxPeriodsPerDay: '', maxPeriodsPerWeek: '' })
  const [savingLimits, setSavingLimits] = useState(false)

  const [qualifications, setQualifications] = useState<TeacherQualification[]>([])
  const [qualsTeacher, setQualsTeacher] = useState<Teacher | null>(null)
  const [qualForm, setQualForm] = useState(EMPTY_QUAL_FORM)
  const [addingQual, setAddingQual] = useState(false)
  const [deletingQualId, setDeletingQualId] = useState<string | null>(null)

  const [subjectTeacher, setSubjectTeacher] = useState<Teacher | null>(null)
  const [subjectForm, setSubjectForm] = useState('')
  const [savingSubject, setSavingSubject] = useState(false)

  function load() {
    if (!school) { setLoading(false); return }
    Promise.all([
      fetch(`/api/admin/schools/${school.id}/teachers`).then(r => r.json()),
      fetch(`/api/admin/schools/${school.id}/qualifications`).then(r => r.json()),
    ])
      .then(([teachersData, qualsData]) => {
        setTeachers(teachersData.teachers ?? [])
        setQualifications(qualsData.qualifications ?? [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [school])

  async function removeTeacher(teacherId: string) {
    if (!school) return
    if (!confirm('Remove this teacher from the school?')) return
    setRemoving(teacherId)
    await fetch(`/api/admin/schools/${school.id}/teachers`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
    })
    setRemoving(null)
    load()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!school) return
    setCreateError('')
    if (form.password.length < 6) { setCreateError('Password must be at least 6 characters.'); return }
    setCreating(true)
    const res = await fetch(`/api/admin/schools/${school.id}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setCreateError(data.error ?? 'Failed to create teacher.'); return }
    setShowModal(false)
    setForm(EMPTY_FORM)
    load()
  }

  function closeModal() {
    setShowModal(false)
    setForm(EMPTY_FORM)
    setCreateError('')
    setShowPw(false)
  }

  function openLimits(t: Teacher) {
    setLimitsTeacher(t)
    setLimitsForm({
      maxPeriodsPerDay: t.maxPeriodsPerDay?.toString() ?? '',
      maxPeriodsPerWeek: t.maxPeriodsPerWeek?.toString() ?? '',
    })
  }

  async function saveLimits() {
    if (!school || !limitsTeacher) return
    setSavingLimits(true)
    await fetch(`/api/admin/schools/${school.id}/teachers`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: limitsTeacher.id,
        maxPeriodsPerDay: limitsForm.maxPeriodsPerDay,
        maxPeriodsPerWeek: limitsForm.maxPeriodsPerWeek,
      }),
    })
    setSavingLimits(false)
    setLimitsTeacher(null)
    load()
  }

  function openQuals(t: Teacher) {
    setQualsTeacher(t)
    setQualForm(EMPTY_QUAL_FORM)
  }

  function openSubject(t: Teacher) {
    setSubjectTeacher(t)
    setSubjectForm(t.subject ?? '')
  }

  async function saveSubject() {
    if (!school || !subjectTeacher) return
    setSavingSubject(true)
    await fetch(`/api/admin/schools/${school.id}/teachers`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: subjectTeacher.id, subject: subjectForm }),
    })
    setSavingSubject(false)
    setSubjectTeacher(null)
    load()
  }

  async function addQualification() {
    if (!school || !qualsTeacher || !qualForm.subject.trim() || !qualForm.grade.trim()) return
    setAddingQual(true)
    const res = await fetch(`/api/admin/schools/${school.id}/qualifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: qualsTeacher.id, ...qualForm }),
    })
    const data = await res.json()
    setQualifications(data.qualifications ?? [])
    setQualForm(EMPTY_QUAL_FORM)
    setAddingQual(false)
  }

  async function removeQualification(id: string) {
    if (!school) return
    setDeletingQualId(id)
    const res = await fetch(`/api/admin/schools/${school.id}/qualifications`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    setQualifications(data.qualifications ?? [])
    setDeletingQualId(null)
  }

  return (
    <div className="paper-page pb-16">

      <PageHeader
        title="Teachers"
        back={false}
        subtitle={`${teachers.length} teacher${teachers.length !== 1 ? 's' : ''} in ${school?.name ?? 'your school'}`}
        action={
          <button
            onClick={() => { setShowModal(true); setCreateError('') }}
            className="flex items-center gap-1.5 font-bold px-3.5 py-2.5 rounded-2xl text-xs active:scale-95 transition-transform"
            style={{ background: 'var(--ink)', color: 'var(--paper-soft)' }}
          >
            <UserPlus size={14} strokeWidth={2.5} /> Add Teacher
          </button>
        }
      />

      <div className="px-5 pt-3 relative z-10">

        {loading ? (
          <div className="paper-card p-10 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-ink-soft mx-auto" />
          </div>
        ) : teachers.length === 0 ? (
          <div className="paper-card px-6 py-14 text-center">
            <Sticker tone="cream" size={72} radius={999} style={{ margin: '0 auto 16px' }}>
              <Users size={30} className="text-ink-soft" />
            </Sticker>
            <p className="font-display font-bold text-ink text-lg">No teachers yet</p>
            <p className="text-sm text-ink-soft mt-1">Click &quot;Add Teacher&quot; to create their account</p>
          </div>
        ) : (
          <div className="paper-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1.5px solid rgba(58,44,30,0.12)' }}>
                    <th className="text-left text-xs font-bold text-ink-soft uppercase tracking-wide px-5 py-3">Name</th>
                    <th className="text-left text-xs font-bold text-ink-soft uppercase tracking-wide px-5 py-3">Subject</th>
                    <th className="text-left text-xs font-bold text-ink-soft uppercase tracking-wide px-5 py-3">Qualifications</th>
                    <th className="text-left text-xs font-bold text-ink-soft uppercase tracking-wide px-5 py-3">Workload Limit</th>
                    <th className="text-left text-xs font-bold text-ink-soft uppercase tracking-wide px-5 py-3">Code</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t, i) => (
                    <tr key={t.id} style={i < teachers.length - 1 ? { borderBottom: '1px solid rgba(58,44,30,0.08)' } : undefined}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--ink)', color: 'var(--paper-soft)' }}>
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-ink">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => openSubject(t)}
                          className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors"
                        >
                          {t.subject || '—'}
                          <Pencil size={11} className="text-ink-faint" />
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => openQuals(t)}
                          className="flex items-center gap-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
                        >
                          <GraduationCap size={13} />
                          {(() => {
                            const count = qualifications.filter(q => q.teacherId === t.id).length
                            return count > 0 ? `${count} subject${count !== 1 ? 's' : ''}` : 'Not set'
                          })()}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => openLimits(t)}
                          className="flex items-center gap-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors"
                        >
                          <Gauge size={13} />
                          {t.maxPeriodsPerDay || t.maxPeriodsPerWeek
                            ? [t.maxPeriodsPerDay && `${t.maxPeriodsPerDay}/day`, t.maxPeriodsPerWeek && `${t.maxPeriodsPerWeek}/wk`].filter(Boolean).join(' · ')
                            : 'No limit'}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs paper-pill">{t.teacherCode ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => removeTeacher(t.id)}
                          disabled={removing === t.id}
                          className="p-1.5 rounded-lg text-ink-faint hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {removing === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Teacher Modal */}
      <Modal open={showModal} onClose={closeModal} title="Add Teacher">
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && (
            <div className="text-sm px-4 py-3 rounded-2xl" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.15)' }}>
              {createError}
            </div>
          )}

          <div>
            <label className="label">Full Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Sunita Sharma"
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="label">Email Address *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="teacher@school.edu.in"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Subject (optional)</label>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Mathematics"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Password * (min 6 chars)</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Give this to the teacher"
                className="input-field pr-12"
              />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-ink-faint mt-1.5">Share these credentials with the teacher so they can log in.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 py-3 rounded-2xl text-ink-soft font-bold text-sm active:scale-95 transition-transform"
              style={{ background: 'rgba(58,44,30,0.06)' }}
            >
              Cancel
            </button>
            <button type="submit" disabled={creating} className="flex-1 paper-btn-primary" style={{ opacity: creating ? 0.7 : 1 }}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Workload limits modal */}
      <Modal open={!!limitsTeacher} onClose={() => setLimitsTeacher(null)} title="Workload Limit">
        <p className="text-sm text-ink-soft mb-4">
          Optional caps on how many periods {limitsTeacher?.name} can be assigned per day/week — used when auto-assigning substitute coverage. Leave blank for no limit.
        </p>
        <div className="space-y-4">
          <div>
            <label className="label">Max Periods / Day</label>
            <input
              type="number"
              min={0}
              value={limitsForm.maxPeriodsPerDay}
              onChange={e => setLimitsForm(f => ({ ...f, maxPeriodsPerDay: e.target.value }))}
              placeholder="No limit"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Max Periods / Week</label>
            <input
              type="number"
              min={0}
              value={limitsForm.maxPeriodsPerWeek}
              onChange={e => setLimitsForm(f => ({ ...f, maxPeriodsPerWeek: e.target.value }))}
              placeholder="No limit"
              className="input-field"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setLimitsTeacher(null)}
              className="flex-1 py-3 rounded-2xl text-ink-soft font-bold text-sm active:scale-95 transition-transform"
              style={{ background: 'rgba(58,44,30,0.06)' }}
            >
              Cancel
            </button>
            <button type="button" onClick={saveLimits} disabled={savingLimits} className="flex-1 paper-btn-primary" style={{ opacity: savingLimits ? 0.7 : 1 }}>
              {savingLimits ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Qualifications modal */}
      <Modal open={!!qualsTeacher} onClose={() => setQualsTeacher(null)} title="Qualifications">
        <p className="text-sm text-ink-soft mb-4">
          Which subjects and grades can {qualsTeacher?.name} teach — used to find eligible substitutes. Leave section blank to qualify for every section of that grade.
        </p>

        <div className="space-y-2 mb-4">
          {qualifications.filter(q => q.teacherId === qualsTeacher?.id).length === 0 ? (
            <p className="text-xs text-ink-faint">No qualifications set yet — substitute matching will fall back to this teacher's actual timetable/assignments.</p>
          ) : qualifications.filter(q => q.teacherId === qualsTeacher?.id).map(q => (
            <div key={q.id} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl" style={{ background: 'rgba(58,44,30,0.06)' }}>
              <span className="text-sm font-bold text-ink">
                {q.subject} · Grade {q.grade}{q.section ? ` · Sec ${q.section}` : ''}
              </span>
              <button
                onClick={() => removeQualification(q.id)}
                disabled={deletingQualId === q.id}
                className="p-1 rounded-lg text-ink-faint hover:text-red-500 transition-colors"
              >
                {deletingQualId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <input
            type="text"
            value={qualForm.subject}
            onChange={e => setQualForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="Subject"
            className="input-field"
          />
          <input
            type="text"
            value={qualForm.grade}
            onChange={e => setQualForm(f => ({ ...f, grade: e.target.value }))}
            placeholder="Grade"
            className="input-field"
          />
          <input
            type="text"
            value={qualForm.section}
            onChange={e => setQualForm(f => ({ ...f, section: e.target.value }))}
            placeholder="Section (optional)"
            className="input-field"
          />
        </div>
        <button
          type="button"
          onClick={addQualification}
          disabled={addingQual || !qualForm.subject.trim() || !qualForm.grade.trim()}
          className="w-full flex items-center justify-center gap-1.5 paper-btn-primary"
          style={{ opacity: addingQual || !qualForm.subject.trim() || !qualForm.grade.trim() ? 0.6 : 1 }}
        >
          {addingQual ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus size={15} /> Add Qualification</>}
        </button>
      </Modal>

      {/* Subject edit modal */}
      <Modal open={!!subjectTeacher} onClose={() => setSubjectTeacher(null)} title="Subject">
        <p className="text-sm text-ink-soft mb-4">
          {subjectTeacher?.name}&apos;s primary subject — used as a default across lesson/test creation and AI tools. For substitute matching specifically, use Qualifications instead.
        </p>
        <div>
          <label className="label">Subject</label>
          <input
            type="text"
            value={subjectForm}
            onChange={e => setSubjectForm(e.target.value)}
            placeholder="e.g. Mathematics"
            className="input-field"
            autoFocus
          />
        </div>
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setSubjectTeacher(null)}
            className="flex-1 py-3 rounded-2xl text-ink-soft font-bold text-sm active:scale-95 transition-transform"
            style={{ background: 'rgba(58,44,30,0.06)' }}
          >
            Cancel
          </button>
          <button type="button" onClick={saveSubject} disabled={savingSubject} className="flex-1 paper-btn-primary" style={{ opacity: savingSubject ? 0.7 : 1 }}>
            {savingSubject ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
