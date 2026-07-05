'use client'
import { useRouter } from 'next/navigation'
import { GraduationCap, BookOpen, ScanLine, ShieldCheck, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      color: '#0f172a',
      fontFamily: 'var(--font-jakarta), -apple-system, "Segoe UI", system-ui, sans-serif',
      overflowX: 'hidden',
    }}>
      <style>{`
        @media (max-width: 768px) {
          .et-nav { padding: 0 20px !important; }
          .et-hero { grid-template-columns: 1fr !important; gap: 36px !important; padding: 48px 20px 56px !important; }
          .et-mockup { display: none !important; }
          .et-portals { grid-template-columns: 1fr 1fr !important; }
          .et-portals-section { padding: 56px 20px !important; }
          .et-problem { grid-template-columns: 1fr !important; gap: 36px !important; padding: 56px 20px !important; }
          .et-steps { grid-template-columns: 1fr !important; }
          .et-steps-line { display: none !important; }
          .et-steps-section { padding: 56px 20px !important; }
          .et-cta-inner { flex-direction: column !important; gap: 24px !important; padding: 48px 20px !important; }
          .et-footer { padding: 18px 20px !important; }
          .et-ba-row { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .et-portals { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ──────────────── NAV ──────────────── */}
      <nav className="et-nav" style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 58, padding: '0 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff',
        borderBottom: '1.5px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, background: '#1d4ed8', borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GraduationCap size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: -0.3 }}>EduTeach</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/features" style={{
            fontSize: 13.5, fontWeight: 600, color: '#64748b', textDecoration: 'none',
          }}>
            How it works
          </a>
          <button
            onClick={() => router.push('/portals')}
            style={{
              padding: '8px 20px', background: '#1d4ed8', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ──────────────── HERO ──────────────── */}
      <section className="et-hero" style={{
        maxWidth: 1100, margin: '0 auto', padding: '80px 48px 88px',
        display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 64, alignItems: 'center',
      }}>
        {/* Left: copy */}
        <div>
          <p style={{
            fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: '#c2410c', marginBottom: 22,
          }}>
            Built for Indian Schools
          </p>
          <h1 style={{
            fontSize: 'clamp(42px, 5.5vw, 72px)', fontWeight: 900, lineHeight: 1.05,
            letterSpacing: -2, color: '#0f172a', margin: '0 0 24px',
          }}>
            Every absent<br />student gets<br />a catch-up plan.
          </h1>
          <p style={{
            fontSize: 17, color: '#475569', lineHeight: 1.75, maxWidth: 420, margin: '0 0 36px',
          }}>
            Mark attendance. Give a test. EduTeach generates a personalised
            catch-up plan for each student who missed class — in under 30 seconds,
            without any extra typing.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/portals')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '13px 28px', background: '#1d4ed8', color: '#fff',
                border: 'none', borderRadius: 7, fontSize: 14.5, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Get Started <ArrowRight size={15} />
            </button>
            <a href="/features" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '13px 26px', background: '#fff', color: '#0f172a',
              border: '1.5px solid #cbd5e1', borderRadius: 7, fontSize: 14.5, fontWeight: 700,
              cursor: 'pointer', textDecoration: 'none',
            }}>
              Learn More <ArrowRight size={14} />
            </a>
          </div>
        </div>

        {/* Right: product mockup */}
        <div className="et-mockup" style={{
          background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden',
        }}>
          {/* Browser chrome */}
          <div style={{
            padding: '10px 14px', background: '#fff', borderBottom: '1.5px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#fca5a5' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#fde68a' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#a7f3d0' }} />
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8, fontWeight: 500 }}>
              Teacher Portal · Class 7B
            </span>
          </div>

          <div style={{ padding: '18px 18px 22px' }}>
            {/* Attendance row */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 13px', background: '#fff', borderRadius: 7,
              border: '1px solid #e2e8f0', marginBottom: 10,
            }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>Attendance marked</p>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>32 present · 6 absent</p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#15803d',
                background: '#dcfce7', padding: '3px 8px', borderRadius: 4,
              }}>✓ Done</span>
            </div>

            {/* Plans list */}
            <div style={{
              padding: '13px', background: '#fff', borderRadius: 7,
              border: '1px solid #e2e8f0', marginBottom: 10,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
                6 catch-up plans generated
              </p>
              {[
                { name: 'Priya Sharma', subject: 'Science Ch.5' },
                { name: 'Rohit Kumar', subject: 'Mathematics Q.12' },
                { name: 'Anjali Singh', subject: 'English Grammar' },
              ].map((s, i) => (
                <div key={s.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none',
                }}>
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 600, color: '#1e293b', margin: '0 0 1px' }}>{s.name}</p>
                    <p style={{ fontSize: 10.5, color: '#94a3b8', margin: 0 }}>{s.subject}</p>
                  </div>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, color: '#1d4ed8',
                    background: '#eff6ff', padding: '3px 7px', borderRadius: 4,
                  }}>Ready</span>
                </div>
              ))}
              <p style={{ fontSize: 10.5, color: '#94a3b8', margin: '8px 0 0' }}>+3 more students</p>
            </div>

            {/* Scan row */}
            <div style={{
              padding: '11px 13px', background: '#fff', borderRadius: 7, border: '1px solid #e2e8f0',
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>Last test scanned</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>38 sheets · scored in 2 minutes</p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── PORTALS ──────────────── */}
      <section className="et-portals-section" style={{
        borderTop: '1.5px solid #e2e8f0',
        padding: '64px 48px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{
            fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: '#94a3b8', marginBottom: 32,
          }}>
            Four portals, one system
          </p>
          <div className="et-portals" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0, background: '#e2e8f0', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden',
          }}>
            {[
              {
                icon: ShieldCheck, label: 'Admin Portal', color: '#4f46e5',
                desc: 'Create the school, add teachers, build timetables, and view school-wide reports.',
                href: '/admin/login',
              },
              {
                icon: GraduationCap, label: 'Teacher Portal', color: '#1d4ed8',
                desc: 'Daily attendance, AI catch-up plans, test scanning, and student progress tracking.',
                href: '/login',
              },
              {
                icon: BookOpen, label: 'Student Portal', color: '#15803d',
                desc: 'Personalised study plans, adaptive practice quizzes, and Character Corner stories.',
                href: '/student/login',
              },
              {
                icon: ScanLine, label: 'Scanner Staff', color: '#374151',
                desc: 'Scan answer sheets with any phone camera. AI reads and scores automatically.',
                href: '/scanner',
              },
            ].map(({ icon: Icon, label, color, desc, href }, idx) => (
              <div
                key={label}
                onClick={() => router.push(href)}
                style={{
                  background: '#fff', padding: '28px 22px', cursor: 'pointer',
                  borderRight: idx < 3 ? '1px solid #e2e8f0' : 'none',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f8fafc' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff' }}>
                <div style={{
                  width: 36, height: 36, background: color + '18', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                }}>
                  <Icon size={18} color={color} />
                </div>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{label}</p>
                <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── PROBLEM vs. SOLUTION ──────────────── */}
      <section style={{ background: '#f8fafc', borderTop: '1.5px solid #e2e8f0', borderBottom: '1.5px solid #e2e8f0' }}>
        <div className="et-problem" style={{
          maxWidth: 1100, margin: '0 auto', padding: '72px 48px',
          display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 80, alignItems: 'start',
        }}>
          <div>
            <p style={{
              fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
              color: '#c2410c', marginBottom: 18,
            }}>
              The problem
            </p>
            <h2 style={{
              fontSize: 'clamp(24px, 3.2vw, 38px)', fontWeight: 900, lineHeight: 1.2,
              letterSpacing: -1, color: '#0f172a', margin: 0,
            }}>
              A teacher with 40&nbsp;students shouldn&apos;t spend evenings writing catch-up notes.
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                before: 'Writing 6 individual catch-up notes after class',
                after: 'Plans are generated the moment attendance is marked',
              },
              {
                before: 'Manually correcting 38 answer sheets by hand',
                after: 'Scan with your phone — AI scores every sheet in 2 minutes',
              },
              {
                before: 'Students asking "what should I revise?"',
                after: 'Student portal shows exactly what to study and why',
              },
            ].map(({ before, after }, i) => (
              <div key={i} className="et-ba-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '12px 14px', background: '#fee2e2', borderRadius: 6 }}>
                  <p style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.55, margin: 0 }}>
                    <strong style={{ display: 'block', marginBottom: 3 }}>Before</strong>
                    {before}
                  </p>
                </div>
                <div style={{ padding: '12px 14px', background: '#dcfce7', borderRadius: 6 }}>
                  <p style={{ fontSize: 12, color: '#15803d', lineHeight: 1.55, margin: 0 }}>
                    <strong style={{ display: 'block', marginBottom: 3 }}>After</strong>
                    {after}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── HOW IT WORKS ──────────────── */}
      <section className="et-steps-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 48px' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, marginBottom: 52,
        }}>
          <h2 style={{
            fontSize: 'clamp(22px, 2.8vw, 34px)', fontWeight: 900,
            letterSpacing: -0.8, color: '#0f172a', margin: 0,
          }}>
            How a school day works
          </h2>
          <a href="/features" style={{ fontSize: 13.5, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}>
            Full walkthrough →
          </a>
        </div>

        <div className="et-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', position: 'relative' }}>
          {/* Connector line */}
          <div className="et-steps-line" style={{
            position: 'absolute', top: 19, left: 'calc(16.67% + 1px)', right: 'calc(16.67% + 1px)',
            height: 1.5, background: '#e2e8f0', zIndex: 0,
          }} />
          {[
            {
              num: 1, title: 'Teacher marks attendance',
              detail: 'After each class. Takes 30 seconds. Absent students are automatically flagged for a catch-up plan.',
            },
            {
              num: 2, title: 'AI generates personalised plans',
              detail: 'For each absent or struggling student — tailored to the exact topic they missed, written in their preferred language and context.',
            },
            {
              num: 3, title: 'Student logs in, studies, grows',
              detail: 'The student enters their ID code, reads their plan, takes a practice quiz, and tracks their own progress. No follow-up from the teacher needed.',
            },
          ].map(({ num, title, detail }) => (
            <div key={num} style={{ padding: '0 28px 0 0', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 38, height: 38, background: '#1d4ed8', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{num}</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{title}</p>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, margin: 0 }}>{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────── CTA ──────────────── */}
      <section style={{ background: '#0f172a', borderTop: '1px solid #1e293b' }}>
        <div className="et-cta-inner" style={{
          maxWidth: 1100, margin: '0 auto', padding: '56px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 28,
        }}>
          <div>
            <h2 style={{
              fontSize: 'clamp(20px, 2.8vw, 30px)', fontWeight: 900,
              color: '#fff', letterSpacing: -0.7, margin: '0 0 8px',
            }}>
              Use it today. No setup fees.
            </h2>
            <p style={{ fontSize: 15, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
              Admin, teacher, student, or scanner staff — pick your portal and start.
            </p>
          </div>
          <button
            onClick={() => router.push('/portals')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', background: '#fff', color: '#0f172a',
              border: 'none', borderRadius: 7, fontSize: 15, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}>
            Choose Your Portal <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ──────────────── FOOTER ──────────────── */}
      <footer className="et-footer" style={{
        background: '#0f172a', borderTop: '1px solid #1e293b', padding: '18px 48px',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22, height: 22, background: '#1d4ed8', borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={11} color="#fff" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#475569' }}>EduTeach</span>
          </div>
          <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>by vitainspire</p>
        </div>
      </footer>

    </div>
  )
}
