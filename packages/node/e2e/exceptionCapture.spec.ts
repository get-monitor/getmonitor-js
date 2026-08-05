import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { GetMonitor, setupExpressErrorHandler } from '../src/index'
import { startMockIngestServer, MockIngestServer } from './fixtures/mockServer'

// The unhandledRejection and Express-middleware capture paths are fire-and-forget:
// `safeCapture` isn't awaited by the code that triggers it (process's rejection listener,
// Express's next(err)), so the real HTTP POST to the mock server is still in flight when
// control returns to the test. A single `setImmediate` tick is NOT enough to observe it —
// empirically confirmed (via a standalone repro script) that a real fetch() round-trip to
// 127.0.0.1 takes on the order of tens of milliseconds, not one microtask tick. Poll instead
// of assuming a fixed delay is enough.
async function waitForRequests(mock: MockIngestServer, count: number, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  while (mock.requests.length < count) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${count} request(s); got ${mock.requests.length}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('end-to-end: all 4 Node capture mechanisms hit the real HTTP transport', () => {
  let mock: MockIngestServer
  let gm: GetMonitor

  beforeEach(async () => {
    mock = await startMockIngestServer()
    gm = new GetMonitor('gm_e2e_test', { apiHost: mock.url, enableExceptionAutocapture: true })
  })

  afterEach(() => {
    gm.shutdown()
    mock.server.close()
  })

  it('captures a manual captureException call', async () => {
    await gm.captureException(new Error('e2e manual'))
    expect(mock.requests).toHaveLength(1)
    expect((mock.requests[0] as any).mechanism).toBe('manual')
  })

  it('captures an unhandledRejection via the auto-capture hook', async () => {
    process.emit('unhandledRejection', new Error('e2e rejection'), Promise.resolve())
    await waitForRequests(mock, 1)

    expect(mock.requests).toHaveLength(1)
    expect((mock.requests[0] as any).mechanism).toBe('unhandled_rejection')
  })

  it('captures an Express route error via setupExpressErrorHandler', async () => {
    const app = express()
    app.get('/boom', () => {
      throw new Error('e2e express boom')
    })
    setupExpressErrorHandler(gm, app)

    await request(app).get('/boom')
    await waitForRequests(mock, 1)

    expect(mock.requests).toHaveLength(1)
    expect((mock.requests[0] as any).mechanism).toBe('express_middleware')
  })

  it('captureExceptionImmediate delivers before resolving', async () => {
    await gm.captureExceptionImmediate(new Error('e2e immediate'))
    expect(mock.requests).toHaveLength(1)
  })
})
