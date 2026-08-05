import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { setupExpressErrorHandler } from '../expressMiddleware'

describe('setupExpressErrorHandler', () => {
  it('captures errors thrown in a route handler as express_middleware', async () => {
    const client = { captureAutomatic: vi.fn().mockResolvedValue(undefined) }
    const app = express()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupExpressErrorHandler(client, app)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(500)
    expect(client.captureAutomatic).toHaveBeenCalledWith(expect.any(Error), 'express_middleware', true)
  })

  it('does not interfere with successful requests', async () => {
    const client = { captureAutomatic: vi.fn() }
    const app = express()
    app.get('/ok', (_req, res) => res.status(200).send('fine'))
    setupExpressErrorHandler(client, app)

    const response = await request(app).get('/ok')

    expect(response.status).toBe(200)
    expect(client.captureAutomatic).not.toHaveBeenCalled()
  })

  it('does not crash the request when captureAutomatic throws synchronously', async () => {
    const client = {
      captureAutomatic: vi.fn(() => {
        throw new Error('captureAutomatic bug')
      }),
    }
    const app = express()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupExpressErrorHandler(client, app)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(500)
    expect(client.captureAutomatic).toHaveBeenCalledTimes(1)
  })

  it('does not produce an unhandled rejection when captureAutomatic rejects', async () => {
    // Plain closure, not vi.fn(): vi.fn()'s own promise instrumentation marks a
    // mockImplementation-returned rejection "handled" independent of whether the source's
    // .catch() actually exists, which would make this test vacuous (see the identical fix
    // applied to packages/browser/src/__tests__/exceptionObserver.test.ts earlier in this plan).
    let calls = 0
    const client = {
      captureAutomatic: () => {
        calls++
        return Promise.reject(new Error('captureAutomatic bug'))
      },
    }
    const app = express()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupExpressErrorHandler(client, app)

    const response = await request(app).get('/boom')

    expect(response.status).toBe(500)
    expect(calls).toBe(1)
  })
})
