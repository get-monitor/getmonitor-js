import { describe, it, expect, vi } from 'vitest'
import Koa from 'koa'
import request from 'supertest'
import { setupKoaErrorHandler } from '../extensions/koa'

describe('setupKoaErrorHandler', () => {
  it('captures errors thrown in middleware as koa_error_handler', async () => {
    const client = { captureAutomatic: vi.fn().mockResolvedValue(undefined) }
    const app = new Koa()
    app.use(() => {
      throw new Error('route boom')
    })
    setupKoaErrorHandler(client, app)

    const response = await request(app.callback()).get('/boom')

    expect(response.status).toBe(500)
    expect(client.captureAutomatic).toHaveBeenCalledWith(expect.any(Error), 'koa_error_handler', true)
  })

  it('does not interfere with successful requests', async () => {
    const client = { captureAutomatic: vi.fn() }
    const app = new Koa()
    app.use((ctx) => {
      ctx.status = 200
      ctx.body = 'fine'
    })
    setupKoaErrorHandler(client, app)

    const response = await request(app.callback()).get('/ok')

    expect(response.status).toBe(200)
    expect(client.captureAutomatic).not.toHaveBeenCalled()
  })

  it('does not crash the request when captureAutomatic throws synchronously', async () => {
    const client = {
      captureAutomatic: vi.fn(() => {
        throw new Error('captureAutomatic bug')
      }),
    }
    const app = new Koa()
    app.use(() => {
      throw new Error('route boom')
    })
    setupKoaErrorHandler(client, app)

    const response = await request(app.callback()).get('/boom')

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
    const app = new Koa()
    app.use(() => {
      throw new Error('route boom')
    })
    setupKoaErrorHandler(client, app)

    const response = await request(app.callback()).get('/boom')

    expect(response.status).toBe(500)
    expect(calls).toBe(1)
  })
})
