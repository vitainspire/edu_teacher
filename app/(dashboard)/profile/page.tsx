'use client'
import { useRouter } from 'next/navigation'
import { LogOut, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '@/lib/context'
import PageHeader from '@/components/theme/PageHeader'
import { Sticker, NotebookSticker } from '@/components/theme/StickerIcon'

export default function ProfilePage() {
  const { teacher, logout } = useApp()
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const handleLogout = async () => { await logout(); router.replace('/teacher/login') }

  const rows = [
    { label: 'Name',    value: teacher?.name },
    { label: 'School',  value: teacher?.schoolName },
    { label: 'Subject', value: teacher?.subject },
    { label: 'Grade',   value: teacher?.grade },
  ]

  return (
    <div className="paper-page pb-28">
      <PageHeader title="Profile" />

      <div className="px-5 pt-2 space-y-4 relative z-10">

        <div className="paper-card p-5 flex items-center gap-4">
          <Sticker tone="coral" size={64} radius={20}>
            <NotebookSticker size={34} />
          </Sticker>
          <div className="min-w-0">
            <p className="font-display font-bold text-ink text-lg leading-tight truncate">{teacher?.name ?? 'Teacher'}</p>
            <p className="text-sm text-ink-soft font-medium truncate">{teacher?.subject ?? '—'} · {teacher?.schoolName ?? '—'}</p>
          </div>
        </div>

        <div className="paper-card p-5">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(58,44,30,0.08)' : 'none' }}
            >
              <span className="text-xs font-bold text-ink-soft uppercase tracking-wide">{row.label}</span>
              <span className="text-sm font-bold text-ink">{row.value || '—'}</span>
            </div>
          ))}
        </div>

        {teacher?.teacherCode && (
          <div className="paper-card p-5 space-y-3">
            <p className="font-bold text-ink">Scanner Code</p>
            <p className="text-xs text-ink-soft leading-relaxed">
              Give this to whoever scans your papers — it links scans back to your classes.
            </p>
            <div className="flex items-center gap-3">
              <div
                className="flex-1 rounded-2xl py-3.5 text-center font-black text-2xl"
                style={{ background: 'rgba(58,44,30,0.06)', border: '2px dashed rgba(58,44,30,0.25)', letterSpacing: '0.4em', color: 'var(--ink)' }}
              >
                {teacher.teacherCode}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(teacher.teacherCode!).catch(() => {})
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="w-11 h-11 flex items-center justify-center rounded-2xl transition-all active:scale-90"
                style={{ background: 'rgba(58,44,30,0.06)' }}
              >
                {copied ? <Check size={17} className="text-ink" /> : <Copy size={17} className="text-ink-soft" />}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-red-600 active:scale-95 transition-transform"
          style={{ background: 'rgba(220,38,38,0.08)' }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}
