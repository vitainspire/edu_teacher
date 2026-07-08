# EduTeach — Technical Architecture

AI-powered classroom management platform for teachers. Tracks attendance, marks, and syllabus while using LLMs to generate lesson plans, grade handwritten papers, surface at-risk students, and give students a personalised progress view across all their subjects.

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
├── (admin)/              # Admin portal — school management
│   └── admin/
│       ├── dashboard/    # School overview — student/teacher counts, recent activity
│       ├── classes/
│       │   └── [classId]/
│       │       ├── students/   # Roster with Student ID badges + copy buttons
│       │       ├── syllabus/   # Curriculum management
│       │       └── assign/     # Assign teachers to class
│       ├── teachers/     # Teacher list and management
│       ├── scanners/     # Scanner device management
│       └── timetable/    # School-wide timetable builder
│
├── (dashboard)/          # Teacher portal — requires Supabase auth
│   ├── home/             # Daily briefing, schedule, onboarding
│   ├── classes/
│   │   └── [classId]/    # Students, Attendance, Syllabus, Marks, Pulse, Understanding
│   ├── students/
│   │   └── [id]/         # Student profile — warnings, mastery, fingerprint, potential,
│   │                     #   and All Subjects tab (attendance + marks across every subject)
│   ├── tests/            # Tests + worksheet manager
│   ├── today/            # Today's prep — AI lesson generation
│   ├── alerts/           # At-risk warnings
│   ├── doubts/           # Student-submitted questions
│   ├── year-summary/     # Academic year report
│   ├── timetable/        # Teacher timetable view
│   └── settings/         # Academic year, term settings
│
├── (scanner)/            # Scanner portal — cookie-based auth (no Supabase session)
│   └── scanner/
│       ├── connect/      # Join via teacher code
│       ├── worksheet/    # Worksheet scanning
│       └── [classId]/tests/[testId]/
│           ├── scan/          # Camera → AI grade single paper
│           ├── batch-scan/    # Bulk scan
│           └── multi-scan/    # Multi-student batch grading
│
├── student/              # Student portal — Student ID auth
│   ├── login/            # Single-field login (Student ID e.g. STABCD23)
│   └── home/             # Badges, marks timeline, catch-up materials
│
├── admin/login/          # Admin login page
│
└── api/                  # 50+ API routes (see below)

lib/
├── context.tsx           # Global state (AppContext + useApp hook)
├── supabase.ts           # Supabase client (anon key — browser)
├── supabase-admin.ts     # Supabase admin client (service role — server only)
├── supabase-queries.ts   # 40+ typed query functions
├── admin-queries.ts      # Admin-specific typed query functions
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

## Authentication — Four Portals

### Admin
- Supabase email + password auth
- Scoped to a single school (school_id stored in `admins` table)
- `edu-role=admin` cookie set on login
- All admin API routes verify via service role that the admin's `school_id` matches the requested school

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
- Login: single **Student ID** (format `STABCD23` — `ST` prefix + 6 alphanumeric chars)
- Generated automatically when an admin adds students via bulk import
- Sets `edu-student-id` httpOnly cookie (30-day expiry)
- Multi-subject: one login shows all subjects (matched by grade + section + school)

### Middleware (`middleware.ts`)
1. Public paths bypass auth — `/login`, `/api/student/*`, `/api/health`, static files
2. Scanner role → redirect to `/scanner/connect` if no session
3. Teacher role → verify Supabase JWT, redirect to `/login` if expired
4. Student paths → check `edu-student-id` cookie
5. Admin paths → check `edu-role=admin` cookie

---

## Database Schema

| Table | Purpose |
|---|---|
| `schools` | Multi-tenant isolation |
| `admins` | School admin accounts (one admin per school) |
| `teachers` | Teacher accounts, `teacher_code`, language preference |
| `classes` | Class entities — grade, section, academic year |
| `students` | Roster — `student_code` (unique login ID), roll number, interests, goal |
| `teacher_class_assignments` | Explicit class-teacher mapping for multi-teacher schools |
| `tests` | Test metadata — subject, topic, total marks |
| `marks` | Scores — source: `manual / ai_scanned / teacher_override`, JSONB breakdown |
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
| `school_timetable_periods` | Admin-set school-wide period schedule |
| `school_schedules` | Bell schedule (periods, breaks, timings) |

**`student_code` column** — added to `students`:
```sql
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_student_code
  ON students(student_code) WHERE student_code IS NOT NULL;
-- Backfill existing students
UPDATE students
  SET student_code = 'ST' || upper(left(replace(id::text, '-', ''), 6))
  WHERE student_code IS NULL;
```

**Storage bucket**: `scanned-papers` — uploaded paper images, organised as `scanner/{testId}/` or `worksheets/{worksheetId}/`

> RLS is disabled on all tables. Auth is enforced at the application layer. Service role key is server-side only — never exposed to the browser.

---

## API Routes

### Admin
| Route | What it does |
|---|---|
| `POST /api/admin/login` | Admin login → sets `edu-role=admin` cookie |
| `POST /api/admin/register` | Create admin account linked to a school |
| `GET /api/admin/me` | Current admin profile |
| `GET /api/admin/schools/[schoolId]/overview` | School stats — class count, teacher count, student count |
| `GET/POST /api/admin/schools/[schoolId]/classes` | List / create classes |
| `GET/PATCH/DELETE /api/admin/schools/[schoolId]/classes/[classId]` | Class management |
| `POST /api/admin/schools/[schoolId]/classes/[classId]/students/bulk` | Bulk import students → auto-generates `student_code` for each |
| `GET /api/admin/schools/[schoolId]/classes/[classId]/students` | List students with codes |
| `POST /api/admin/schools/[schoolId]/classes/[classId]/assign-teacher` | Assign teacher to class |
| `GET/POST /api/admin/schools/[schoolId]/teachers` | List / invite teachers |
| `GET/POST /api/admin/schools/[schoolId]/timetable` | School timetable |
| `POST /api/admin/schools/[schoolId]/timetable/publish` | Publish timetable to all teachers |
| `GET/POST /api/admin/schools/[schoolId]/schedule` | Bell schedule management |
| `POST /api/admin/schedule-ai` | AI-generate a school schedule |
| `GET /api/admin/schools/[schoolId]/scanners` | Scanner device list |

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
| `POST /api/generate-answer-key` | Answer key from question set |

### Vision / Scanning
| Route | What it does |
|---|---|
| `POST /api/grade-scan` | Grade single handwritten paper via vision |
| `POST /api/grade-paper` | Grade paper against questions + model answer |
| `POST /api/grade-image` | Grade a single image (flexible format) |
| `POST /api/multi-grade-scan` | Batch grade multiple papers |
| `POST /api/scanner-upload` | Upload scanned paper to Supabase Storage |
| `POST /api/upload-scan` | Upload and trigger scan pipeline |

### Data
| Route | What it does |
|---|---|
| `POST /api/save-score` | Save marks from teacher UI |
| `POST /api/scanner-save-score` | Save marks from scanner portal |
| `POST /api/worksheet-save-score` | Save worksheet grades from scanner |
| `POST /api/worksheet-marks` | Record worksheet marks |
| `POST /api/scan-students` | List students for batch scanning |
| `GET/POST/DELETE /api/worksheets` | Worksheet CRUD |
| `GET /api/scanner/profile` | Scanner session profile |
| `GET /api/teacher/school-data` | Teacher's school metadata |

### Analytics
| Route | What it does |
|---|---|
| `POST /api/class-pulse` | Class health — weak topics, at-risk students |
| `POST /api/peer-pair` | Suggest peer learning pairs |
| `POST /api/potential` | Detect hidden potential signals (slow starters, spikes) |
| `POST /api/understanding-check` | Query poll results for a topic |
| `GET /api/teacher/student-overview/[studentId]` | All subjects for a student — attendance %, avg score, recent marks per subject (teacher view) |

### Student Portal
| Route | What it does |
|---|---|
| `POST /api/student/login` | Authenticate via **Student ID** (e.g. `STABCD23`) |
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

### Student ID Generation (Bulk Import)
```
Admin uploads CSV → POST /api/admin/schools/{schoolId}/classes/{classId}/students/bulk
  → For each student row (sequential, not parallel — avoids race conditions):
      genStudentCode() → "ST" + 6 chars from safe charset (no 0/O/I/1)
      SELECT from students WHERE student_code = ? → retry up to 10x if collision
  → bulkInsertStudents() → insert with student_code, class_id, roll_number
  → Returns { inserted: N, students: [{ name, studentCode }] }

Admin sees student codes on the class roster page (copy-to-clipboard per row).
Teacher sees code on the student card in their class view.
```

### Student Login (Student Portal)
```
Student enters Student ID (e.g. "STABCD23") → POST /api/student/login
  → SELECT * FROM students JOIN classes ON ... WHERE student_code = ? AND is_active = true
  → Set edu-student-id httpOnly cookie = student.id
  → GET /api/student/init: find all classes with same grade + section + school
  → Match student by roll number across classes → one tab per subject
  → Student switches subjects without re-login
```

### Teacher → Student All-Subjects View
```
Teacher clicks student in class → /students/[id] → "All Subjects" tab
  → GET /api/teacher/student-overview/[studentId]
  → Verify teacher auth + school isolation (teacher.school_id must match student's class)
  → Build subject list — new model: teacher_class_assignments; legacy: grade+section siblings
  → For each subject in parallel:
      Attendance: count present/late rows ÷ total sessions
      Tests: fetch test_ids for teacher+class → fetch marks → avg %, recent 5
  → Returns { student, subjects: [{ subjectName, attendanceRate, avgScore, totalTests, recentMarks }] }
```

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

**Supabase**: create a project, run the schema migrations, enable Storage bucket `scanned-papers`. Run the `student_code` migration above if upgrading from a prior version.

**OpenRouter**: sign up at openrouter.ai, add credits, copy the API key.

**Upstash**: optional — without it rate limiting uses an in-memory store that resets on redeploy.

---

## Deployment

Deployed on Vercel. Push to `main` triggers a production build.

```bash
vercel --prod
```

Add all environment variables under Project → Settings → Environment Variables in the Vercel dashboard. Mark `SUPABASE_SERVICE_ROLE_KEY` as server-only so it is never sent to the browser.
