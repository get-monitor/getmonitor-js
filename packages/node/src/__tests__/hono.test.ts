import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { setupHonoErrorHandler } from '../extensions/hono'

describe('setupHonoErrorHandler', () => {
  it('captures errors thrown in a route handler as hono_error_handler', async () => {
    const client = { captureAutomatic: vi.fn().mockResolvedValue(undefined) }
    const app = new Hono()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupHonoErrorHandler(client, app)

    const response = await app.request('/boom')

    expect(response.status).toBe(500)
    expect(client.captureAutomatic).toHaveBeenCalledWith(expect.any(Error), 'hono_error_handler', true)
  })

  it('does not interfere with successful requests', async () => {
    const client = { captureAutomatic: vi.fn() }
    const app = new Hono()
    app.get('/ok', (c) => c.text('fine', 200))
    setupHonoErrorHandler(client, app)

    const response = await app.request('/ok')

    expect(response.status).toBe(200)
    expect(client.captureAutomatic).not.toHaveBeenCalled()
  })

  it('uses a caller-supplied onError to produce a custom response', async () => {
    const client = { captureAutomatic: vi.fn().mockResolvedValue(undefined) }
    const app = new Hono()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupHonoErrorHandler(client, app, {
      onError: (_error, c) => c.json({ message: 'custom' }, 502),
    })

    const response = await app.request('/boom')

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ message: 'custom' })
  })

  it('does not crash the request when captureAutomatic throws synchronously', async () => {
    const client = {
      captureAutomatic: vi.fn(() => {
        throw new Error('captureAutomatic bug')
      }),
    }
    const app = new Hono()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupHonoErrorHandler(client, app)

    const response = await app.request('/boom')

    expect(response.status).toBe(500)
    expect(client.captureAutomatic).toHaveBeenCalledTimes(1)
  })

  it('does not produce an unhandled rejection when captureAutomatic rejects', async () => {
    let calls = 0
    const client = {
      captureAutomatic: () => {
        calls++
        return Promise.reject(new Error('captureAutomatic bug'))
      },
    }
    const app = new Hono()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupHonoErrorHandler(client, app)

    const response = await app.request('/boom')

    expect(response.status).toBe(500)
    expect(calls).toBe(1)
  })
})
