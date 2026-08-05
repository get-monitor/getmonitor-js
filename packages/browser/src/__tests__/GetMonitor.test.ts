import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetMonitor } from '../GetMonitor'

describe('GetMonitor (browser)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends a captureException call to the ingestion endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchSpy)

    GetMonitor.init('gm_test', { apiHost: 'https://ingest.test' })
    await GetMonitor.captureException(new TypeError('boom'))

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://ingest.test/api/v1/exceptions',
      expect.objectContaining({ method: 'POST' })
    )
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.exceptions[0].type).toBe('TypeError')
    expect(body.mechanism).toBe('manual')
    expect(body.handled).toBe(true)
  })

  it('attaches the identified user to subsequent captures', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchSpy)

    GetMonitor.init('gm_test', { apiHost: 'https://ingest.test' })
    GetMonitor.identify('user_123', { email: 'a@example.com' })
    await GetMonitor.captureException(new Error('boom'))

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.user).toEqual({ id: 'user_123', email: 'a@example.com' })
  })

  it('includes recorded breadcrumbs in the captured event', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchSpy)

    GetMonitor.init('gm_test', { apiHost: 'https://ingest.test' })
    GetMonitor.addBreadcrumb({ category: 'test', message: 'did a thing' })
    await GetMonitor.captureException(new Error('boom'))

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.breadcrumbs.some((b: { message: string }) => b.message === 'did a thing')).toBe(true)
  })

  it('drops the event when ignoreErrors matches', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchSpy)

    GetMonitor.init('gm_test', { apiHost: 'https://ingest.test', ignoreErrors: ['TypeError'] })
    await GetMonitor.captureException(new TypeError('boom'))

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('respects the per-exception-type rate limit', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchSpy)

    GetMonitor.init('gm_test', { apiHost: 'https://ingest.test', rateLimit: { maxTokens: 1, refillIntervalMs: 10_000 } })
    await GetMonitor.captureException(new TypeError('a'))
    await GetMonitor.captureException(new TypeError('b'))

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('drops the event when denyUrls matches a stack frame', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchSpy)

    GetMonitor.init('gm_test', { apiHost: 'https://ingest.test', denyUrls: ['chrome-extension://'] })
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at f (chrome-extension://abc/content.js:1:1)'
    await GetMonitor.captureException(error)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not propagate a synchronous throw from a customer beforeCapture hook', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchSpy)

    GetMonitor.init('gm_test', {
      apiHost: 'https://ingest.test',
      beforeCapture: () => {
        throw new Error('customer bug')
      },
    })

    await expect(GetMonitor.captureException(new Error('boom'))).resolves.toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('filters run before rate limiting, so denied events do not consume rate-limit budget', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchSpy)

    GetMonitor.init('gm_test', {
      apiHost: 'https://ingest.test',
      denyUrls: ['chrome-extension://'],
      rateLimit: { maxTokens: 1, refillIntervalMs: 10_000 },
    })

    const noisy = new Error('noise')
    noisy.stack = 'Error: noise\n    at f (chrome-extension://abc/content.js:1:1)'
    await GetMonitor.captureException(noisy)

    const real = new Error('real bug')
    await GetMonitor.captureException(real)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.exceptions[0].message).toBe('real bug')
  })

  it('does not reject when the transport fails to send', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', fetchSpy)

    GetMonitor.init('gm_test', { apiHost: 'https://ingest.test' })

    await expect(GetMonitor.captureException(new Error('boom'))).resolves.toBeUndefined()
  })
})
