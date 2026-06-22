import { z } from 'zod'

// ─── Reusable primitives ─────────────────────────────────────────────────────
// Use plain z.string() for most fields — optional/nullable fields from the app
// can arrive as null (not just undefined), so use .nullish() not .optional().

const reqStr  = z.string().trim().min(1)   // required non-empty string
const anyStr  = z.string()                 // any string including ""

// ─── Route schemas ────────────────────────────────────────────────────────────

export const BriefingSchema = z.object({
  teacherName: anyStr,
  classData: z.array(z.object({
    grade:        anyStr,
    section:      anyStr,
    studentCount: z.number().int().nonnegative(),
    nextTopic:     anyStr.nullish(),
    nextSubTopic:  anyStr.nullish(),
    lastSubTopics: z.array(anyStr).optional(),
    atRiskCount:  z.number().int().nonnegative(),
    lastSession: z.object({
      topic:       anyStr,
      date:        anyStr,
      absentCount: z.number().int().nonnegative(),
      absentNames: z.array(anyStr).optional(),
    }).nullish(),                            // ClassBriefingData has {...} | null
  })),
})

export const CatchupPlanSchema = z.object({
  studentName: reqStr,
  topic:       reqStr,
  subject:     reqStr,
  grade:       anyStr,
  score:       z.number().min(0).max(100).nullish(),
})

export const ClassPulseSchema = z.object({
  className:      reqStr,
  subject:        reqStr,
  grade:          anyStr,
  attendanceRate: z.number().min(0).max(1),
  students: z.array(z.object({
    name:           anyStr,
    avgMastery:     z.number().min(0).max(1),
    attendanceRate: z.number().min(0).max(1),
    interests:      z.array(anyStr),
  })),
  tests: z.array(z.object({
    topic:      anyStr,
    avgScore:   z.number().nonnegative(),
    totalMarks: z.number().positive(),
  })),
  topicCoverage: z.array(z.object({
    topic:  anyStr,
    status: anyStr,
  })),
})

export const EngageSchema = z.object({
  topic:    reqStr,
  grade:    anyStr.nullish(),
  totalStudents: z.number().int().nonnegative(),
  presentStudents: z.array(z.object({
    name:      anyStr,
    interests: z.array(anyStr),
    goal:      anyStr,
  })),
  absentNames: z.array(anyStr),
})

export const LessonPrepSchema = z.object({
  topic:    reqStr,
  subject:  reqStr,
  grade:    anyStr.nullish(),
  language: anyStr.nullish(),
})

export const PeerPairSchema = z.object({
  topic:   reqStr,
  subject: reqStr,
  students: z.array(z.object({
    id:         anyStr,
    name:       anyStr,
    avgMastery: z.number().min(0).max(1),
    interests:  z.array(anyStr),
    goal:       anyStr,
  })).min(2),
})

export const PotentialSchema = z.object({
  studentName: reqStr,
  signal: z.object({
    type: anyStr,
    data: z.unknown(),
  }),
})

export const QuestionsSchema = z.object({
  subject:    reqStr,
  topic:      reqStr,
  grade:      anyStr,
  totalMarks: z.union([z.number(), z.string()]),
})

export const RecoverySchema = z.object({
  grade:              anyStr,
  topic:              reqStr,
  studentName:        reqStr,
  attempts:           z.number().int().nonnegative(),
  previousApproaches: z.array(anyStr).nullish(),
})

export const StudentReportSchema = z.object({
  subject:        reqStr,
  grade:          anyStr,
  attendanceRate: z.number().min(0).max(1),
  student: z.object({
    name:       anyStr,
    rollNumber: anyStr,
    interests:  z.array(anyStr),
    goal:       anyStr,
  }),
  marks: z.array(z.object({
    topic:       anyStr,
    score:       z.number(),
    totalMarks:  z.number(),
    conductedOn: anyStr,
  })),
  mastery: z.array(z.object({
    topic:    anyStr,
    mastery:  z.number(),
    attempts: z.number(),
  })),
  warnings: z.array(z.object({
    reason: anyStr,
    action: anyStr,
    level:  anyStr,
  })),
})

// ─── Parse helper ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

export function parseBody<T>(schema: z.ZodType<T>, body: unknown):
  | { ok: true; data: T }
  | { ok: false; response: ReturnType<typeof NextResponse.json> }
{
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, data: result.data }
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Invalid request', details: z.flattenError(result.error).fieldErrors },
      { status: 400 },
    ),
  }
}
