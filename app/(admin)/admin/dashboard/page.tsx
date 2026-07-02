'use client'
import { useEffect, useState, useRef } from 'react'
import { useAdmin } from '@/lib/admin-context'
import { Loader2, ArrowRight, Users, BookOpen, GraduationCap, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Overview {
  teacherCount: number
  classCount: number
  studentCount: number
  timetableCoverage: number
  totalPeriods: number
}

// ── Rolling counter ────────────────────────────────────────────────────────
function RollingNumber({ target, delay = 0 }: { target: number; delay?: number }) {
  const [val, setVal] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    let start: number | null = null
    const duration = 1600
    const step = (ts: number) => {
      if (!start) start = ts + delay
      if (ts < start) { raf.current = requestAnimationFrame(step); return }
      const p = Math.min((ts - start) / duration, 1)
      const e = 1 - Math.pow(1 - p, 4)
      setVal(Math.round(target * e))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, delay])
  return <>{val}</>
}

// ── 3-D magic card ─────────────────────────────────────────────────────────
interface CardDef {
  label: string; sublabel: string; value: number; delay: number
  gradient: string; shimmer: string; glow: string; accent: string
  href: string; Icon: LucideIcon
  Decor: React.FC
}

function MagicCard({ card, visible }: { card: CardDef; visible: boolean }) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [shine, setShine] = useState({ x: 50, y: 50 })
  const [over, setOver] = useState(false)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    setTilt({ rx: (0.5 - y) * 16, ry: (x - 0.5) * 20 })
    setShine({ x: x * 100, y: y * 100 })
  }
  function onLeave() { setTilt({ rx: 0, ry: 0 }); setShine({ x: 50, y: 50 }); setOver(false) }

  return (
    <div
      ref={ref}
      onMouseMove={onMove} onMouseEnter={() => setOver(true)} onMouseLeave={onLeave}
      onClick={() => router.push(card.href)}
      className="cursor-pointer select-none"
      style={{
        perspective: '900px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(60px)',
        transition: `opacity 0.6s ease ${card.delay}ms, transform 0.6s cubic-bezier(0.34,1.46,0.64,1) ${card.delay}ms`,
      }}>

      <div style={{
        position: 'relative',
        borderRadius: 28,
        overflow: 'hidden',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${over ? 1.04 : 1})`,
        transition: over ? 'transform 0.08s linear' : 'transform 0.7s cubic-bezier(0.23,1,0.32,1)',
        boxShadow: over
          ? `0 30px 70px ${card.glow}, 0 0 0 1px rgba(255,255,255,0.1)`
          : `0 12px 40px ${card.glow}, 0 0 0 1px rgba(255,255,255,0.06)`,
      }}>

        {/* ── Animated gradient bg ── */}
        <div style={{
          position: 'absolute', inset: 0,
          background: card.gradient,
          backgroundSize: '300% 300%',
          animation: 'gradDrift 8s ease infinite',
        }} />

        {/* ── Decorative art layer ── */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
          <card.Decor />
        </div>

        {/* ── Mouse-tracking specular shine ── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, ${card.shimmer} 0%, transparent 55%)`,
          transition: over ? 'none' : 'background 0.4s',
        }} />

        {/* ── Top strip: icon + label ── */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2.5">
            <div style={{
              width: 40, height: 40, borderRadius: 14,
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'translateZ(20px)',
            }}>
              <card.Icon size={18} className="text-white" />
            </div>
            <span style={{
              fontSize: 12, fontWeight: 700, color: card.accent,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>{card.label}</span>
          </div>
          <div style={{
            padding: '5px 10px', borderRadius: 20,
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)',
            transform: 'translateZ(14px)',
          }}>
            Go <ArrowRight size={11} />
          </div>
        </div>

        {/* ── Big rolling number ── */}
        <div className="relative z-10 px-6 py-2" style={{ transform: 'translateZ(30px)' }}>
          <div style={{
            fontSize: 80, fontWeight: 900, lineHeight: 1,
            background: 'linear-gradient(160deg, #ffffff 30%, rgba(255,255,255,0.55) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-3px',
          }}>
            {visible ? <RollingNumber target={card.value} delay={card.delay} /> : '0'}
          </div>
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600,
            marginTop: 2, letterSpacing: '0.02em',
          }}>{card.sublabel}</p>
        </div>

        {/* ── Frosted glass bottom strip ── */}
        <div style={{
          position: 'relative', zIndex: 10,
          margin: '8px 10px 10px',
          borderRadius: 18,
          padding: '12px 16px',
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            {card.value === 0 ? 'None added yet' : `${card.value} total`}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.min(card.value, 5) }).map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: card.accent, opacity: 0.6 + i * 0.08,
                transform: `scale(${0.7 + i * 0.1})`,
              }} />
            ))}
            {card.value > 5 && (
              <span style={{ fontSize: 10, color: card.accent, fontWeight: 700, marginLeft: 2 }}>
                +{card.value - 5}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Decorative SVGs ────────────────────────────────────────────────────────

function TeacherDecor() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 340 260" fill="none" preserveAspectRatio="xMidYMid slice">
      <circle cx="270" cy="-20" r="140" stroke="rgba(255,255,255,0.12)" strokeWidth="40" />
      <circle cx="270" cy="-20" r="90" stroke="rgba(255,255,255,0.08)" strokeWidth="20" />
      <circle cx="-30" cy="220" r="120" stroke="rgba(255,255,255,0.07)" strokeWidth="30" />
      <rect x="60" y="60" width="100" height="130" rx="8" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
      <line x1="74" y1="88" x2="144" y2="88" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="74" y1="104" x2="150" y2="104" stroke="rgba(255,255,255,0.14)" strokeWidth="2" strokeLinecap="round" />
      <line x1="74" y1="120" x2="138" y2="120" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="200" cy="95" r="28" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      <line x1="182" y1="125" x2="182" y2="168" stroke="rgba(255,255,255,0.12)" strokeWidth="12" strokeLinecap="round" />
      <line x1="165" y1="132" x2="155" y2="110" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function ClassesDecor() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 340 260" fill="none" preserveAspectRatio="xMidYMid slice">
      <circle cx="300" cy="30" r="110" stroke="rgba(255,255,255,0.1)" strokeWidth="35" />
      <rect x="40" y="80" width="72" height="100" rx="6" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
      <rect x="40" y="80" width="10" height="100" fill="rgba(255,255,255,0.12)" rx="3" />
      <rect x="76" y="60" width="80" height="110" rx="6" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      <rect x="76" y="60" width="10" height="110" fill="rgba(255,255,255,0.15)" rx="3" />
      <rect x="116" y="42" width="86" height="118" rx="6" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
      <rect x="116" y="42" width="10" height="118" fill="rgba(255,255,255,0.2)" rx="3" />
      <line x1="136" y1="68" x2="190" y2="68" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
      <line x1="136" y1="82" x2="190" y2="82" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="136" y1="96" x2="182" y2="96" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="-20" cy="240" r="100" stroke="rgba(255,255,255,0.06)" strokeWidth="25" />
    </svg>
  )
}

function StudentsDecor() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 340 260" fill="none" preserveAspectRatio="xMidYMid slice">
      <polygon points="170,10 280,65 170,120 60,65" stroke="rgba(255,255,255,0.18)" strokeWidth="2" fill="rgba(255,255,255,0.04)" />
      <polygon points="170,10 280,65 170,120 60,65" stroke="rgba(255,255,255,0.08)" strokeWidth="16" fill="none" />
      <rect x="162" y="65" width="16" height="50" rx="4" fill="rgba(255,255,255,0.12)" />
      <path d="M278 65 Q292 75 288 98" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="288" cy="100" r="6" fill="rgba(255,255,255,0.2)" />
      <line x1="285" y1="105" x2="282" y2="122" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="288" y1="105" x2="288" y2="123" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="291" y1="105" x2="294" y2="122" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
      {[40, 100, 160, 220, 280].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={180} r={18} stroke="rgba(255,255,255,0.16)" strokeWidth="2" fill="rgba(255,255,255,0.05)" />
          <circle cx={x} cy={172} r={9} fill="rgba(255,255,255,0.12)" />
          <rect x={x - 12} y={192} width={24} height={18} rx={5} fill="rgba(255,255,255,0.08)" />
        </g>
      ))}
      <circle cx="-10" cy="-10" r="100" stroke="rgba(255,255,255,0.06)" strokeWidth="30" />
    </svg>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { admin, school } = useAdmin()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!school) { setLoading(false); return }
    fetch(`/api/admin/schools/${school.id}/overview`)
      .then(r => r.json())
      .then(d => { setOverview(d); setTimeout(() => setVisible(true), 100) })
      .finally(() => setLoading(false))
  }, [school])

  const CARDS: CardDef[] = [
    {
      label: 'Teachers', sublabel: 'on teaching staff',
      value: overview?.teacherCount ?? 0, delay: 0,
      gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 40%, #7c3aed 100%)',
      shimmer: 'rgba(167,139,250,0.35)',
      glow: 'rgba(99,102,241,0.45)',
      accent: '#c4b5fd',
      href: '/admin/teachers', Icon: Users, Decor: TeacherDecor,
    },
    {
      label: 'Classes', sublabel: 'active this year',
      value: overview?.classCount ?? 0, delay: 130,
      gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 40%, #0891b2 100%)',
      shimmer: 'rgba(125,211,252,0.3)',
      glow: 'rgba(14,116,144,0.45)',
      accent: '#7dd3fc',
      href: '/admin/classes', Icon: BookOpen, Decor: ClassesDecor,
    },
    {
      label: 'Students', sublabel: 'enrolled across all classes',
      value: overview?.studentCount ?? 0, delay: 260,
      gradient: 'linear-gradient(135deg, #064e3b 0%, #047857 40%, #059669 100%)',
      shimmer: 'rgba(110,231,183,0.3)',
      glow: 'rgba(5,150,105,0.45)',
      accent: '#6ee7b7',
      href: '/admin/classes', Icon: GraduationCap, Decor: StudentsDecor,
    },
  ]

  return (
    <>
      {/* ── Keyframe injector ── */}
      <style>{`
        @keyframes gradDrift {
          0%   { background-position: 0% 50% }
          50%  { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
        @keyframes floatUp {
          0%,100% { transform: translateY(0px) }
          50%      { transform: translateY(-8px) }
        }
      `}</style>

      <div className="p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Admin Portal</p>
          <h1 className="text-3xl font-black text-gray-900">
            Welcome back, {admin?.name?.split(' ')[0] ?? 'Admin'}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{school?.name} — School Overview</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-36">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {/* ── Magic stat cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              {CARDS.map(card => (
                <MagicCard key={card.label} card={card} visible={visible} />
              ))}
            </div>

            {/* ── Quick Actions ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Quick Actions</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Add Teachers', href: '/admin/teachers', desc: 'Invite teaching staff', emoji: '👩‍🏫', bg: '#eef2ff', color: '#4338ca' },
                  { label: 'Create Classes', href: '/admin/classes', desc: 'Set up class sections', emoji: '📚', bg: '#ecfeff', color: '#0e7490' },
                  { label: 'Build Timetable', href: '/admin/timetable', desc: 'Schedule & assign periods', emoji: '🗓️', bg: '#ecfdf5', color: '#047857' },
                ].map(a => (
                  <button key={a.href} onClick={() => router.push(a.href)}
                    className="text-left rounded-2xl p-4 hover:shadow-md transition-all active:scale-95"
                    style={{ background: a.bg }}>
                    <p className="text-xl mb-2">{a.emoji}</p>
                    <p className="font-bold text-gray-800 text-sm">{a.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: a.color }}>{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
