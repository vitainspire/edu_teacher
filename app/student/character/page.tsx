'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { Student, Class } from '@/lib/types'

// ── Traits ────────────────────────────────────────────────────────────────────

interface TraitDef {
  id:    string
  name:  string
  emoji: string
  color: string
  bg:    string
  border: string
  tagline: string
}

const TRAITS: TraitDef[] = [
  { id: 'patience',       name: 'Patience',       emoji: '🌱', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', tagline: 'Good things take time' },
  { id: 'kindness',       name: 'Kindness',       emoji: '💝', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3', tagline: 'Small acts, big smiles' },
  { id: 'honesty',        name: 'Honesty',        emoji: '✨', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', tagline: 'Truth builds trust' },
  { id: 'courage',        name: 'Courage',        emoji: '🦁', color: '#d97706', bg: '#fffbeb', border: '#fde68a', tagline: 'Brave, not fearless' },
  { id: 'perseverance',   name: 'Perseverance',   emoji: '🚀', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', tagline: 'Keep trying, keep growing' },
  { id: 'responsibility', name: 'Responsibility', emoji: '⭐', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', tagline: 'Your actions matter' },
  { id: 'respect',        name: 'Respect',        emoji: '🤝', color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd', tagline: 'Treat others well' },
  { id: 'gratitude',      name: 'Gratitude',      emoji: '🙏', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', tagline: 'Be thankful for today' },
  { id: 'empathy',        name: 'Empathy',        emoji: '💫', color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', tagline: 'Feel what others feel' },
  { id: 'fairness',       name: 'Fairness',       emoji: '⚖️', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', tagline: 'Everyone deserves equal' },
  { id: 'creativity',     name: 'Creativity',     emoji: '🎨', color: '#9333ea', bg: '#faf5ff', border: '#d8b4fe', tagline: 'Imagine, then create' },
  { id: 'helpfulness',    name: 'Helpfulness',    emoji: '🌟', color: '#16a34a', bg: '#f0fdf4', border: '#86efac', tagline: 'Give without keeping score' },
]

// Which trait is featured this week (rotates automatically)
function getFeaturedTrait(): TraitDef {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const week = Math.floor(Date.now() / msPerWeek)
  return TRAITS[week % TRAITS.length]
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoryData {
  title: string
  story: string
  reflectionQuestion: string
}

type StoryPhase = 'idle' | 'loading' | 'loaded' | 'error'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CharacterCornerPage() {
  const router = useRouter()

  const [student,       setStudent]       = useState<Student | null>(null)
  const [cls,           setCls]           = useState<Class | null>(null)
  const [completedTraits, setCompleted]   = useState<Set<string>>(new Set())
  const [loading,       setLoading]       = useState(true)

  const [activeTrait,   setActiveTrait]   = useState<TraitDef | null>(null)
  const [storyPhase,    setStoryPhase]    = useState<StoryPhase>('idle')
  const [storyData,     setStoryData]     = useState<StoryData | null>(null)
  const [storyCache,    setStoryCache]    = useState<Map<string, StoryData>>(new Map())
  const [markingDone,   setMarkingDone]   = useState(false)

  const initDone = useRef(false)

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    if (!localStorage.getItem('eduteach_student_session')) { router.replace('/student/login'); return }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    try {
      const [initRes, progressRes] = await Promise.all([
        fetch('/api/student/init'),
        fetch('/api/personality-progress'),
      ])
      if (!initRes.ok) { router.replace('/student/login'); return }
      const data = await initRes.json()
      setStudent(data.student)
      setCls(data.primaryClass)

      if (progressRes.ok) {
        const pData = await progressRes.json()
        if (Array.isArray(pData.progress)) {
          setCompleted(new Set((pData.progress as { trait: string }[]).map(p => p.trait)))
        }
      }
    } catch {
      router.replace('/student/login')
    } finally {
      setLoading(false)
    }
  }

  async function openTrait(trait: TraitDef) {
    setActiveTrait(trait)

    // Use cache if available
    const cached = storyCache.get(trait.id)
    if (cached) { setStoryData(cached); setStoryPhase('loaded'); return }

    setStoryPhase('loading')
    setStoryData(null)

    try {
      const params = new URLSearchParams({
        trait: trait.id,
        grade: cls?.grade ?? '5',
        name:  student?.name?.split(' ')[0] ?? 'Student',
      })
      const res = await fetch(`/api/personality-story?${params}`)
      if (!res.ok) throw new Error('Story generation failed')
      const data: StoryData = await res.json()
      setStoryData(data)
      setStoryCache(prev => new Map(prev).set(trait.id, data))
      setStoryPhase('loaded')
    } catch {
      setStoryPhase('error')
    }
  }

  async function markRead() {
    if (!activeTrait || completedTraits.has(activeTrait.id)) return
    setMarkingDone(true)
    try {
      await fetch('/api/personality-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trait: activeTrait.id, storyTitle: storyData?.title }),
      })
      setCompleted(prev => new Set([...prev, activeTrait.id]))
    } catch { /* silent — will retry next time */ }
    setMarkingDone(false)
  }

  function closeTrait() {
    setActiveTrait(null)
    setStoryPhase('idle')
    setStoryData(null)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3ff' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="animate-spin" style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid #ddd6fe', borderTopColor: '#7c3aed', margin: '0 auto 12px' }} />
        <p style={{ color: '#a78bfa', fontSize: 13, fontWeight: 500 }}>Loading Character Corner…</p>
      </div>
    </div>
  )
  if (!student) return null

  const featured    = getFeaturedTrait()
  const earnedCount = completedTraits.size
  const firstName   = student.name?.split(' ')[0] ?? student.name

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ff', fontFamily: 'var(--font-jakarta), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{ background: '#fff', borderBottom: '2px solid #ede9fe', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 12px rgba(124,58,237,0.07)' }}>
        <button onClick={() => router.push('/student/home')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1.5px solid #ede9fe', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#7c3aed', fontFamily: 'inherit' }}>
          <ArrowLeft size={14} /> Back to Home
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>
            {(student.name?.[0] ?? '?').toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{student.name}</p>
            <p style={{ fontSize: 10.5, color: '#a78bfa', marginTop: 2 }}>Character Corner</p>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 24px 72px' }}>

        {/* Title */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 36 }}>🌟</span>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#3b0764', letterSpacing: -0.5 }}>
              Character Corner
            </h1>
          </div>
          <p style={{ fontSize: 15, color: '#6d28d9', fontWeight: 500, marginLeft: 48 }}>
            Hello {firstName}! Read stories that help you grow as a person.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #ede9fe', padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 32 }}>
            {earnedCount === TRAITS.length ? '🏆' : earnedCount >= 6 ? '🌈' : earnedCount >= 3 ? '🌱' : '📖'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#3b0764' }}>
                {earnedCount === 0
                  ? 'Start your character journey!'
                  : earnedCount === TRAITS.length
                  ? 'You explored every character trait!'
                  : `You explored ${earnedCount} of ${TRAITS.length} character traits!`}
              </p>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                {earnedCount}/{TRAITS.length}
              </p>
            </div>
            <div style={{ height: 10, background: '#ede9fe', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 6, width: `${Math.round((earnedCount / TRAITS.length) * 100)}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)', transition: 'width .5s' }} />
            </div>
          </div>
        </div>

        {/* This week's featured trait */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 10 }}>
            This Week&apos;s Character Focus
          </p>
          <button
            onClick={() => openTrait(featured)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px', borderRadius: 20, border: `2px solid ${featured.border}`, background: featured.bg, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
            <span style={{ fontSize: 44, lineHeight: 1, flexShrink: 0 }}>{featured.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <p style={{ fontSize: 20, fontWeight: 900, color: featured.color }}>{featured.name}</p>
                {completedTraits.has(featured.id) && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>Read ✓</span>
                )}
              </div>
              <p style={{ fontSize: 14, color: featured.color, fontWeight: 500, opacity: 0.85 }}>{featured.tagline}</p>
            </div>
            <div style={{ padding: '10px 20px', borderRadius: 14, background: featured.color, color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
              {completedTraits.has(featured.id) ? 'Read Again' : 'Read Story →'}
            </div>
          </button>
        </div>

        {/* All traits grid */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 12 }}>
            All Traits
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {TRAITS.map(trait => {
              const done = completedTraits.has(trait.id)
              return (
                <button key={trait.id}
                  onClick={() => openTrait(trait)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '16px 18px', borderRadius: 18, border: `1.5px solid ${done ? trait.border : '#e2e8f0'}`, background: done ? trait.bg : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: 28 }}>{trait.emoji}</span>
                    {done && <span style={{ fontSize: 14 }}>✅</span>}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: done ? trait.color : '#1e293b' }}>{trait.name}</p>
                    <p style={{ fontSize: 11, color: done ? trait.color : '#94a3b8', marginTop: 2, fontWeight: 500, opacity: done ? 0.8 : 1 }}>{trait.tagline}</p>
                  </div>
                  {trait.id === featured.id && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#7c3aed', background: '#ede9fe', padding: '2px 7px', borderRadius: 8, letterSpacing: '.06em', textTransform: 'uppercase' }}>This week</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Story reader overlay ── */}
      {activeTrait && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(59,7,100,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) closeTrait() }}>
          <div style={{ background: '#fff', borderRadius: 28, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Modal header */}
            <div style={{ padding: '22px 26px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: activeTrait.bg, border: `2px solid ${activeTrait.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                {activeTrait.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 18, fontWeight: 900, color: activeTrait.color }}>{activeTrait.name}</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{activeTrait.tagline}</p>
              </div>
              <button onClick={closeTrait}
                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b', fontFamily: 'inherit', flexShrink: 0 }}>
                ✕
              </button>
            </div>

            {/* Story content */}
            <div style={{ padding: '20px 26px 26px', flex: 1 }}>
              {storyPhase === 'loading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                  <Loader2 size={28} className="animate-spin" style={{ color: activeTrait.color }} />
                  <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Writing your story…</p>
                </div>
              )}

              {storyPhase === 'error' && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <span style={{ fontSize: 36 }}>😕</span>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginTop: 12 }}>Couldn&apos;t load the story</p>
                  <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Please check your connection and try again.</p>
                  <button onClick={() => openTrait(activeTrait)}
                    style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12, background: activeTrait.color, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Try Again
                  </button>
                </div>
              )}

              {storyPhase === 'loaded' && storyData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {/* Story title */}
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', lineHeight: 1.4, textAlign: 'center', padding: '0 8px' }}>
                    {storyData.title}
                  </h2>

                  {/* Story text */}
                  <div style={{ background: activeTrait.bg, borderRadius: 16, padding: '18px 20px', border: `1px solid ${activeTrait.border}` }}>
                    {storyData.story.split('\n\n').map((para, i) => (
                      <p key={i} style={{ fontSize: 14, lineHeight: 1.8, color: '#1e293b', marginBottom: i < storyData.story.split('\n\n').length - 1 ? 12 : 0 }}>
                        {para}
                      </p>
                    ))}
                  </div>

                  {/* Reflection question */}
                  <div style={{ borderRadius: 16, padding: '16px 20px', background: '#fff', border: `1.5px solid ${activeTrait.border}` }}>
                    <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: activeTrait.color, marginBottom: 8 }}>
                      Think about it 💭
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', lineHeight: 1.7 }}>
                      {storyData.reflectionQuestion}
                    </p>
                  </div>

                  {/* Mark as read */}
                  {completedTraits.has(activeTrait.id) ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 14, background: '#ecfdf5', border: '1.5px solid #a7f3d0' }}>
                      <span style={{ fontSize: 18 }}>✅</span>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>
                        You&apos;ve read this story — well done!
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={markRead}
                      disabled={markingDone}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 14, background: `linear-gradient(135deg, ${activeTrait.color}, ${activeTrait.color}cc)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: markingDone ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      {markingDone
                        ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                        : <>✓ I&apos;ve read this story!</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
