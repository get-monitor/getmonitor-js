import { describe, it, expect } from 'vitest'
import { TokenBucketRateLimiter } from '../rateLimiter'

describe('TokenBucketRateLimiter', () => {
  it('allows up to maxTokens events for the same key, then blocks', () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 3, refillIntervalMs: 10_000 })
    expect(limiter.allow('TypeError')).toBe(true)
    expect(limiter.allow('TypeError')).toBe(true)
    expect(limiter.allow('TypeError')).toBe(true)
    expect(limiter.allow('TypeError')).toBe(false)
  })

  it('tracks separate buckets per key', () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillIntervalMs: 10_000 })
    expect(limiter.allow('TypeError')).toBe(true)
    expect(limiter.allow('RangeError')).toBe(true)
    expect(limiter.allow('TypeError')).toBe(false)
  })

  it('refills tokens after the refill interval elapses', () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillIntervalMs: 10_000 })
    const t0 = 1_000_000
    expect(limiter.allow('TypeError', t0)).toBe(true)
    expect(limiter.allow('TypeError', t0 + 5_000)).toBe(false)
    expect(limiter.allow('TypeError', t0 + 10_001)).toBe(true)
  })

  it('defaults to 10 tokens / 10s refill when no options given', () => {
    const limiter = new TokenBucketRateLimiter()
    for (let i = 0; i < 10; i++) {
      expect(limiter.allow('Error')).toBe(true)
    }
    expect(limiter.allow('Error')).toBe(false)
  })
})
