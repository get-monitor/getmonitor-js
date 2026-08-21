import type Koa from 'koa'
import { safeCapture } from '@getmonitor/core'

interface CaptureTarget {
  captureAutomatic(error: unknown, mechanism: 'koa_error_handler', handled: boolean): Promise<void>
}

/**
 * Koa's own ctx.onerror is always fully responsible for producing the response — this only
 * observes the 'error' event it emits afterward, matching setupExpressErrorHandler's shape.
 */
export function setupKoaErrorHandler(client: CaptureTarget, app: Koa): void {
  app.on('error', (err: unknown) => {
    void safeCapture(() => client.captureAutomatic(err, 'koa_error_handler', true))
  })
}
