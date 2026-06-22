// ─── Upstash Redis rate limiting with in-memory fallback ─────────────────────
// On Vercel each worker has its own in-memory Map, so a single IP can exceed
// the limit by spinning up multiple instances. Upstash Redis is shared across
// all workers and enforces the limit globally.
// Falls back to in-memory automatically when UPSTASH_REDIS_REST_URL is unset
// (local dev, preview deploys, or if Upstash is temporarily unreachable).

export function getClientIp(req: { headers: { get: (k: string) => string | null } }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

const WINDOW_MS    = 60 * 60 * 1000  // 1 hour
const MAX_REQUESTS = 60               // per IP per window

interface Entry { count: number; windowStart: number }
const store = new Map<string, Entry>()

function checkInMemory(ip: string): { allowed: boolean; remaining: number } {
  const now   = Date.now()
  const entry = store.get(ip)
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now })
    return { allowed: true, remaining: MAX_REQUESTS - 1 }
  }
  if (entry.count >= MAX_REQUESTS) return { allowed: false, remaining: 0 }
  entry.count++
  return { allowed: true, remaining: MAX_REQUESTS - entry.count }
}

// ─── Upstash limiter (singleton, lazily initialised) ─────────────────────────

type UpstashLimiter = { limit: (id: string) => Promise<{ success: boolean; remaining: number }> }
let limiter: UpstashLimiter | null | 'uninit' = 'uninit'

async function getLimiter(): Promise<UpstashLimiter | null> {
  if (limiter !== 'uninit') return limiter
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) { limiter = null; return null }
  try {
    const { Redis }     = await import('@upstash/redis')
    const { Ratelimit } = await import('@upstash/ratelimit')
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(60, '1 h'),
      prefix: 'eduteach:rl',
    }) as unknown as UpstashLimiter
    return limiter
  } catch (e) {
    console.warn('[rate-limit] Upstash init failed, using in-memory fallback:', e)
    limiter = null
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const lim = await getLimiter()
  if (!lim) return checkInMemory(ip)
  try {
    const result = await lim.limit(ip)
    return { allowed: result.success, remaining: result.remaining }
  } catch {
    // Upstash unreachable — fail open so teachers aren't blocked
    return checkInMemory(ip)
  }
}
