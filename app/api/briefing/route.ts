import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { apiLog } from '@/lib/logger'
import { BriefingSchema, parseBody } from '@/lib/schemas'

interface ClassPoint {
  label: string
  lastTopic: string | null
  lastSubTopics: string[]
  absentCount: number | null
  nextTopic: string | null
  nextSubTopic: string | null
  atRiskCount: number
  hasSession: boolean
}

function buildClassPoint(c: {
  grade: string
  section: string
  studentCount: number
  nextTopic?: string | null
  nextSubTopic?: string | null
  lastSubTopics?: string[]
  atRiskCount: number
  lastSession?: { topic: string; date: string; absentCount: number } | null
}): ClassPoint {
  return {
    label:         `Grade ${c.grade}${c.section ? ` · ${c.section}` : ''}`,
    lastTopic:     c.lastSession?.topic ?? null,
    lastSubTopics: c.lastSubTopics ?? [],
    absentCount:   c.lastSession ? c.lastSession.absentCount : null,
    nextTopic:     c.nextTopic ?? null,
    nextSubTopic:  c.nextSubTopic ?? null,
    atRiskCount:   c.atRiskCount,
    hasSession:    !!c.lastSession,
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) {
    apiLog({ route: 'briefing', ip, fromCache: false, durationMs: 0, status: 'rate_limited' })
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  const t = Date.now()
  try {
    let rawBody: unknown
    try { rawBody = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const parsed_ = parseBody(BriefingSchema, rawBody)
    if (!parsed_.ok) return parsed_.response
    const { classData, teacherName } = parsed_.data

    // Per-class bullets built deterministically — no AI, always accurate
    const points = classData.map(buildClassPoint)

    // Greeting is a simple template — no AI, no hallucinated school names
    const name = (teacherName || 'Teacher').split(' ')[0]
    const greeting = `Good morning, ${name}! Here's your day at a glance.`

    apiLog({ route: 'briefing', ip, fromCache: false, durationMs: Date.now() - t, status: 'ok' })
    return NextResponse.json({ greeting, points })
  } catch (err) {
    apiLog({ route: 'briefing', ip, fromCache: false, durationMs: Date.now() - t, status: 'error', error: String(err) })
    return NextResponse.json({ greeting: '', points: [] }, { status: 500 })
  }
}
