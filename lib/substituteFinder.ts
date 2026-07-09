export interface Qualification {
  subject: string
  grade: string
  section?: string   // undefined = qualified for every section of this grade
}

export interface SubstituteCandidate {
  teacherId: string
  name: string
  qualifications: Qualification[]   // explicit, admin-configured — preferred when present
  subjectsTaught: Set<string>       // legacy fallback: subject only, inferred from assignments/timetable history
  busySlots: Set<string>   // `${dayOfWeek}|${periodNumber}` from the candidate's own published timetable
  maxPeriodsPerDay?: number    // optional workload cap — undefined = no cap
  maxPeriodsPerWeek?: number
  weeklyLoad: number           // regular periods this week + substitute periods already picked up this week
}

export interface SubstituteNeed {
  dayOfWeek: number
  periodNumber: number
  subject: string
  grade: string
  section?: string
}

/**
 * A candidate is qualified if they have an explicit qualification matching
 * the subject + grade (and, if the qualification names a specific section,
 * that section too) of the class needing coverage. Grade is a hard
 * requirement when explicit qualifications exist — a teacher configured for
 * Grade 9-10 Math is never eligible for a Grade 3 Math class.
 *
 * Teachers with zero qualifications on file (not yet onboarded into this)
 * fall back to the legacy subject-only inference from their actual
 * assignments/timetable history, with no grade check — so matching doesn't
 * silently break for anyone admins haven't gotten around to configuring yet.
 */
function isQualified(candidate: SubstituteCandidate, need: SubstituteNeed): boolean {
  if (candidate.qualifications.length > 0) {
    return candidate.qualifications.some(q =>
      q.subject === need.subject &&
      q.grade === need.grade &&
      (!q.section || q.section === need.section)
    )
  }
  return candidate.subjectsTaught.has(need.subject)
}

/**
 * Finds the best-fit substitute for one period. No fallback to an unqualified
 * "any free teacher" tier. Hard-excludes anyone who'd breach their own
 * daily/weekly workload cap by taking this period. Ranks survivors by fewest
 * periods already on that weekday, then name, for a deterministic pick.
 */
export function findSubstitute(
  need: SubstituteNeed,
  candidates: SubstituteCandidate[],
  excludeTeacherIds: Set<string>,
  alreadyUsedThisSlot: Set<string>,
): string | null {
  const slotKey = `${need.dayOfWeek}|${need.periodNumber}`
  const dayPrefix = `${need.dayOfWeek}|`

  const periodsOnDay = (c: SubstituteCandidate) =>
    [...c.busySlots].filter(k => k.startsWith(dayPrefix)).length

  const pool = candidates.filter(c =>
    !excludeTeacherIds.has(c.teacherId) &&
    !alreadyUsedThisSlot.has(c.teacherId) &&
    !c.busySlots.has(slotKey) &&
    isQualified(c, need) &&
    (c.maxPeriodsPerDay === undefined || periodsOnDay(c) < c.maxPeriodsPerDay) &&
    (c.maxPeriodsPerWeek === undefined || c.weeklyLoad < c.maxPeriodsPerWeek)
  )
  if (pool.length === 0) return null

  const sorted = [...pool].sort((a, b) =>
    periodsOnDay(a) - periodsOnDay(b) || a.name.localeCompare(b.name)
  )
  return sorted[0].teacherId
}

export interface ClassPeriod {
  periodNumber: number
  subject: string
  teacherId: string
}

export interface SwapSuggestion {
  swapPeriodNumber: number
  swapSubject: string
  movingTeacherId: string     // currently teaches swapSubject at swapPeriodNumber; would move to need.periodNumber
  freeingTeacherId: string    // qualified for need.subject and free at swapPeriodNumber; would teach there instead
}

/**
 * When no substitute is free at the exact period, checks whether swapping
 * this class's schedule for the day would resolve it: is there another
 * period Q (same class, same day) where (a) a qualified substitute for the
 * needed subject is free, and (b) Q's regular teacher is free at the
 * original period P? If so, the class could do Q's subject at P (taught by
 * Q's regular teacher) and the needed subject at Q (taught by the found
 * substitute) — nobody's own schedule is disrupted, just this class's order
 * for the day. Suggestion only — never auto-applied.
 */
export function suggestSwap(
  need: SubstituteNeed,
  classPeriodsThatDay: ClassPeriod[],
  candidates: SubstituteCandidate[],
  excludeTeacherIds: Set<string>,
  alreadyUsedThisSlot: (periodNumber: number) => Set<string>,
): SwapSuggestion | null {
  const candidateById = new Map(candidates.map(c => [c.teacherId, c]))
  const needSlotKey = `${need.dayOfWeek}|${need.periodNumber}`

  for (const period of classPeriodsThatDay) {
    if (period.periodNumber === need.periodNumber) continue

    const freeingTeacherId = findSubstitute(
      { ...need, periodNumber: period.periodNumber },
      candidates, excludeTeacherIds, alreadyUsedThisSlot(period.periodNumber)
    )
    if (!freeingTeacherId) continue

    const movingTeacher = candidateById.get(period.teacherId)
    if (!movingTeacher || movingTeacher.busySlots.has(needSlotKey)) continue

    return { swapPeriodNumber: period.periodNumber, swapSubject: period.subject, movingTeacherId: period.teacherId, freeingTeacherId }
  }
  return null
}
