'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, BookOpen, CalendarDays, LogOut, GraduationCap, ScanLine } from 'lucide-react'
import { useAdmin } from '@/lib/admin-context'

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/teachers',  label: 'Teachers',  icon: Users },
  { href: '/admin/classes',   label: 'Classes',   icon: BookOpen },
  { href: '/admin/timetable', label: 'Timetable', icon: CalendarDays },
  { href: '/admin/scanners',  label: 'Scanners',  icon: ScanLine },
]

export default function AdminSideNav() {
  const pathname = usePathname()
  const { admin, school, logout } = useAdmin()

  return (
    <>
      <style>{`
        @keyframes edgeGlow {
          0%,100% { opacity:.4 } 50% { opacity:1 }
        }
        @keyframes avatarPulse {
          0%,100% { box-shadow:0 0 0 0 rgba(99,102,241,0.4) }
          50%      { box-shadow:0 0 0 5px rgba(99,102,241,0) }
        }
        .admin-nav-item:hover .admin-nav-icon { color: #a5b4fc !important; }
        .admin-nav-item:hover .admin-nav-label { color: rgba(255,255,255,0.75) !important; }
        .admin-nav-item:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>

      <aside className="hidden md:flex flex-col" style={{
        width: 232,
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #08061a 0%, #0f0c29 40%, #110e2e 100%)',
        position: 'relative',
        flexShrink: 0,
      }}>

        {/* Glowing right border */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 1,
          background: 'linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.5) 25%, rgba(139,92,246,0.6) 55%, rgba(99,102,241,0.4) 80%, transparent 100%)',
          animation: 'edgeGlow 5s ease-in-out infinite',
        }} />

        {/* ── Brand ── */}
        <div style={{ padding: '26px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(99,102,241,0.55)',
            }}>
              <GraduationCap size={20} color="white" strokeWidth={2} />
            </div>
            <div>
              <p style={{
                fontSize: 16, fontWeight: 900, lineHeight: 1.1,
                background: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>EduTeach</p>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'rgba(165,180,252,0.5)',
                marginTop: 1,
              }}>Admin Portal</p>
            </div>
          </div>
        </div>

        {/* ── School badge ── */}
        {school && (
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{
              padding: '9px 12px', borderRadius: 11,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <p style={{
                fontSize: 8, fontWeight: 800, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: 'rgba(165,180,252,0.45)', marginBottom: 3,
              }}>School</p>
              <p style={{
                fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{school.name}</p>
            </div>
          </div>
        )}

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div className="admin-nav-item" style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 13px', borderRadius: 12,
                  background: active ? 'rgba(99,102,241,0.16)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(99,102,241,0.28)' : 'transparent'}`,
                  boxShadow: active ? '0 2px 18px rgba(99,102,241,0.14), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
                  cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  transition: 'background 0.2s, border-color 0.2s',
                }}>

                  {/* Active left accent bar */}
                  {active && (
                    <div style={{
                      position: 'absolute', left: 0, top: '20%', bottom: '20%',
                      width: 3, borderRadius: '0 3px 3px 0',
                      background: 'linear-gradient(180deg, #818cf8, #a78bfa)',
                      boxShadow: '0 0 10px rgba(129,140,248,0.7)',
                    }} />
                  )}

                  {/* Active shimmer sweep */}
                  {active && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(90deg, transparent 0%, rgba(129,140,248,0.06) 50%, transparent 100%)',
                      pointerEvents: 'none',
                    }} />
                  )}

                  <Icon
                    className="admin-nav-icon"
                    size={16}
                    strokeWidth={active ? 2.5 : 1.8}
                    style={{ color: active ? '#a5b4fc' : 'rgba(255,255,255,0.3)', flexShrink: 0, transition: 'color 0.2s' }}
                  />
                  <span className="admin-nav-label" style={{
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    color: active ? '#e0e7ff' : 'rgba(255,255,255,0.38)',
                    letterSpacing: '0.01em', transition: 'color 0.2s',
                  }}>{label}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* ── Profile card ── */}
        <div style={{ padding: '10px 10px 14px' }}>
          <div style={{
            borderRadius: 16, padding: '12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 900, color: 'white',
                boxShadow: '0 2px 12px rgba(79,70,229,0.5)',
                animation: 'avatarPulse 3s ease-in-out infinite',
              }}>
                {admin?.name?.charAt(0).toUpperCase() ?? 'A'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12, fontWeight: 700,
                  color: 'rgba(255,255,255,0.85)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{admin?.name ?? 'Admin'}</p>
                <p style={{
                  fontSize: 10, color: 'rgba(165,180,252,0.45)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginTop: 1,
                }}>{admin?.email ?? ''}</p>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={logout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 7,
                padding: '7px 10px', borderRadius: 9, cursor: 'pointer',
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.18)',
                fontSize: 11, fontWeight: 600, color: 'rgba(252,165,165,0.65)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                const b = e.currentTarget
                b.style.background = 'rgba(239,68,68,0.16)'
                b.style.color = '#fca5a5'
                b.style.borderColor = 'rgba(239,68,68,0.38)'
              }}
              onMouseLeave={e => {
                const b = e.currentTarget
                b.style.background = 'rgba(239,68,68,0.07)'
                b.style.color = 'rgba(252,165,165,0.65)'
                b.style.borderColor = 'rgba(239,68,68,0.18)'
              }}
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>

      </aside>
    </>
  )
}
