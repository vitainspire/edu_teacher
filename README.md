# EduTeach

An AI-powered daily companion for government and NGO school teachers in India. Built to  reduce admin burden, and surface student risks before they become failures.

---

## What It Does

EduTeach helps teachers with four core jobs:

| Job | What the app does |
|-----|-------------------|
| **Track** | Attendance per session, marks per test, syllabus progress |
| **Warn** | Flags at-risk students automatically from attendance + score patterns |
| **Prepare** | AI-generated lesson prep notes, daily briefing, year plans |
| **Recover** | Catch-up plans for absent students with teacher review before saving |

---

## Key Features

### Daily Flow
- **Daily Briefing** — AI summary every morning: next topic, absent students from last session, at-risk count
- **Today's Schedule** — timetable on home screen with current period highlighted, tap to take attendance
- **Alert Badge** — notification count on Alerts tab, no need to check manually

### Student Tracking
- Session-based attendance (linked to the topic being taught, not just a date)
- Per-student topic coverage: attended + scored vs absent + low score
- Early warning system: `critical` (7+ day gap or 3+ at-risk students) and `watch` (4+ day gap)
- Student profiles with attendance rate, mastery trends, fingerprint, and potential signals

### AI Features (require internet)
- **Lesson Prep** — explanation, Indian examples, common mistakes, quick activity for any topic
- **Catch-up Plans** — generated per absent student based on their actual missed topic and test score. Teacher reviews and edits before approving.
- **Recovery Engine** — personalised recovery approaches for struggling students
- **AI Grading** — photo-based answer sheet grading
- **Peer Pairing** — suggests which students to pair for peer learning
- **Year Plan** — generates a full syllabus plan from a topic list

### Teacher Tools
- Flexible test creation — works with or without a saved syllabus
- Revision suggestions — surfaces weakest class topics before creating a test
- Timetable editor — per-day period schedule with class assignment
- Settings — academic year start date, current term

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Offline Storage | Dexie.js v6 (IndexedDB) |
| AI | OpenRouter API — `google/gemini-2.5-flash` |
| Auth | Supabase Auth |
| Hosting | Vercel |

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd eduteach
npm install
```

### 2. Environment variables

Create `.env.local` in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=google/gemini-2.5-flash
```

### 3. Supabase — run migrations in order

Go to your Supabase project → SQL Editor and run each file in `supabase/`:

```
migration_001.sql   — core tables (teachers, students, classes, etc.)
migration_002.sql   — sessions + attendance schema
migration_003.sql   — syllabus sub-topics
migration_004.sql   — marks feedback column
migration_005.sql   — feedback column fix
migration_006.sql   — timetable table
migration_007.sql   — catchup_materials table
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
app/
  (dashboard)/
    home/           — Home screen with schedule + briefing
    alerts/         — Early warnings + catch-up plans
    classes/
      [classId]/
        attendance/ — Take attendance + lesson prep
        marks/      — Record tests, enter scores, revision suggestions
        students/   — Class roll
        syllabus/   — Topic tracker
        pulse/      — Class engagement analytics
    students/[id]/  — Individual student profile
    settings/       — Academic year, term, timetable
    year-summary/   — Year-level analytics
  api/
    briefing/       — Daily AI briefing
    catchup-plan/   — Catch-up material generation
    engage/         — Session engagement notes
    lesson-prep/    — Pre-class preparation notes
    recovery/       — Student recovery approaches
    ...

components/
  catchup/          — CatchupModal, ViewPlanModal
  home/             — TodaySchedule
  nav/              — BottomNav (mobile), SideNav (desktop)
  briefing/         — DailyBriefing
  classes/          — CreateClassModal
  ...

lib/
  context.tsx       — Global app state (AppContext)
  db.ts             — Dexie IndexedDB schema (v7)
  types.ts          — All TypeScript interfaces
  supabase-queries.ts — Supabase CRUD functions
  logic/
    warnings.ts     — Student warning computation
    home-alerts.ts  — Home screen alert computation
    mastery.ts      — Topic mastery calculation
    coverage.ts     — Per-student topic coverage
    fingerprint.ts  — Learning fingerprint
    briefing.ts     — Briefing data computation

supabase/           — SQL migration files
```

---

## Offline Behaviour

All data is written to IndexedDB (Dexie) first, then synced to Supabase when online. The app is fully usable without internet except for AI features (lesson prep, briefing, catch-up plans, recovery). Warning computation and all analytics run locally from IndexedDB.

---

## Design System

- Navy-blue primary palette: `#07153a`, `#1d4ed8`, `#2563eb`
- Mobile-first, responsive — bottom nav on mobile, sidebar on desktop (≥768px)
- No purple/violet in production UI

---

## Context

Built for Indian government school teachers who:
- Manage 40–60 students per class
- Have unreliable or no internet during school hours
- Cannot rely on students having phones or internet
- Need to maintain paper records in parallel

The app reduces teacher admin time, not student-facing interaction.
