export type LogStatus = 'ok' | 'error' | 'rate_limited'

export interface ApiLogEntry {
  route:      string
  ip:         string
  fromCache:  boolean
  durationMs: number
  status:     LogStatus
  error?:     string
}

/**
 * Structured JSON log — Vercel captures these in Function Logs automatically.
 * Each line is one JSON object so log drains (Axiom, Logtail, etc.) can parse them.
 */
export function apiLog(entry: ApiLogEntry): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), ...entry }))
}
