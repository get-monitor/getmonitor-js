import { describe, it, expect, vi } from 'vitest'
import { HttpTransport, DEFAULT_API_HOST } from '../httpClient'

describe('HttpTransport', () => {
  it('DEFAULT_API_HOST uses https, never plain http', () => {
    expect(DEFAULT_API_HOST).toMatch(/^https:\/\//)
  })

  it('defaults to DEFAULT_API_HOST when no apiHost override is given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const transport = new HttpTransport({ apiKey: 'gm_test', fetchImpl })

    await transport.sendImmediate({ eventId: '1' })

    expect(fetchImpl).toHaveBeenCalledWith(
      `${DEFAULT_API_HOST}/api/v1/exceptions`,
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('posts the event to /api/v1/exceptions with the project key header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const transport = new HttpTransport({ apiHost: 'https://ingest.test', apiKey: 'gm_test', fetchImpl })

    await transport.sendImmediate({ eventId: '1' })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://ingest.test/api/v1/exceptions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-GetMonitor-Project-Key': 'gm_test' }),
        body: JSON.stringify({ eventId: '1' }),
      })
    )
  })

  it('sendImmediate throws on a non-ok response with no retry', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const transport = new HttpTransport({ apiHost: 'https://ingest.test', apiKey: 'gm_test', fetchImpl })

    await expect(transport.sendImmediate({ eventId: '1' })).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('send retries on failure then resolves once a retry succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    const transport = new HttpTransport({
      apiHost: 'https://ingest.test',
      apiKey: 'gm_test',
      fetchImpl,
      retryBaseDelayMs: 1,
    })

    await transport.send({ eventId: '1' })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('retries when fetchImpl itself rejects (network error), not just on ok:false', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, status: 200 })
    const transport = new HttpTransport({
      apiHost: 'https://ingest.test',
      apiKey: 'gm_test',
      fetchImpl,
      retryBaseDelayMs: 1,
    })

    await transport.send({ eventId: '1' })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('send rejects after exhausting maxRetries', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const transport = new HttpTransport({
      apiHost: 'https://ingest.test',
      apiKey: 'gm_test',
      fetchImpl,
      maxRetries: 2,
      retryBaseDelayMs: 1,
    })

    await expect(transport.send({ eventId: '1' })).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('send serializes concurrent calls onto one queue without dropping any', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const transport = new HttpTransport({ apiHost: 'https://ingest.test', apiKey: 'gm_test', fetchImpl })

    await Promise.all([transport.send({ eventId: '1' }), transport.send({ eventId: '2' })])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
