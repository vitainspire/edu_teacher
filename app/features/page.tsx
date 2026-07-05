'use client'
import { useRouter } from 'next/navigation'
import { GraduationCap, BookOpen, ScanLine, ShieldCheck, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'

const ROLES = [
  {
    icon: ShieldCheck,
    color: '#4f46e5',
    bg: '#eef2ff',
    label: 'Admin',
    tagline: 'Sets up and oversees the whole school',
    steps: [
      { title: 'Create the school account', detail: 'Register your school, set the academic year, and get your admin credentials. One-time setup.' },
      { title: 'Add teachers', detail: 'Create teacher accounts. Each teacher gets their own login with access to their classes only.' },
      { title: 'Build the timetable', detail: 'Set which teacher takes which class, on which days. EduTeach uses this to route attendance and plans correctly.' },
      { title: 'View school-wide reports', detail: 'See attendance rates, AI plan activity, and student progress across all classes from a single dashboard.' },
    ],
    doesntNeedTo: ['Call individual teachers for updates', 'Maintain separate spreadsheets', 'Manually track who is absent school-wide'],
  },
  {
    icon: GraduationCap,
    color: '#1d4ed8',
    bg: '#eff6ff',
    label: 'Teacher',
    tagline: 'Runs the classroom, AI handles the paperwork',
    steps: [
      { title: 'Create a class and add students', detail: 'Name your class, add students by name or roll number, and you\'re ready. Takes about 5 minutes the first time.' },
      { title: 'Mark attendance after every session', detail: 'Open the app, tap who was present. 30 seconds. Any student who was absent is automatically queued for a catch-up plan.' },
      { title: 'Give a test → scan the sheets', detail: 'After a written test, hand the answer sheets to scanner staff (or scan them yourself). AI reads the handwriting and enters scores automatically.' },
      { title: 'Catch-up plans appear without prompting', detail: 'The AI generates a personalised plan for each absent or low-scoring student. It uses the student\'s name, interests, and the exact topic they missed. No input required from you.' },
      { title: 'Check who needs more help', detail: 'The dashboard shows each student\'s quiz scores over time, their difficulty level (beginner / standard / advanced), and which plans they\'ve completed.' },
    ],
    doesntNeedTo: ['Write individual catch-up notes', 'Manually grade answer sheets', 'Follow up with students about revision'],
  },
  {
    icon: BookOpen,
    color: '#15803d',
    bg: '#f0fdf4',
    label: 'Student',
    tagline: 'Logs in, studies their plan, tracks progress',
    steps: [
      { title: 'Enter the student ID code', detail: 'The teacher gives each student a unique ID. No email address or phone number needed. Works on any browser.' },
      { title: 'See personalised catch-up plans', detail: 'If the student missed a class or scored low on a test, a plan appears. It explains the topic using examples from their stated interests — cricket, cooking, movies, whatever they chose.' },
      { title: 'Take a practice quiz', detail: 'After reading the plan, a 5-question quiz tests their understanding. The difficulty adjusts automatically — after 3 quizzes, EduTeach tracks whether to give easier or harder questions.' },
      { title: 'Read Character Corner', detail: 'Once a week, a new story about a character trait — patience, kindness, courage — set in an Indian school context. A reflection question follows.' },
      { title: 'Track progress', detail: 'The home screen shows their current difficulty level badge, completed plans, and quiz score history.' },
    ],
    doesntNeedTo: ['Ask the teacher what to revise', 'Create an account with personal details', 'Manage any settings'],
  },
  {
    icon: ScanLine,
    color: '#374151',
    bg: '#f1f5f9',
    label: 'Scanner Staff',
    tagline: 'Scans papers, AI does the grading',
    steps: [
      { title: 'Log in to the Scanner Portal', detail: 'Scanner staff get a separate login. They only see the scanning interface — no student data or lesson plans.' },
      { title: 'Upload answer sheets', detail: 'Take photos of each answer sheet with any phone camera, or upload from the gallery. No special scanner hardware needed.' },
      { title: 'AI reads and scores', detail: 'The AI reads handwritten answers, matches them to the answer key the teacher provided, and computes a score for each student.' },
      { title: 'Scores sync to the teacher', detail: 'Results appear on the teacher\'s dashboard immediately. The teacher sees the score, the student\'s answers, and which questions were missed.' },
    ],
    doesntNeedTo: ['Grade papers by hand', 'Enter scores into any spreadsheet', 'Contact the teacher to confirm results'],
  },
]

const FULL_FLOW = [
  { step: 1, who: 'Admin', action: 'Creates the school account, adds teachers, sets up the timetable' },
  { step: 2, who: 'Teacher', action: 'Creates classes, adds students by name or roll number' },
  { step: 3, who: 'Teacher', action: 'Marks attendance every day after class (30 seconds)' },
  { step: 4, who: 'Teacher / Scanner', action: 'Conducts a test → scanner staff photograph the answer sheets → AI grades them' },
  { step: 5, who: 'EduTeach AI', action: 'Generates a personalised catch-up plan for every absent or low-scoring student — automatically' },
  { step: 6, who: 'Student', action: 'Logs in with student ID, reads their plan, takes a practice quiz, reads Character Corner' },
  { step: 7, who: 'Teacher', action: 'Checks the dashboard — sees who improved, who still needs help, quiz scores, plan completion' },
  { step: 8, who: 'Admin', action: 'Views school-wide attendance trends, AI usage, and overall student progress' },
]

export default function FeaturesPage() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fff',
      color: '#0f172a',
      fontFamily: 'var(--font-jakarta), -apple-system, "Segoe UI", system-ui, sans-serif',
    }}>
      <style>{`
        @media (max-width: 768px) {
          .ft-nav { padding: 0 20px !important; }
          .ft-header { padding: 40px 20px 48px !important; }
          .ft-flow { padding: 56px 20px !important; }
          .ft-roles { padding: 0 20px 56px !important; }
          .ft-role-layout { grid-template-columns: 1fr !important; gap: 36px !important; }
          .ft-doesnt { grid-template-columns: 1fr !important; }
          .ft-cta { padding: 48px 20px !important; flex-direction: column !important; }
          .ft-ai-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className="ft-nav" style={{
        height: 56, padding: '0 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', borderBottom: '1.5px solid #e2e8f0',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <a href="/" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13.5, fontWeight: 700, color: '#64748b', textDecoration: 'none',
        }}>
          <ArrowLeft size={14} /> EduTeach
        </a>
        <button
          onClick={() => router.push('/portals')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 18px', background: '#1d4ed8', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 13.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          Get Started <ArrowRight size={13} />
        </button>
      </nav>

      {/* HEADER */}
      <header className="ft-header" style={{
        maxWidth: 860, margin: '0 auto', padding: '64px 48px 56px',
        borderBottom: '1.5px solid #e2e8f0',
      }}>
        <p style={{
          fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: '#c2410c', marginBottom: 18,
        }}>
          How EduTeach works
        </p>
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, lineHeight: 1.1,
          letterSpacing: -1.5, color: '#0f172a', margin: '0 0 20px',
        }}>
          A complete walkthrough — from school setup to every student having a plan.
        </h1>
        <p style={{ fontSize: 16.5, color: '#475569', lineHeight: 1.75, maxWidth: 600, margin: 0 }}>
          EduTeach connects four different people — the admin, the teacher, the student, and scanner
          staff — into one system. Here&apos;s exactly how each person uses it, and what EduTeach does
          automatically so they don&apos;t have to.
        </p>
      </header>

      {/* FULL FLOW TIMELINE */}
      <section className="ft-flow" style={{
        maxWidth: 860, margin: '0 auto', padding: '64px 48px',
        borderBottom: '1.5px solid #e2e8f0',
      }}>
        <h2 style={{
          fontSize: 'clamp(20px, 2.8vw, 28px)', fontWeight: 900,
          letterSpacing: -0.6, color: '#0f172a', margin: '0 0 36px',
        }}>
          The full flow — start to finish
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: 19, top: 38, bottom: 18,
            width: 1.5, background: '#e2e8f0', zIndex: 0,
          }} />

          {FULL_FLOW.map(({ step, who, action }) => (
            <div key={step} style={{
              display: 'flex', gap: 20, alignItems: 'flex-start',
              padding: '0 0 24px', position: 'relative', zIndex: 1,
            }}>
              <div style={{
                width: 38, height: 38, background: '#0f172a', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{step}</span>
              </div>
              <div style={{ paddingTop: 8 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                  color: '#94a3b8', marginBottom: 4, display: 'block',
                }}>
                  {who}
                </span>
                <p style={{ fontSize: 14.5, color: '#1e293b', lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
                  {action}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EACH ROLE IN DETAIL */}
      <section className="ft-roles" style={{ maxWidth: 860, margin: '0 auto', padding: '0 48px 72px' }}>
        {ROLES.map(({ icon: Icon, color, bg, label, tagline, steps, doesntNeedTo }, roleIdx) => (
          <div key={label} style={{
            paddingTop: 64,
            borderBottom: roleIdx < ROLES.length - 1 ? '1.5px solid #e2e8f0' : 'none',
            paddingBottom: roleIdx < ROLES.length - 1 ? 64 : 0,
          }}>
            {/* Role header */}
            <div className="ft-role-layout" style={{
              display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 56, alignItems: 'start',
            }}>
              {/* Left */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, background: bg, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={20} color={color} />
                  </div>
                  <div>
                    <p style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
                      color: '#94a3b8', margin: '0 0 2px',
                    }}>Portal</p>
                    <p style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: 0 }}>{label}</p>
                  </div>
                </div>
                <p style={{ fontSize: 14.5, color: '#64748b', lineHeight: 1.65, margin: '0 0 24px' }}>
                  {tagline}
                </p>

                {/* Doesn't need to */}
                <div style={{
                  background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '16px 18px',
                }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                    color: '#94a3b8', marginBottom: 12,
                  }}>
                    Doesn&apos;t need to
                  </p>
                  {doesntNeedTo.map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <CheckCircle2 size={13} color="#15803d" style={{ marginTop: 2, flexShrink: 0 }} />
                      <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, margin: 0 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: steps */}
              <div>
                {steps.map(({ title, detail }, stepIdx) => (
                  <div key={title} style={{
                    display: 'flex', gap: 16,
                    paddingBottom: stepIdx < steps.length - 1 ? 22 : 0,
                    marginBottom: stepIdx < steps.length - 1 ? 22 : 0,
                    borderBottom: stepIdx < steps.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <div style={{
                      width: 28, height: 28, background: color + '18', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                    }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: color }}>{stepIdx + 1}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{title}</p>
                      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, margin: 0 }}>{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* AI FEATURES NOTE */}
      <section style={{
        background: '#f8fafc', borderTop: '1.5px solid #e2e8f0', borderBottom: '1.5px solid #e2e8f0',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '56px 48px' }}>
          <p style={{
            fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: '#64748b', marginBottom: 24,
          }}>
            What the AI does
          </p>
          <div className="ft-ai-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              {
                name: 'Catch-up Plans',
                detail: 'Generated per student, per topic, per absence. Uses the student\'s name, interests, and the specific lesson they missed. No template — each plan reads as if it was written for that student.',
              },
              {
                name: 'Practice Quizzes',
                detail: '5 questions generated fresh for the topic. After 3 quizzes, the system computes the student\'s average score and adjusts — beginner (under 40%), standard (40–72%), advanced (above 72%).',
              },
              {
                name: 'Character Corner',
                detail: '12 character traits — patience, courage, kindness, honesty, and more. One story per week, Indian school setting, Grade-appropriate language. A reflection question follows each story.',
              },
            ].map(({ name, detail }) => (
              <div key={name} style={{
                background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '20px 18px',
              }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{name}</p>
                <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.65, margin: 0 }}>{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="ft-cta" style={{
          maxWidth: 860, margin: '0 auto', padding: '64px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24,
        }}>
          <div>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 900, color: '#0f172a', margin: '0 0 8px', letterSpacing: -0.5 }}>
              Ready to get started?
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
              Pick your portal — admin, teacher, student, or scanner.
            </p>
          </div>
          <button
            onClick={() => router.push('/portals')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '13px 28px', background: '#1d4ed8', color: '#fff',
              border: 'none', borderRadius: 7, fontSize: 15, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}>
            Choose Your Portal <ArrowRight size={15} />
          </button>
        </div>
      </section>

    </div>
  )
}
