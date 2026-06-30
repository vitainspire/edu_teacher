# EduTeach — Technical Architecture

AI-powered classroom management platform for teachers. Tracks attendance, marks, and syllabus while using LLMs to generate lesson plans, grade handwritten papers, and surface at-risk students.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.5 — App Router, SSR |
| UI | React 18, Tailwind CSS 3.4, Lucide Icons |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI | OpenRouter (default: `google/gemini-2.5-flash`) |
| Rate Limiting | Upstash Redis + in-memory fallback |
| Offline Storage | Dexie (IndexedDB wrapper) |
| Validation | Zod 4.4.3 |
| PWA | @ducanh2912/next-pwa |
| Deployment | Vercel |

---

## Project Structure

```
app/
├── (dashboard)/          # Teacher portal — requires Supabase auth
│   ├── home/             # Daily briefing, schedule, onboarding
│   ├── classes/
│   │   └── [classId]/    # Students, Attendance, Syllabus, Marks, Pulse, Understanding
│   ├── students/[id]/    # Student profile — warnings, mastery, fingerprint, potential
│   ├── tests/            # Tests + worksheet manager
│   ├── today/            # Today's prep — AI lesson generation
│   ├── alerts/           # At-risk warnings
│   ├── doubts/           # Student-submitted questions
│   └── settings/         # Academic year, term settings
│
├── (scanner)/            # Scanner portal — cookie-based auth (no Supabase session)
│   └── scanner/
│       ├── connect/      # Join via teacher code
│       └── [classId]/tests/[testId]/
│           ├── scan/          # Camera → AI grade single paper
│           ├── batch-scan/    # Bulk scan
│           └── multi-scan/    # Multi-student batch grading
│
├── student/              # Student portal — roll number + class code auth
│   ├── login/
│   └── home/             # Badges, marks timeline, catch-up materials
│
└── api/                  # 38 API routes (see below)

lib/
├── context.tsx           # Global state (AppContext + useApp hook)
├── supabase.ts           # Supabase client (anon key — browser)
├── supabase-admin.ts     # Supabase admin client (service role — server only)
├── supabase-queries.ts   # 40+ typed query functions
├── db.ts                 # Dexie IndexedDB schema (v17, 17 tables)
├── ai.ts                 # OpenRouter wrapper with circuit breaker
├── rate-limit.ts         # Upstash + in-memory rate limiting
├── server-cache.ts       # Server-side 24h response cache
├── logger.ts             # Structured JSON logging + IP extraction
├── types.ts              # 40+ TypeScript interfaces
├── schemas.ts            # Zod validation schemas
├── graders.ts            # MCQ / fill-in-the-blank / short answer graders
├── logic/                # Briefing, fingerprint, mastery, warnings, potential
└── hooks/                # useStudentActions, useMarksActions, useAttendanceActions, …
```

---

## Authentication — Three Portals

### Teacher (dashboard)
- Supabase email + password auth
- JWT stored in `sb-*` cookies, verified in middleware via `supabase.auth.getUser()`
- `edu-role=teacher` cookie set on login

### Scanner staff
- No Supabase account required
- Joins using teacher's 6-char `teacher_code`
- `edu-role=scanner` + `edu-session=1` cookies
- Middleware blocks scanner users from accessing dashboard routes
- API access controlled by IP-based rate limiting

### Student portal
- Login: class code + roll number → validates against `classes` + `students` tables
- Sets `edu-student-id` httpOnly cookie (30-day expiry)
- Multi-subject: single login shows all subjects (matched by grade + section + school)

### Middleware (`middleware.ts`)
1. Public paths bypass auth — `/login`, `/api/student/*`, `/api/health`, static files
2. Scanner role → redirect to `/scanner/connect` if no session
3. Teacher role → verify Supabase JWT, redirect to `/login` if expired
4. Student paths → check `edu-student-id` cookie

---

## Database Schema

| Table | Purpose |
|---|---|
| `schools` | Multi-tenant isolation |
| `teachers` | Teacher accounts, `teacher_code`, language preference |
| `classes` | Class entities with `class_code` for student login |
| `students` | Roster — roll number, pin, interests, goal |
| `tests` | Test metadata — subject, topic, total marks |
| `marks` | Scores — source: `manual / ai / override`, JSONB breakdown |
| `sessions` | Teaching sessions — date, topic, lesson snapshot |
| `attendance` | Per-student per-session status: `present / absent / late` |
| `syllabus_topics` | Curriculum topics with completion flag and order |
| `syllabus_sub_topics` | Sub-topic breakdown |
| `student_topic_mastery` | Rolling mastery score per topic (0–1) |
| `timetable` | Period schedule — day, period number, start/end time |
| `catchup_materials` | AI-generated recovery plans per student per topic |
| `student_doubts` | Questions submitted by students (anonymous to class) |
| `topic_polls` | Understanding votes: `understood / partial / confused` |
| `worksheets` | Printable worksheets with sections and answer key (JSONB) |
| `worksheets_marks` | Marks from worksheet scanning |
| `teacher_class_assignments` | Explicit class-teacher mapping for shared classes |

**Storage bucket**: `scanned-papers` — uploaded paper images, organised as `scanner/{testId}/` or `worksheets/{worksheetId}/`

> RLS is disabled on all tables. Auth is enforced at the application layer. Service role key is server-side only — never exposed to the browser.

---

## API Routes

### AI Generation
| Route | What it does |
|---|---|
| `POST /api/smart-lesson` | Lesson plan with prior-grade gaps woven in naturally |
| `POST /api/lesson-prep` | Quick topic prep — explanation, examples, mistakes |
| `POST /api/generate-worksheet` | MCQ / fill / short / long question generation |
| `POST /api/practice-quiz` | 4-question student practice quiz |
| `POST /api/engage` | Class opener + real-life examples |
| `POST /api/catchup-plan` | Recovery plan for absent/struggling student |
| `POST /api/recovery` | Recovery approaches per topic |
| `POST /api/extract-syllabus` | Extract topics from pasted curriculum text |
| `POST /api/year-plan` | Full academic year plan from topic list |
| `POST /api/briefing` | Daily morning briefing summary |
| `POST /api/test-analysis` | AI analysis of class test scores |
| `POST /api/student-report` | Individual student AI report |
| `POST /api/questions` | Question generation for a topic |

### Vision / Scanning
| Route | What it does |
|---|---|
| `POST /api/grade-scan` | Grade single handwritten paper via vision |
| `POST /api/grade-paper` | Grade paper against questions + model answer |
| `POST /api/multi-grade-scan` | Batch grade multiple papers |
| `POST /api/scanner-upload` | Upload scanned paper to Supabase Storage |

### Data
| Route | What it does |
|---|---|
| `POST /api/save-score` | Save marks from teacher UI |
| `POST /api/scanner-save-score` | Save marks from scanner portal |
| `POST /api/worksheet-save-score` | Save worksheet grades from scanner |
| `POST /api/worksheet-marks` | Record worksheet marks |
| `POST /api/scan-students` | List students for batch scanning |
| `GET/POST/DELETE /api/worksheets` | Worksheet CRUD |

### Analytics
| Route | What it does |
|---|---|
| `POST /api/class-pulse` | Class health — weak topics, at-risk students |
| `POST /api/peer-pair` | Suggest peer learning pairs |
| `POST /api/potential` | Detect hidden potential signals (slow starters, spikes) |
| `POST /api/understanding-check` | Query poll results for a topic |

### Student Portal
| Route | What it does |
|---|---|
| `POST /api/student/login` | Authenticate via class code + roll number |
| `GET /api/student/init` | Load student profile + all subject tabs |
| `POST /api/student/tab-data` | Marks + mastery + attendance for one subject |
| `POST /api/student/doubt` | Submit a question |
| `POST /api/student/poll` | Submit understanding vote |
| `POST /api/student/profile` | Update interests / goal |

**Rate limits**
- Standard: 60 req / hour / IP (Upstash Redis, falls back to in-memory)
- Vision: 20 req / hour / IP (separate bucket for expensive vision calls)

---

## Key Data Flows

### Smart Lesson Generation
```
Teacher enters topic → POST /api/smart-lesson
  → Fetch active students for class
  → Aggregate marks + topic_mastery → compute avg mastery per topic
  → Identify gaps (avg < 65%)
  → Prompt OpenRouter: teach today's topic, weave gap explanations
    in naturally at the moment they arise — never as prerequisites
  → Return: hook + sections (teach/check) + bridgeNotes + closingActivity
  → Render inline on Today's Prep card
```

### Paper Scanning & Grading
```
Scanner takes photo → /api/scanner-upload → Supabase Storage
  → /api/multi-grade-scan: sends image + questions to OpenRouter vision
  → Vision model reads handwriting, extracts answers, scores against key
  → /api/scanner-save-score: inserts into marks, updates topic_mastery
```

### At-Risk Detection
```
On every marks/attendance save:
  → lib/logic/warnings.ts recomputes per student
  → Checks: consecutive absences, repeated low scores, topic mastery < 40%,
    sudden drop, no improvement after catchup
  → Warning levels: critical / watch / info
  → Surfaces on /alerts page and home briefing
```

### Student Multi-Subject Login
```
Student → class code + roll number → /api/student/login
  → Validate class → validate student in class
  → Set edu-student-id cookie
  → /api/student/init: find all classes with same grade+section+school
  → Match student by roll number across classes
  → Return tabs[] — one per subject
  → Student switches subjects without re-login
```

---

## State Management

**`lib/context.tsx`** — single AppContext loaded once on mount, holds all data.

```
teacher, classes, students, tests, marks, mastery
sessions, attendance, syllabusTopics, syllabusSubTopics
timetableEntries, catchupMaterials, worksheets, assignments
syncStatus ('online' | 'offline' | 'syncing'), isLoading
```

**Computed selectors** (called on demand, not stored):
- `getStudentWarnings(id)` — warning cards from mastery + attendance + marks
- `getStudentFingerprint(id)` — learning style, consistency, peak day
- `getStudentPotential(id)` — hidden signals (slow starter, topic spikes)
- `getBriefingData()` — next topic, absentees, at-risk count per class
- `getClassSyllabus(classId)` — ordered syllabus topics with completion

**Domain hooks** (keep context.tsx slim):
- `useStudentActions` — add, toggle, set pin
- `useMarksActions` — save marks, create test
- `useAttendanceActions` — record session, record attendance
- `useSyllabusActions` — add topic, toggle complete
- `useScheduleActions` — timetable, catchup materials

---

## Offline Support

- **Dexie (IndexedDB)**: 17-table schema mirrors the Supabase schema locally
- **Sync queue**: writes go to IndexedDB first, sync to Supabase when online
- **PWA**: service worker caches Supabase API responses (NetworkFirst, 24h TTL)
- **`syncStatus`** badge in UI shows `online / offline / syncing`

---

## AI Architecture

**`lib/ai.ts`** — `callAI(prompt, options)`
- Routes to OpenRouter with configured model
- **Circuit breaker**: opens after 3 consecutive failures, resets after 60s
- **Fallback model**: `meta-llama/llama-3.1-8b-instruct:free` for degraded mode
- **Server cache** (`lib/server-cache.ts`): 24h TTL, keyed by prompt hash — avoids duplicate AI calls for identical inputs

**Default model**: `google/gemini-2.5-flash` (override via `OPENROUTER_MODEL` env var)

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only — never expose to browser

# OpenRouter
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_FALLBACK_MODEL=meta-llama/llama-3.1-8b-instruct:free

# Rate limiting (optional — falls back to in-memory)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXT_PUBLIC_APP_URL=

# Internal pipeline (optional)
PIPELINE_IP=
```

---

## Local Setup

```bash
npm install
cp .env.example .env.local   # fill in the vars above
npm run dev                  # http://localhost:3000
```

**Supabase**: create a project, run the schema migrations, enable Storage bucket `scanned-papers`.

**OpenRouter**: sign up at openrouter.ai, add credits, copy the API key.

**Upstash**: optional — without it rate limiting uses an in-memory store that resets on redeploy.

---

## Deployment

Deployed on Vercel. Push to `main` triggers a production build.

```bash
vercel --prod
```

Add all environment variables under Project → Settings → Environment Variables in the Vercel dashboard. Mark `SUPABASE_SERVICE_ROLE_KEY` as server-only so it is never sent to the browser.
