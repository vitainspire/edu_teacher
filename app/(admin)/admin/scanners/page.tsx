'use client'
import { useEffect, useState } from 'react'
import { useAdmin } from '@/lib/admin-context'
import { ScanLine, Trash2, Loader2, UserPlus, X, Eye, EyeOff } from 'lucide-react'

interface Scanner {
  id: string
  name: string
  email: string
  created_at: string
}

interface CreateForm {
  name: string
  email: string
  password: string
}

const EMPTY_FORM: CreateForm = { name: '', email: '', password: '' }

export default function ScannersPage() {
  const { school } = useAdmin()
  const [scanners, setScanners]   = useState<Scanner[]>([])
  const [loading, setLoading]     = useState(true)
  const [removing, setRemoving]   = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState<CreateForm>(EMPTY_FORM)
  const [creating, setCreating]   = useState(false)
  const [createError, setCreateError] = useState('')
  const [showPw, setShowPw]       = useState(false)

  function load() {
    if (!school) { setLoading(false); return }
    fetch(`/api/admin/schools/${school.id}/scanners`)
      .then(r => r.json())
      .then(d => setScanners(d.scanners ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [school])

  async function removeScanner(scannerId: string) {
    if (!school) return
    if (!confirm('Remove this scanner account?')) return
    setRemoving(scannerId)
    await fetch(`/api/admin/schools/${school.id}/scanners`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scannerId }),
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
    const res = await fetch(`/api/admin/schools/${school.id}/scanners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setCreateError(data.error ?? 'Failed to create scanner account.'); return }
    setShowModal(false)
    setForm(EMPTY_FORM)
    load()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-indigo-600" /> Scanner Staff
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {scanners.length} scanner account{scanners.length !== 1 ? 's' : ''} in {school?.name}
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setCreateError('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ background: '#4338ca' }}
        >
          <UserPlus className="w-4 h-4" /> Add Scanner
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4">
        <p className="text-sm font-semibold text-indigo-800 mb-1">How scanner accounts work</p>
        <p className="text-xs text-indigo-600 leading-relaxed">
          Create an account for each staff member who scans answer sheets. Give them the email and password you set here.
          They log in at the Scanner portal — no school code needed. Their account is automatically linked to <strong>{school?.name}</strong>.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      ) : scanners.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <ScanLine className="w-7 h-7 text-indigo-300" />
          </div>
          <p className="text-gray-500 font-medium">No scanner accounts yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "Add Scanner" to create an account for scanning staff</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Email</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {scanners.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg, #0d1b3e, #1e3a8a)' }}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{s.email}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => removeScanner(s.id)}
                      disabled={removing === s.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {removing === s.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Scanner Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Add Scanner Account</h2>
              <button onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="scanner@school.edu.in"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Password * (min 6 chars)</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Give this to the scanning staff"
                    className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Share these credentials with the staff member.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#4338ca' }}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
