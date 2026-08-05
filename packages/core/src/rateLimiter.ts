import { RateLimitOptions } from './types'

interface Bucket {
  tokens: number
  lastRefill: number
}

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  private readonly maxTokens: number
  private readonly refillIntervalMs: number

  constructor(options: RateLimitOptions = {}) {
    this.maxTokens = options.maxTokens ?? 10
    this.refillIntervalMs = options.refillIntervalMs ?? 10_000
  }

  /** Returns true if an event keyed by `key` (e.g. exception type) may proceed. */
  allow(key: string, now: number = Date.now()): boolean {
    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now }
      this.buckets.set(key, bucket)
    }

    const elapsed = now - bucket.lastRefill
    const refillCount = Math.floor(elapsed / this.refillIntervalMs)
    if (refillCount > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + refillCount)
      bucket.lastRefill = now
    }

    if (bucket.tokens <= 0) return false

    bucket.tokens -= 1
    return true
  }
}
