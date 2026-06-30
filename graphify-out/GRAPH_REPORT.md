# Graph Report - .  (2026-06-23)

## Corpus Check
- 125 files · ~77,461 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 886 nodes · 1765 edges · 60 communities (52 shown, 8 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_AI API Routes|AI API Routes]]
- [[_COMMUNITY_Teacher Dashboard UI|Teacher Dashboard UI]]
- [[_COMMUNITY_App Config & PWA|App Config & PWA]]
- [[_COMMUNITY_Supabase Data Layer|Supabase Data Layer]]
- [[_COMMUNITY_Student Management & AI Cache|Student Management & AI Cache]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_App State & Local DB|App State & Local DB]]
- [[_COMMUNITY_AI Grading Pipeline (Scanner)|AI Grading Pipeline (Scanner)]]
- [[_COMMUNITY_Student Analytics & Graders|Student Analytics & Graders]]
- [[_COMMUNITY_Marks & Catchup Flow|Marks & Catchup Flow]]
- [[_COMMUNITY_Batch Scan Pipeline|Batch Scan Pipeline]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Class Management & Onboarding|Class Management & Onboarding]]
- [[_COMMUNITY_Student Potential & Mastery|Student Potential & Mastery]]
- [[_COMMUNITY_Scanner Grading Flow|Scanner Grading Flow]]
- [[_COMMUNITY_Daily Briefing & Marks|Daily Briefing & Marks]]
- [[_COMMUNITY_Supabase Auth & Storage|Supabase Auth & Storage]]
- [[_COMMUNITY_OCR Pipeline Client|OCR Pipeline Client]]
- [[_COMMUNITY_IndexedDB Schema|IndexedDB Schema]]
- [[_COMMUNITY_Navigation & Dashboard Layout|Navigation & Dashboard Layout]]
- [[_COMMUNITY_User Onboarding Guides|User Onboarding Guides]]
- [[_COMMUNITY_Question Generation UI|Question Generation UI]]
- [[_COMMUNITY_Scanner Shell Components|Scanner Shell Components]]
- [[_COMMUNITY_Exam Grading APIs|Exam Grading APIs]]
- [[_COMMUNITY_AI & Logging Utilities|AI & Logging Utilities]]
- [[_COMMUNITY_Student Alerts & Interventions|Student Alerts & Interventions]]
- [[_COMMUNITY_PWA Manifest|PWA Manifest]]
- [[_COMMUNITY_Auth & Login|Auth & Login]]
- [[_COMMUNITY_Scanner Shell Layout|Scanner Shell Layout]]
- [[_COMMUNITY_Vercel Deployment Config|Vercel Deployment Config]]
- [[_COMMUNITY_Test & Marks Management|Test & Marks Management]]
- [[_COMMUNITY_Exam Question Generator|Exam Question Generator]]
- [[_COMMUNITY_Scan Progress UI|Scan Progress UI]]
- [[_COMMUNITY_Syllabus & Lesson Planning|Syllabus & Lesson Planning]]
- [[_COMMUNITY_Attendance & Engagement|Attendance & Engagement]]
- [[_COMMUNITY_Student Roster Management|Student Roster Management]]
- [[_COMMUNITY_Analytics & Visualization|Analytics & Visualization]]
- [[_COMMUNITY_Paper Grading Route|Paper Grading Route]]
- [[_COMMUNITY_Class Creation & Modals|Class Creation & Modals]]
- [[_COMMUNITY_App Shell & Routing|App Shell & Routing]]
- [[_COMMUNITY_Score Chart|Score Chart]]
- [[_COMMUNITY_Class Pulse & Peer Pairing|Class Pulse & Peer Pairing]]
- [[_COMMUNITY_Mark Entry Component|Mark Entry Component]]
- [[_COMMUNITY_Voice Mark Entry|Voice Mark Entry]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Health Check & Supabase Client|Health Check & Supabase Client]]
- [[_COMMUNITY_Speech Recognition Types|Speech Recognition Types]]
- [[_COMMUNITY_Sync Status UI|Sync Status UI]]
- [[_COMMUNITY_Feature Tour|Feature Tour]]
- [[_COMMUNITY_Loading Skeletons|Loading Skeletons]]
- [[_COMMUNITY_Attendance Chart|Attendance Chart]]
- [[_COMMUNITY_Rate Limiting|Rate Limiting]]
- [[_COMMUNITY_CSS & Utilities Config|CSS & Utilities Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Server TTL Cache|Server TTL Cache]]
- [[_COMMUNITY_Skeleton Components|Skeleton Components]]
- [[_COMMUNITY_TypeScript Extensions|TypeScript Extensions]]
- [[_COMMUNITY_Fingerprint Type|Fingerprint Type]]
- [[_COMMUNITY_PotentialSignal Type|PotentialSignal Type]]

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 57 edges
2. `apiLog()` - 30 edges
3. `callAI()` - 28 edges
4. `withCache()` - 28 edges
5. `checkRateLimit()` - 23 edges
6. `AppContextType` - 21 edges
7. `getClientIp()` - 21 edges
8. `parseBody()` - 21 edges
9. `Supabase CRUD Query Layer (supabase-queries.ts)` - 20 edges
10. `ck()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `AI Feature Set (Lesson Prep, Catch-up, Recovery, Grading)` --semantically_similar_to--> `AiQuestion Interface (god node)`  [INFERRED] [semantically similar]
  README.md → lib/types.ts
- `Next.js PWA Config (next.config.mjs)` --semantically_similar_to--> `Offline-First Architecture (IndexedDB then Supabase sync)`  [INFERRED] [semantically similar]
  next.config.mjs → README.md
- `AI Feature Set (Lesson Prep, Catch-up, Recovery, Grading)` --semantically_similar_to--> `CatchupPlanSchema (Zod)`  [INFERRED] [semantically similar]
  README.md → lib/schemas.ts
- `ClassMarksPage()` --calls--> `useApp()`  [INFERRED]
  app/(dashboard)/classes/[classId]/marks/page.tsx → lib/context.tsx
- `ClassStudentsPage()` --calls--> `useApp()`  [INFERRED]
  app/(dashboard)/classes/[classId]/students/page.tsx → lib/context.tsx

## Import Cycles
- None detected.

## Communities (60 total, 8 thin omitted)

### Community 0 - "AI API Routes"
Cohesion: 0.06
Nodes (79): API: /api/briefing (No LLM), API: /api/catchup-plan (LLM via callAI), API: /api/class-pulse (LLM via callOpenRouter), API: /api/engage (LLM via callAI), API: /api/extract-syllabus (LLM via callAI), API: /api/lesson-plan (LLM via callOpenRouter), API: /api/lesson-prep (LLM via callAI), API: /api/peer-pair (LLM via callOpenRouter) (+71 more)

### Community 1 - "Teacher Dashboard UI"
Cohesion: 0.07
Nodes (68): LEVEL_CONFIG, Props, Props, ClassSelectionScreen Component, ClassSelectionScreen(), GRADE_COLORS, Props, CreateClassModal Component (+60 more)

### Community 2 - "App Config & PWA"
Cohesion: 0.06
Nodes (45): PWA Web App Manifest (public/manifest.json), Auth Routing Middleware (middleware.ts), JWT Payload Validation (jwtPayload + isValidJwt), Role-Based Route Routing (scanner vs teacher), Next.js PWA Config (next.config.mjs), AI Feature Set (Lesson Prep, Catch-up, Recovery, Grading), EduTeach Project README, Offline-First Architecture (IndexedDB then Supabase sync) (+37 more)

### Community 3 - "Supabase Data Layer"
Cohesion: 0.05
Nodes (3): createSchool(), genJoinCode(), School

### Community 4 - "Student Management & AI Cache"
Cohesion: 0.08
Nodes (37): AddStudentModal, POST /api/scan-students, Student interests picker (13 interests), AddStudentModal scan tab (AI OCR), ai-cache LRU eviction (max 60 keys), TTL constants (1d, 3d, 7d, 30d), aiKey() — namespaced cache key builder, getAiCache() — read+expire cache entry (+29 more)

### Community 5 - "Package Dependencies"
Cohesion: 0.06
Nodes (33): dependencies, clsx, dexie, dexie-react-hooks, @ducanh2912/next-pwa, googleapis, lucide-react, next (+25 more)

### Community 6 - "App State & Local DB"
Cohesion: 0.12
Nodes (27): BottomNav, AppContextType (Interface), AppProvider (React Context), fetchAndMergeFromSupabase (Sync), loadLocalData (DB Loader), useApp context hook, EduTeachDB (Dexie IndexedDB), SyncRecord (Interface) (+19 more)

### Community 7 - "AI Grading Pipeline (Scanner)"
Cohesion: 0.13
Nodes (19): buildPrompt(), ExtractedAnswer, ExtractionResult, findClosestStudent(), isRateLimited(), LongAnswerGrade, OpenRouterChoice, OpenRouterMessage (+11 more)

### Community 8 - "Student Analytics & Graders"
Cohesion: 0.15
Nodes (14): AVATAR_GRADIENTS, Props, GradeResult (Interface), gradeFib (Fill-in-Blank Grader), gradeMcq (MCQ Grader), gradeShortAnswer (Short Answer Grader), StudentDetailPage(), Fingerprint (+6 more)

### Community 9 - "Marks & Catchup Flow"
Cohesion: 0.20
Nodes (13): Step, CatchupModal(), Props, StudentReport, aiKey(), getAiCache(), setAiCache(), TTL (+5 more)

### Community 10 - "Batch Scan Pipeline"
Cohesion: 0.16
Nodes (13): BatchResult, BatchScanInner(), Stage, Student, TestInfo, CameraPageInner(), ConfirmPage(), ClassRow (+5 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 12 - "Class Management & Onboarding"
Cohesion: 0.13
Nodes (11): ClassSelectionScreen, CreateClassModal (used in Classes), CLASS_PALETTE, ClassesPage(), DailyBriefing (used in Home), OnboardingChecklist (used in Home), TodaySchedule (used in Home), CLASS_COLORS (+3 more)

### Community 13 - "Student Potential & Mastery"
Cohesion: 0.17
Nodes (14): API: /api/potential, API: /api/student-report, AddStudentModal (used in Class Students), Class Students Page, useApp Context Hook, Mastery Logic (getMasteryColor/getMasteryLabel), AttendanceChart Component, LearningFingerprint Component (+6 more)

### Community 14 - "Scanner Grading Flow"
Cohesion: 0.19
Nodes (11): API: /api/grade-scan, API: /api/save-score, API: /api/upload-scan, Batch Scan Page, BreadcrumbBar (Camera), Stage, Student, ScanResult (+3 more)

### Community 15 - "Daily Briefing & Marks"
Cohesion: 0.18
Nodes (11): Step, Root(), BriefingData, ClassPoint, DailyBriefing(), DAYS, nowHHMM(), TodaySchedule() (+3 more)

### Community 16 - "Supabase Auth & Storage"
Cohesion: 0.21
Nodes (9): createServerComponentClient(), POST(), RequestBody, Supabase Storage: scanned-papers bucket, ClassInfo, Props, TestRow, TestsPage() (+1 more)

### Community 17 - "OCR Pipeline Client"
Cohesion: 0.30
Nodes (12): callDoor(), DoorBody, runOCR(), runText(), buildNamesPrompt(), extractJSON(), extractMime(), parseNames() (+4 more)

### Community 18 - "IndexedDB Schema"
Cohesion: 0.22
Nodes (13): DB: classes table, DB: marks table, DB: students table, DB: teachers table, DB: tests table, Supabase Browser Client (lib/supabase), ScanPage(), ScanProgressView (Client Component) (+5 more)

### Community 19 - "Navigation & Dashboard Layout"
Cohesion: 0.17
Nodes (9): BottomNav (Dashboard), SideNav (Dashboard), DashboardLayout(), HomeAlerts(), computeHomeAlerts(), BottomNav(), NAV_ITEMS, NAV_ITEMS (+1 more)

### Community 20 - "User Onboarding Guides"
Cohesion: 0.15
Nodes (10): FeatureTour (used in Home), FlowStep, Phase, PHASES, Props, FeatureTour (used in Settings), FlowGuide (used in Settings), DAY_LABELS (+2 more)

### Community 21 - "Question Generation UI"
Cohesion: 0.20
Nodes (5): TeacherSubjectGrade (Questions), TeacherSubjectGrade(), ErrorBoundary, Props, State

### Community 22 - "Scanner Shell Components"
Cohesion: 0.21
Nodes (12): BreadcrumbBar (scanner), ScanContext from sessionStorage, ChangeClassButton (scanner), Scanner localStorage keys cleared on change, Feature: Scanner Mode (attendance scanning), Scanner logout clears edu-session and edu-role cookies, LogoutButton (scanner), supabase.auth.signOut() on logout (+4 more)

### Community 23 - "Exam Grading APIs"
Cohesion: 0.27
Nodes (12): API: /api/grade-image (LLM Vision via callAI), API: /api/grade-paper (Hybrid: LLM Vision + Local Graders), API: /api/grade-scan (Hybrid: OpenRouter Vision + Local Graders), API: /api/health (No LLM), API: /api/questions (LLM via callOpenRouter), API: /api/save-score (No LLM, Supabase write), RequestBody, Local Graders (gradeMcq, gradeFib, gradeShortAnswer) (+4 more)

### Community 24 - "AI & Logging Utilities"
Cohesion: 0.18
Nodes (11): AIMessage (Type), AIOptions (Type), callAI (LLM Entry Point), callModel (Internal Model Caller), Circuit Breaker (AI Resilience), ApiLogEntry (Interface), apiLog (Structured Logger), callOpenRouter (Compat Shim) (+3 more)

### Community 25 - "Student Alerts & Interventions"
Cohesion: 0.18
Nodes (8): CatchupModal (used in Alerts), StudentWarningRow (local component), ViewPlanModal (used in Alerts), AlertsPage(), CatchupTarget, ClassGroup, LEVEL_CONFIG, StudentAlerts

### Community 26 - "PWA Manifest"
Cohesion: 0.18
Nodes (10): background_color, categories, description, display, icons, name, orientation, short_name (+2 more)

### Community 27 - "Auth & Login"
Cohesion: 0.18
Nodes (4): LANGUAGES, Portal, SUBJECTS, TeacherForm()

### Community 28 - "Scanner Shell Layout"
Cohesion: 0.22
Nodes (7): ChangeClassButton (Scanner), LogoutButton (Scanner), SchoolNameDisplay (Scanner), ChangeClassButton(), SCANNER_KEYS, LogoutButton(), SchoolNameDisplay()

### Community 29 - "Vercel Deployment Config"
Cohesion: 0.18
Nodes (10): maxDuration, maxDuration, maxDuration, maxDuration, framework, functions, app/api/grade-scan/route.ts, app/api/save-score/route.ts (+2 more)

### Community 30 - "Test & Marks Management"
Cohesion: 0.20
Nodes (9): API: /api/questions, API: /api/test-analysis, CLASS_GRADIENTS_STYLE, ClassLayout(), TABS, MarkEntry (used in Class Marks), Class Marks Page, MarkEntry (used in Marks Page) (+1 more)

### Community 31 - "Exam Question Generator"
Cohesion: 0.25
Nodes (8): QuestionType, DIFFICULTY_COLOR, groupByType(), MARKS_OPTIONS, Props, QuestionGenerator(), SECTION_META, TYPE_ORDER

### Community 32 - "Scan Progress UI"
Cohesion: 0.28
Nodes (6): MarkRow, Props, StudentDbRow, Props, ScanProgressView(), StudentRow

### Community 33 - "Syllabus & Lesson Planning"
Cohesion: 0.25
Nodes (8): API: /api/extract-syllabus, API: /api/lesson-plan, API: /api/year-plan, Pacing Logic (computePacing), computePacing(), ClassSyllabusPage(), ExtractedTopic, WeekPlan

### Community 34 - "Attendance & Engagement"
Cohesion: 0.25
Nodes (7): API: /api/engage, API: /api/lesson-prep, AttendancePage(), EngageData, Status, STATUS_CONFIG, LessonPrep

### Community 35 - "Student Roster Management"
Cohesion: 0.25
Nodes (6): AVATAR_GRADIENTS, AddStudentModal(), INTERESTS, Props, ClassStudentsPage(), INTERESTS

### Community 36 - "Analytics & Visualization"
Cohesion: 0.25
Nodes (6): AttendanceChart Component, LearningFingerprint Component, Mastery Logic (getMasteryBarColor etc.), ScoreChart Component, BadgeProps, VARIANTS

### Community 37 - "Paper Grading Route"
Cohesion: 0.33
Nodes (6): Breakdown, ExtractedAnswer, ExtractionResult, extractJSON(), LongAnswerGrade, POST()

### Community 38 - "Class Creation & Modals"
Cohesion: 0.29
Nodes (4): CreateClassModal(), GRADES, Props, ModalProps

### Community 39 - "App Shell & Routing"
Cohesion: 0.29
Nodes (5): crimson, jakarta, metadata, viewport, Root Page (Auth Redirect)

### Community 40 - "Score Chart"
Cohesion: 0.33
Nodes (3): BAND, Point, Props

### Community 41 - "Class Pulse & Peer Pairing"
Cohesion: 0.33
Nodes (5): API: /api/class-pulse, API: /api/peer-pair, ClassPulsePage(), PeerPair, PulseReport

### Community 42 - "Mark Entry Component"
Cohesion: 0.33
Nodes (4): EntryState, Mode, Props, QuestionBreakdown

### Community 43 - "Voice Mark Entry"
Cohesion: 0.40
Nodes (4): fuzzyMatch(), ParsedEntry, parseVoiceInput(), Props

### Community 44 - "Auth Middleware"
Cohesion: 0.47
Nodes (5): config, isValidJwt(), jwtPayload(), middleware(), PUBLIC

### Community 45 - "Health Check & Supabase Client"
Cohesion: 0.40
Nodes (3): GET(), createClient(), supabase

### Community 46 - "Speech Recognition Types"
Cohesion: 0.33
Nodes (5): SpeechRecognition, SpeechRecognitionAlternative, SpeechRecognitionEvent, SpeechRecognitionResult, SpeechRecognitionResultList

### Community 48 - "Feature Tour"
Cohesion: 0.40
Nodes (3): CARDS, Props, TourCard

### Community 51 - "Rate Limiting"
Cohesion: 0.67
Nodes (4): Rate Limiter with Upstash+InMemory Fallback (rate-limit.ts), In-Memory Rate Limit Fallback (per-IP Map), Upstash Redis Rate Limiter (sliding window 60 req/hr), Vercel Deployment Config (vercel.json)

### Community 54 - "Server TTL Cache"
Cohesion: 1.00
Nodes (3): Server-Side TTL Cache (server-cache.ts), TTLCache Class (in-memory, 500-entry eviction), withCache() — deduplicated async computation wrapper

### Community 55 - "Skeleton Components"
Cohesion: 0.67
Nodes (3): BriefingSkeleton, CardSkeleton, Skeleton (loading placeholder)

## Ambiguous Edges - Review These
- `route.ts` → `route.ts`  [AMBIGUOUS]
  app/api/scan-students/route.ts · relation: semantically_similar_to

## Knowledge Gaps
- **309 isolated node(s):** `LEVEL_CONFIG`, `CatchupTarget`, `ClassGroup`, `Status`, `STATUS_CONFIG` (+304 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `route.ts` and `route.ts`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `AppProvider (React Context)` connect `App State & Local DB` to `Teacher Dashboard UI`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `useApp context hook` connect `App State & Local DB` to `Student Management & AI Cache`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `useApp()` connect `Daily Briefing & Marks` to `Teacher Dashboard UI`, `Attendance & Engagement`, `Student Roster Management`, `Syllabus & Lesson Planning`, `Class Creation & Modals`, `Student Analytics & Graders`, `Marks & Catchup Flow`, `Class Pulse & Peer Pairing`, `Class Management & Onboarding`, `Sync Status UI`, `Navigation & Dashboard Layout`, `User Onboarding Guides`, `Question Generation UI`, `Student Alerts & Interventions`, `Auth & Login`, `Test & Marks Management`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `useApp()` (e.g. with `ClassMarksPage()` and `MarksPage()`) actually correct?**
  _`useApp()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `LEVEL_CONFIG`, `CatchupTarget`, `ClassGroup` to the rest of the system?**
  _309 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AI API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.059248809733733025 - nodes in this community are weakly interconnected._