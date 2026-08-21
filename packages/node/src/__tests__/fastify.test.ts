import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import { setupFastifyErrorHandler } from '../extensions/fastify'

describe('setupFastifyErrorHandler', () => {
  it('captures errors thrown in a route handler as fastify_hook', async () => {
    const client = { captureAutomatic: vi.fn().mockResolvedValue(undefined) }
    const app = Fastify()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupFastifyErrorHandler(client, app)

    const response = await app.inject({ method: 'GET', url: '/boom' })

    expect(response.statusCode).toBe(500)
    expect(client.captureAutomatic).toHaveBeenCalledWith(expect.any(Error), 'fastify_hook', true)
  })

  it('does not interfere with successful requests', async () => {
    const client = { captureAutomatic: vi.fn() }
    const app = Fastify()
    app.get('/ok', async () => 'fine')
    setupFastifyErrorHandler(client, app)

    const response = await app.inject({ method: 'GET', url: '/ok' })

    expect(response.statusCode).toBe(200)
    expect(client.captureAutomatic).not.toHaveBeenCalled()
  })

  it('does not crash the request when captureAutomatic throws synchronously', async () => {
    const client = {
      captureAutomatic: vi.fn(() => {
        throw new Error('captureAutomatic bug')
      }),
    }
    const app = Fastify()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupFastifyErrorHandler(client, app)

    const response = await app.inject({ method: 'GET', url: '/boom' })

    expect(response.statusCode).toBe(500)
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
    const app = Fastify()
    app.get('/boom', () => {
      throw new Error('route boom')
    })
    setupFastifyErrorHandler(client, app)

    const response = await app.inject({ method: 'GET', url: '/boom' })

    expect(response.statusCode).toBe(500)
    expect(calls).toBe(1)
  })
})
