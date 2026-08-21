import type Koa from 'koa'
import { safeCapture } from '@getmonitor/core'

interface CaptureTarget {
  captureAutomatic(error: unknown, mechanism: 'koa_error_handler', handled: boolean): Promise<void>
}

/**
 * Koa's ctx.onerror emits 'error' partway through producing the response (before it sets
 * headers/status and calls res.end) — this only observes and never touches
 * ctx.status/ctx.body/res, so it can't affect what Koa has already decided to send.
 */
export function setupKoaErrorHandler(client: CaptureTarget, app: Koa): void {
  app.on('error', (err: unknown) => {
    void safeCapture(() => client.captureAutomatic(err, 'koa_error_handler', true))
  })
}
