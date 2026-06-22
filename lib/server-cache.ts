/**
 * Server-side in-memory cache shared across requests hitting the same warm
 * serverless instance. On Vercel, warm instances typically live 5–15 min and
 * handle multiple sequential requests — this eliminates duplicate AI calls
 * within that window.
 */

interface CacheItem {
  value: unknown
  expiresAt: number
}

class TTLCache {
  private store = new Map<string, CacheItem>()

  get<T>(key: string): T | null {
    const item = this.store.get(key)
    if (!item) return null
    if (Date.now() > item.expiresAt) { this.store.delete(key); return null }
    return item.value as T
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
    if (this.store.size > 500) this.evict()
  }

  private evict() {
    const now = Date.now()
    for (const [k, v] of this.store) if (now > v.expiresAt) this.store.delete(k)
  }
}

// Module-level singleton — one instance per warm serverless function
export const serverCache = new TTLCache()

/** Build a stable string key from any serialisable values. */
export function ck(...parts: (string | number | boolean | null | undefined)[]): string {
  return parts.map(p => String(p ?? '')).join('|')
}

// In-flight deduplication: if two requests arrive for the same cache key while
// the first is still computing, the second awaits the same Promise instead of
// spawning a duplicate AI call.
const inFlight = new Map<string, Promise<unknown>>()

/** Wrap an async computation with the server cache. Returns the value and whether it was a cache hit. */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<{ value: T; fromCache: boolean }> {
  const hit = serverCache.get<T>(key)
  if (hit !== null) return { value: hit, fromCache: true }

  // Deduplicate concurrent requests with identical keys
  const existing = inFlight.get(key) as Promise<T> | undefined
  if (existing) return { value: await existing, fromCache: false }

  const promise = compute().then(value => {
    serverCache.set(key, value, ttlSeconds)
    inFlight.delete(key)
    return value
  }).catch(err => {
    inFlight.delete(key)
    throw err
  })

  inFlight.set(key, promise as Promise<unknown>)
  return { value: await promise, fromCache: false }
}
