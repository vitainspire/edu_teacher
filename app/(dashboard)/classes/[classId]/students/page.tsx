'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  UserPlus, AlertTriangle, BookOpen,
  ChevronUp, Check, ChevronRight, Pencil, Search, X, Copy,
} from 'lucide-react'
import { useApp } from '@/lib/context'
import AddStudentModal from '@/components/students/AddStudentModal'
import { getMasteryColor, getMasteryLabel } from '@/lib/logic/mastery'
import clsx from 'clsx'

const INTERESTS = [
  { label: 'Cricket',  emoji: '🏏' },
  { label: 'Football', emoji: '⚽' },
  { label: 'Kabaddi',  emoji: '🤼' },
  { label: 'Cartoons', emoji: '🎬' },
  { label: 'Movies',   emoji: '🎥' },
  { label: 'Cooking',  emoji: '🍳' },
  { label: 'Farming',  emoji: '🌾' },
  { label: 'Music',    emoji: '🎵' },
  { label: 'Drawing',  emoji: '🎨' },
  { label: 'Dancing',  emoji: '💃' },
  { label: 'Reading',  emoji: '📚' },
  { label: 'Science',  emoji: '🔬' },
  { label: 'Animals',  emoji: '🐾' },
]

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #059669 0%, #34d399 100%)',
  'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
  'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #e11d48 0%, #fb7185 100%)',
  'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #c084fc 100%)',
]

export default function ClassStudentsPage() {
  const { classId } = useParams() as { classId: string }
  const { getClassStudents, getStudentAvgMastery, getStudentWarnings, classes, students: allStudents } = useApp()

  const cls = classes.find(c => c.id === classId)
  const [codeCopied, setCodeCopied] = useState(false)
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null)

  const copyStudentCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedStudentId(id)
      setTimeout(() => setCopiedStudentId(null), 2000)
    })
  }
  const [addOpen, setAddOpen]       = useState(false)
  const [search, setSearch]           = useState('')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [editInterests, setEditInterests] = useState<Record<string, string[]>>({})
  const [editGoal, setEditGoal]           = useState<Record<string, string>>({})
  const [saving, setSaving]               = useState<string | null>(null)
  const [saved, setSaved]                 = useState<Set<string>>(new Set())

  const copyCode = () => {
    if (!cls?.classCode) return
    navigator.clipboard.writeText(cls.classCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  const students = getClassStudents(classId)
  const filteredStudents = search.trim()
    ? students.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : students
  const missingInterests = students.filter(s => s.interests.length === 0).length

  const openEditor = (e: React.MouseEvent, id: string, interests: string[], goal: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!editInterests[id]) setEditInterests(p => ({ ...p, [id]: [...interests] }))
    if (editGoal[id] === undefined) setEditGoal(p => ({ ...p, [id]: goal }))
  }

  const toggleInterest = (studentId: string, label: string) => {
    setEditInterests(prev => {
      const cur = prev[studentId] ?? []
      return { ...prev, [studentId]: cur.includes(label) ? cur.filter(i => i !== label) : [...cur, label] }
    })
  }

  const handleSaveProfile = async (e: React.MouseEvent, studentId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSaving(studentId)
    const student = allStudents.find(s => s.id === studentId)
    if (student) {
      const updated = { ...student, interests: editInterests[studentId] ?? [], goal: (editGoal[studentId] ?? '').trim() }
      const { upsertStudent } = await import('@/lib/supabase-queries')
      upsertStudent(updated).catch(console.error)
    }
    setSaving(null)
    setSaved(prev => new Set([...prev, studentId]))
    setExpandedId(null)
    setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(studentId); return n }), 2500)
  }

  return (
    <div>
      {/* Class Code Banner */}
      {cls?.classCode && (
        <div className="mx-4 mt-4 mb-1 rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mb-0.5">Class Code — Share with students</p>
            <p className="text-white font-black text-2xl tracking-[0.18em] leading-none">{cls.classCode}</p>
            <p className="text-blue-300/70 text-[11px] mt-1">Students enter this code at the Student Portal to log in</p>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="shrink-0 flex flex-col items-center gap-1 bg-white/15 hover:bg-white/25 active:scale-95 transition-all rounded-xl px-3 py-2.5"
          >
            {codeCopied
              ? <Check size={18} className="text-emerald-400" />
              : <Copy size={18} className="text-white" />
            }
            <span className="text-[10px] font-bold text-white/70">{codeCopied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      )}

      {/* Sub-header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">
          {search.trim()
            ? `${filteredStudents.length} of ${students.length} student${students.length !== 1 ? 's' : ''}`
            : `${students.length} student${students.length !== 1 ? 's' : ''}`}
          {!search.trim() && missingInterests > 0 && (
            <span className="ml-2 text-amber-600 text-xs font-bold">· {missingInterests} missing interests</span>
          )}
        </p>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 text-white font-bold px-4 py-2 rounded-2xl text-sm active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            boxShadow: '0 3px 12px rgba(79,70,229,0.35)',
          }}
        >
          <UserPlus size={15} strokeWidth={2.5} /> Add Student
        </button>
      </div>

      {/* Search bar */}
      {students.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-2">
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students…"
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 active:text-slate-600">
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {missingInterests > 0 && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">
            Tap <Pencil size={12} className="inline mx-0.5" /> on a student card to add interests — the AI uses them for engagement hints.
          </p>
        </div>
      )}

      <div className="px-4 space-y-2.5 pb-4">
        {students.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={26} className="text-blue-500" />
            </div>
            <p className="font-bold text-slate-800 text-lg">No students yet</p>
            <p className="text-sm text-slate-500 mt-1">Add students to start tracking their progress</p>
            <button onClick={() => setAddOpen(true)} className="mt-5 btn-primary px-8 text-sm mx-auto">
              <UserPlus size={16} /> Add First Student
            </button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
            <Search size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600">No students match &quot;{search}&quot;</p>
            <button onClick={() => setSearch('')} className="mt-3 text-sm text-blue-600 font-semibold">Clear search</button>
          </div>
        ) : (
          filteredStudents.map((student, idx) => {
            const avgMastery    = getStudentAvgMastery(student.id)
            const warnings      = getStudentWarnings(student.id)
            const hasCritical   = warnings.some(w => w.level === 'critical')
            const avatarBg      = hasCritical
              ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
              : AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
            const isExpanded    = expandedId === student.id
            const localInterests = editInterests[student.id] ?? student.interests
            const localGoal      = editGoal[student.id] ?? student.goal
            const isSaved        = saved.has(student.id)

            return (
              <div
                key={student.id}
                className="bg-white rounded-3xl transition-all"
                style={{
                  boxShadow: isExpanded
                    ? '0 4px 24px rgba(79,70,229,0.12)'
                    : 'var(--shadow-card)',
                  border: isExpanded ? '1px solid #c7d2fe' : '1px solid transparent',
                }}
              >
                {/* Main row: left area → navigate to detail; pencil → expand editor */}
                <div className="flex items-center gap-3 p-4">
                  {/* Avatar */}
                  <Link
                    href={`/students/${student.id}`}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0 active:scale-95 transition-transform"
                    style={{ background: avatarBg, boxShadow: '0 3px 10px rgba(79,70,229,0.25)' }}
                  >
                    {student.name[0].toUpperCase()}
                  </Link>

                  {/* Info — tapping name/info navigates to detail */}
                  <Link href={`/students/${student.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{student.name}</p>
                      {hasCritical && <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />}
                      {isSaved && <Check size={13} className="text-emerald-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-slate-400 font-medium">Roll #{student.rollNumber}</p>
                      {student.studentCode && (
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); copyStudentCode(student.studentCode!, student.id) }}
                          className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] font-black text-indigo-600 tracking-wider active:scale-95 transition-transform"
                          title="Copy Student ID"
                        >
                          {student.studentCode}
                          {copiedStudentId === student.id
                            ? <Check size={9} className="text-emerald-500" />
                            : <Copy size={9} className="text-indigo-400" />}
                        </button>
                      )}
                    </div>
                    {student.interests.length > 0 ? (
                      <p className="text-xs text-blue-500 mt-0.5">
                        {student.interests.slice(0, 3).join(' · ')}
                        {student.interests.length > 3 && ` +${student.interests.length - 3}`}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-500 font-semibold mt-0.5">No interests yet</p>
                    )}
                  </Link>

                  {/* Right side */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {avgMastery > 0 && (
                      <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', getMasteryColor(avgMastery))}>
                        {getMasteryLabel(avgMastery)}
                      </span>
                    )}
                    {/* Edit interests button */}
                    <button
                      onClick={e => openEditor(e, student.id, student.interests, student.goal)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 active:bg-slate-200 transition-colors"
                      title="Edit interests"
                    >
                      {isExpanded ? <ChevronUp size={15} className="text-blue-600" /> : <Pencil size={13} className="text-slate-500" />}
                    </button>
                    {/* Navigate to detail */}
                    <Link
                      href={`/students/${student.id}`}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 active:bg-slate-200 transition-colors"
                    >
                      <ChevronRight size={15} className="text-slate-500" />
                    </Link>
                  </div>
                </div>

                {/* Expanded: interest + goal editor */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                        Interests <span className="text-violet-500 normal-case font-normal">· AI uses these for class engagement</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {INTERESTS.map(({ label, emoji }) => (
                          <button
                            key={label}
                            onClick={() => toggleInterest(student.id, label)}
                            className={clsx(
                              'px-3 py-1.5 rounded-2xl text-sm font-semibold transition-all active:scale-95',
                              localInterests.includes(label)
                                ? 'bg-blue-700 text-white'
                                : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {emoji} {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Goal / Ambition</p>
                      <input
                        type="text"
                        value={localGoal}
                        onChange={e => setEditGoal(p => ({ ...p, [student.id]: e.target.value }))}
                        placeholder="e.g. Wants to become a doctor"
                        className="input-field text-sm"
                      />
                    </div>


                    <button
                      onClick={e => handleSaveProfile(e, student.id)}
                      disabled={saving === student.id}
                      className="w-full py-2.5 rounded-2xl bg-blue-700 text-white text-sm font-bold active:scale-95 transition-transform"
                    >
                      {saving === student.id ? 'Saving…' : 'Save Profile'}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} classId={classId} />
    </div>
  )
}
