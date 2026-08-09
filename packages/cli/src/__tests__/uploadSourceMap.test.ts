import { describe, it, expect, vi } from 'vitest'
import { uploadSourceMap } from '../uploadSourceMap'

describe('uploadSourceMap', () => {
  it('posts release, debugId, filename, and the map content as multipart form data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    await uploadSourceMap({
      apiHost: 'https://ingest.test',
      authToken: 'secret-token',
      release: '1.2.3',
      debugId: 'debug-abc',
      filename: 'static/main.js',
      mapContent: '{"version":3}',
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ingest.test/api/v1/sourcemaps')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer secret-token')

    const form = init.body as FormData
    expect(form.get('release')).toBe('1.2.3')
    expect(form.get('debugId')).toBe('debug-abc')
    expect(form.get('filename')).toBe('static/main.js')
    expect(await (form.get('sourcemap') as Blob).text()).toBe('{"version":3}')
  })

  it('throws on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' })

    await expect(
      uploadSourceMap({
        apiHost: 'https://ingest.test',
        authToken: 'secret-token',
        release: '1.2.3',
        debugId: 'debug-abc',
        filename: 'static/main.js',
        mapContent: '{}',
        fetchImpl,
      }),
    ).rejects.toThrow(/500/)
  })
})
