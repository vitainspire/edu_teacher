export interface School {
  id: string
  name: string
  joinCode: string
  createdBy?: string
  createdAt: string
}

export interface Teacher {
  id: string
  userId: string
  name: string
  schoolName: string
  schoolId?: string    // UUID from schools table — the real SaaS tenant key
  subject: string      // primary subject — kept in sync as subjects[0] for backward compat
  subjects?: string[]  // every subject this teacher can teach (common in staff-scarce schools)
  grade: string
  phone: string
  languagePreference: string
  academicYearStart?: string   // ISO date "2025-06-01" — when this school year started
  currentTerm?: string         // "Term 1" | "Term 2" | "Term 3"
  teacherCode?: string         // short code non-teaching staff type into the scanner app
  maxPeriodsPerDay?: number    // optional workload cap — undefined/null = no cap
  maxPeriodsPerWeek?: number
}

export interface Class {
  id: string
  teacherId: string    // creator / owner of this class
  schoolName: string   // legacy string key (kept for backward compat)
  schoolId?: string    // UUID from schools table — preferred isolation key
  name: string
  grade: string
  section: string
  academicYear: string
  createdAt: string
  classCode?: string
}

export interface Student {
  id: string
  teacherId: string
  classId: string
  name: string
  rollNumber: string
  isActive: boolean
  interests: string[]
  goal: string
  pin?: string
  studentCode?: string
}

export type QuestionType = 'mcq' | 'fill-in-blank' | 'short-answer' | 'long-answer'

export interface AiQuestion {
  text: string
  type: QuestionType
  difficulty: 'easy' | 'medium' | 'hard'
  marks: number
  options?: string[]   // MCQ only — ["A. option", "B. option", "C. option", "D. option"]
  answer: string
  keywords?: string[]  // short-answer — key terms used for fuzzy/keyword grading
}

export interface Test {
  id: string
  teacherId: string
  classId?: string
  subject: string
  topic: string
  totalMarks: number
  conductedOn: string
  term?: string           // "Term 1" | "Term 2" | "Term 3"
  questions?: AiQuestion[]
}

export interface Mark {
  id: string
  testId: string
  studentId: string
  score: number
  feedback?: string    // teacher's observation e.g. "confused on fractions", "skipped Q3"
  breakdown?: { question: number; awarded: number; max: number; errorType?: 'conceptual' | 'procedural' | 'careless' | null }[]  // per-question score from scanner
  enteredAt: string
  source?: 'manual' | 'ai_scanned' | 'teacher_override'
  imageUrl?: string
}

/**
 * A session = teacher taught a specific syllabus topic to a class on a specific date.
 * Attendance records are linked to sessions so we know which topic was being taught
 * when each student was present or absent.
 */
export interface LessonSnapshot {
  hook: string
  realLifeExamples: string[]
}

export interface Session {
  id: string
  classId: string
  teacherId: string
  syllabusTopicId: string
  topic: string            // denormalised for display
  date: string             // YYYY-MM-DD
  createdAt: string
  sessionNote?: string     // what the teacher specifically covered this session
  lessonSnapshot?: LessonSnapshot  // Class Starter + real-life examples saved from that day's engage
}

/**
 * Attendance is now linked to a Session, giving us topic-level presence tracking.
 * sessionId / syllabusTopicId may be empty string for legacy records recorded before
 * this model existed.
 */
export interface Attendance {
  id: string
  sessionId: string        // which teaching session this belongs to
  studentId: string
  classId: string
  syllabusTopicId: string  // which topic was being taught (denormalised)
  date: string
  status: 'present' | 'absent' | 'late'
}

export interface TopicMastery {
  id: string
  studentId: string
  topic: string
  subject: string
  mastery: number
  attempts: number
  lastUpdated: string
}

export interface SyllabusTopic {
  id: string
  classId: string
  teacherId?: string   // which teacher's curriculum this belongs to
  grade?: string       // grade this topic belongs to (= owning class's grade)
  subject?: string     // which subject's curriculum this belongs to (grade-scoped syllabus is per-subject)
  definitionId?: string // shared across all sections of the same grade; edits/deletes fan out by this
  topic: string
  description: string
  weekNumber?: number
  estimatedSessions?: number   // AI year-plan: how many class sessions this topic needs
  orderIndex: number
  isCompleted: boolean   // per-section completion (each section's row tracks its own)
  createdAt: string
}

export interface SyllabusSubTopic {
  id: string
  topicId: string       // parent SyllabusTopic.id
  classId: string       // for easy filtering
  teacherId?: string    // which teacher's curriculum this belongs to
  definitionId?: string // shared across sibling sub-topics in other sections of the grade
  name: string
  description?: string
  orderIndex: number
  isCompleted: boolean
  completedAt?: string
  createdAt: string
}

export interface RecoveryAttempt {
  id: string
  studentId: string
  topic: string
  approachUsed: string
  helped: boolean | null
  generatedAt: string
}

export interface Warning {
  level: 'critical' | 'watch' | 'info'
  category: 'absence' | 'low_marks' | 'struggling'
  reason: string
  action: string
  date?: string   // YYYY-MM-DD of the most recent absence for this topic
  topic?: string  // topic name, used for catch-up plan creation
}

export interface StudentWithStats extends Student {
  warnings: Warning[]
  attendanceRate: number
  avgMastery: number
}

/**
 * Per-student, per-topic coverage status derived from sessions + attendance + marks.
 */
export interface TopicCoverageStatus {
  syllabusTopicId: string
  topic: string
  attended: boolean | null   // null = topic never taught yet
  score: number | null       // 0-1 percentage, null = no test yet
  classification:
    | 'mastered'             // attended + score >= 0.7
    | 'present-struggling'  // attended + score < 0.7 → explain using interests
    | 'absent-low'          // absent + score < 0.5 → critical: missed lesson & failing
    | 'absent-watch'        // absent + 0.5 <= score < 0.7
    | 'absent-good'         // absent + score >= 0.7 → self-learner potential signal
    | 'absent-untested'     // absent + no test yet
    | 'not-taught'          // topic not taught yet
    | 'not-assessed'        // attended but no test yet
}

export interface Fingerprint {
  learningStyle: 'story-based' | 'analytical'
  isConsistent: boolean
  peakDay: string
  strongTopics: string[]
  weakTopics: string[]
  improvementRate: number
  variance: number
}

export interface PotentialSignal {
  type: 'uneven_profile' | 'fast_learner' | 'topic_spike'
  data: Record<string, unknown>
  sentence?: string
}

export interface BriefingFinding {
  type: 'repeated_failures' | 'trend' | 'at_risk' | 'readiness'
  data: Record<string, unknown>
}

export interface DailyBriefing {
  date: string
  teacherId: string
  sentences: string[]
  stats: {
    proficient: number
    developing: number
    struggling: number
  }
}

export interface ClassBriefingData {
  classId: string
  className: string
  grade: string
  section: string
  studentCount: number
  nextTopic: string | null
  nextSubTopic: string | null
  lastSubTopics: string[]
  lastSession: {
    topic: string
    date: string
    absentCount: number
    absentNames: string[]
  } | null
  atRiskCount: number
  atRiskNames: string[]
  completedTopics: number
  totalTopics: number
}

export interface Question {
  text: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface RecoveryApproach {
  explanation: string
  example: string
  checkQuestion: string
}

export interface EnrichedMark extends Mark {
  totalMarks: number
  topic: string
  conductedOn: string
  term?: string
}

export interface TimetableEntry {
  id: string
  teacherId: string
  classId: string
  dayOfWeek: number   // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  periodNumber: number
  startTime: string   // "09:00"
  endTime: string     // "09:45"
  label?: string      // subject label from admin timetable
}

export interface LessonPrep {
  explanation: string
  examples: string[]
  commonMistakes: string[]
  quickActivity: string
}

export interface InterventionNote {
  id: string
  studentId: string
  teacherId: string
  note: string
  date: string       // YYYY-MM-DD
  createdAt: string
}

export interface TeacherClassAssignment {
  id: string
  teacherId: string
  classId: string
  subject?: string
  createdAt: string
}

export interface StudentDoubt {
  id: string
  studentId: string
  studentName: string
  classId: string
  subject: string
  question: string
  answer?: string
  answeredAt?: string
  createdAt: string
  status: 'pending' | 'answered'
}

export interface TopicPoll {
  id: string
  studentId: string
  classId: string
  syllabusTopicId: string
  topic: string
  subject: string
  response: 'understood' | 'partial' | 'confused'
  respondedAt: string
}

export interface WsQuestion {
  text: string
  options?: string[]
  answer?: string
}

export interface WsSection {
  type: string
  label: string
  marksEach: number
  questions: WsQuestion[]
}

export interface Worksheet {
  id: string
  teacherId: string
  classId?: string
  topic: string
  subject: string
  grade: string
  template?: string
  totalMarks: number
  sections: WsSection[]
  answerKey: Record<string, string>   // "sectionIndex-questionIndex" → answer text
  createdAt: string
}

export interface GapTopic {
  topic: string
  avgMastery: number
  weakStudentCount: number
  totalStudents: number
}

export interface BridgeNote {
  concept: string
  text: string
}

export interface LessonSection {
  type: 'teach' | 'check'
  title: string
  content: string
  bridgeNote?: BridgeNote
}

export interface SmartLesson {
  hook: string
  sections: LessonSection[]
  closingActivity: string
}

export interface TaughtTopic {
  id: string
  teacherId: string
  classId: string
  date: string   // YYYY-MM-DD
  topic: string
  subtopic?: string
  createdAt: string
}

export interface PrepMaterial {
  id: string
  teacherId: string
  classId: string
  subject: string
  grade: string
  topic: string
  subtopic?: string
  gapTopics: GapTopic[]
  lesson: SmartLesson
  createdAt: string
}

export interface CatchupMaterial {
  id: string
  teacherId: string
  studentId: string
  studentName: string
  topic: string
  subject: string
  grade: string
  explanation: string
  practiceQuestions: string[]
  activity: string
  focusNote: string
  status: 'approved' | 'given' | 'done'
  reason?: 'absent' | 'low-score'
  createdAt: string
}

export interface ScheduleSlot {
  type: 'period' | 'break'
  periodNumber?: number
  label: string       // "Period 1", "Short Break", "Lunch Break"
  startTime: string   // "09:00"
  endTime: string     // "09:45"
}

export interface SchoolSchedule {
  id: string
  schoolId: string
  slots: ScheduleSlot[]
  createdAt: string
}

export interface Admin {
  id: string
  userId: string
  name: string
  email: string
  schoolId: string
  createdAt: string
}

export interface GradeSubject {
  id: string
  schoolId: string
  grade: string
  subject: string
  periodsPerWeek: number
  /** 'core' academic subjects vs 'special' activity periods (Sports/Library/Lab/...) — lets the
   *  timetable generator space core periods apart instead of stacking them back-to-back. */
  category: 'core' | 'special'
  orderIndex: number
  createdAt: string
}

export interface SchoolTimetablePeriod {
  id: string
  schoolId: string
  dayOfWeek: number
  periodNumber: number
  startTime: string
  endTime: string
  classId: string
  teacherId?: string
  label?: string
  createdAt: string
}

export interface TeacherAvailability {
  id: string
  schoolId: string
  teacherId: string
  date: string   // YYYY-MM-DD
  reason: 'on_leave' | 'late_arrival' | 'official_duty' | 'other'
  note?: string
  source: 'teacher' | 'admin'   // who set this status — teacher self-report is primary, admin is a fallback override
}

export interface TimetableSubstitution {
  id: string
  schoolId: string
  date: string   // YYYY-MM-DD
  dayOfWeek: number
  periodNumber: number
  classId: string
  subject?: string
  originalTeacherId: string
  substituteTeacherId?: string
  status: 'assigned' | 'unresolved' | 'manual'
}

export interface Announcement {
  id: string
  schoolId: string
  adminId: string
  adminName: string
  title: string
  body: string
  category: 'general' | 'exam' | 'urgent' | 'holiday'
  createdAt: string
}

export interface AcademicEvent {
  id: string
  schoolId: string
  title: string
  category: 'holiday' | 'exam' | 'term'
  // Only meaningful when category === 'holiday' — why this day is off.
  holidaySubtype?: 'public' | 'school' | 'cultural'
  // Whether this event actually blocks regular class periods. Defaults true
  // for holidays/exams; a cultural event (Annual Day, Sports Day) may be
  // set false if classes still run around it.
  countsAsNonWorking: boolean
  // Draft (false) until the admin explicitly publishes the calendar — only
  // published events are visible in the teacher-facing calendar.
  published: boolean
  startDate: string   // YYYY-MM-DD
  endDate: string      // YYYY-MM-DD
  description?: string
  createdAt: string
}

export interface ExamPlanItem {
  id: string
  schoolId: string
  name: string          // e.g. "Unit Test", "Half-Yearly Exam"
  count: number         // how many times this exam type happens in the year
  orderIndex: number
  createdAt: string
}

export interface PersonalityStoryOption {
  text: string
  outcome: string
  // Internal steering signal — never shown to the student. Decides which of
  // the three closing scenes the story lands on; not a score, not shown as a grade.
  leadsToward: 'wise' | 'regret'
}

export interface PersonalityStoryStep {
  scene: string
  question: string
  options: PersonalityStoryOption[]
}

export interface PersonalityStory {
  trait: string
  title: string
  steps: PersonalityStoryStep[]
  endings: {
    wise: string
    mixed: string
    regret: string
  }
}
