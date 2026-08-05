// packages/node/src/__tests__/GetMonitor.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { GetMonitor } from '../GetMonitor'

describe('GetMonitor (node)', () => {
  afterEach(() => {
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')
  })

  it('captureException sends via the queued transport', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchImpl)

    const gm = new GetMonitor('gm_test', { apiHost: 'https://ingest.test', enableExceptionAutocapture: false })
    await gm.captureException(new TypeError('boom'))

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(body.exceptions[0].type).toBe('TypeError')
    expect(body.mechanism).toBe('manual')
    expect(body.context.runtime).toContain('node/')
  })

  it('captureExceptionImmediate bypasses the queue and awaits a single request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchImpl)

    const gm = new GetMonitor('gm_test', { apiHost: 'https://ingest.test', enableExceptionAutocapture: false })
    await gm.captureExceptionImmediate(new Error('boom'))

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not reject when the transport fails to send (Node crashes on an unhandled rejection by default)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', fetchImpl)

    const gm = new GetMonitor('gm_test', { apiHost: 'https://ingest.test', enableExceptionAutocapture: false })

    await expect(gm.captureExceptionImmediate(new Error('boom'))).resolves.toBeUndefined()
  })

  it('runWithIdentity scopes identify() to the current async context', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchImpl)

    const gm = new GetMonitor('gm_test', { apiHost: 'https://ingest.test', enableExceptionAutocapture: false })

    await Promise.all([
      gm.runWithIdentity('user_a', async () => {
        gm.identify('user_a')
        await gm.captureException(new Error('from a'))
      }),
      gm.runWithIdentity('user_b', async () => {
        gm.identify('user_b')
        await gm.captureException(new Error('from b'))
      }),
    ])

    const bodies = fetchImpl.mock.calls.map((call) => JSON.parse(call[1].body))
    const userForA = bodies.find((b) => b.exceptions[0].message === 'from a')?.user
    const userForB = bodies.find((b) => b.exceptions[0].message === 'from b')?.user
    expect(userForA.id).toBe('user_a')
    expect(userForB.id).toBe('user_b')
  })

  it('each instance has its own rate-limit bucket (per-instance, not process-global)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchImpl)

    const gmA = new GetMonitor('gm_a', {
      apiHost: 'https://ingest.test',
      enableExceptionAutocapture: false,
      rateLimit: { maxTokens: 1, refillIntervalMs: 10_000 },
    })
    const gmB = new GetMonitor('gm_b', {
      apiHost: 'https://ingest.test',
      enableExceptionAutocapture: false,
      rateLimit: { maxTokens: 1, refillIntervalMs: 10_000 },
    })

    await gmA.captureException(new TypeError('a1'))
    await gmA.captureException(new TypeError('a2')) // rate-limited on gmA's bucket
    await gmB.captureException(new TypeError('b1')) // gmB has its own bucket, not limited

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('enableExceptionAutocapture wires process-level hooks by default', () => {
    const gm = new GetMonitor('gm_test', { apiHost: 'https://ingest.test' })
    expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0)
    gm.shutdown()
    expect(process.listenerCount('uncaughtException')).toBe(0)
  })

  it('does not propagate a synchronous throw from a customer beforeCapture hook', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchImpl)

    const gm = new GetMonitor('gm_test', {
      apiHost: 'https://ingest.test',
      enableExceptionAutocapture: false,
      beforeCapture: () => {
        throw new Error('customer bug')
      },
    })

    await expect(gm.captureException(new Error('boom'))).resolves.toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('filters run before rate limiting, so ignored events do not consume rate-limit budget', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchImpl)

    const gm = new GetMonitor('gm_test', {
      apiHost: 'https://ingest.test',
      enableExceptionAutocapture: false,
      // Match on message, not type: the rate limiter buckets tokens per exception TYPE
      // (TokenBucketRateLimiter, keyed by `type`), so both events below are plain `Error`s
      // sharing one bucket -- if rate limiting ran before filtering, the ignored "noise"
      // event would consume the single token and "real bug" would also get dropped,
      // failing the assertion below. Giving the two events different `type`s (e.g. via
      // `error.name`) would defeat this test: each would get its own bucket and the
      // ordering bug would go undetected regardless of which check ran first.
      ignoreErrors: ['noise'],
      rateLimit: { maxTokens: 1, refillIntervalMs: 10_000 },
    })

    const noisy = new Error('noise')
    await gm.captureException(noisy)

    const real = new Error('real bug')
    await gm.captureException(real)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(body.exceptions[0].message).toBe('real bug')
  })
})
