'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useApp } from '@/lib/context'
import { GraduationCap } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

export default function CreateClassModal({ open, onClose }: Props) {
  const { addClass } = useApp()
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [section, setSection] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim() || !grade) return
    setSaving(true)
    await addClass({ name: name.trim(), grade, section: section.trim() })
    setName(''); setGrade(''); setSection('')
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Class">
      <div className="space-y-5">
        {/* Class name */}
        <div>
          <label className="label">Class Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. Class 6A or Std 7"
            className="input-field"
            autoFocus
          />
        </div>

        {/* Grade picker */}
        <div>
          <label className="label">Grade *</label>
          <div className="grid grid-cols-6 gap-1.5 mt-1">
            {GRADES.map(g => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                  grade === g
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Section picker */}
        <div>
          <label className="label">
            Section <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="flex gap-2 mt-1">
            {['A', 'B', 'C', 'D'].map(s => (
              <button
                key={s}
                onClick={() => setSection(section === s ? '' : s)}
                className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                  section === s
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {(name || grade) && (
          <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-3 border border-blue-100">
            <div className="w-10 h-10 bg-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
              {grade ? (
                <span className="text-white font-black text-base">{grade}</span>
              ) : (
                <GraduationCap size={18} className="text-white" />
              )}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{name || 'Class name…'}</p>
              <p className="text-xs text-slate-500">
                {grade ? `Grade ${grade}` : 'Select grade'}{section ? ` · Section ${section}` : ''}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={!name.trim() || !grade || saving}
          className="btn-primary w-full"
        >
          {saving ? 'Creating…' : 'Create Class'}
        </button>
      </div>
    </Modal>
  )
}
