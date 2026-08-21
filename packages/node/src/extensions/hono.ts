import type { Hono, Context } from 'hono'
import { safeCapture } from '@getmonitor/core'

interface CaptureTarget {
  captureAutomatic(error: unknown, mechanism: 'hono_error_handler', handled: boolean): Promise<void>
}

export interface HonoErrorHandlerOptions {
  /** Produces the response after capture. Defaults to Hono's own built-in 500 text response. */
  onError?: (error: unknown, c: Context) => Response | Promise<Response>
}

/**
 * Unlike Express/Fastify/Koa, Hono's onError return value IS the HTTP response — there's no
 * "default already sent" step to observe after the fact, so this must produce one itself.
 */
export function setupHonoErrorHandler(
  client: CaptureTarget,
  app: Hono,
  options: HonoErrorHandlerOptions = {}
): void {
  app.onError((error, c) => {
    void safeCapture(() => client.captureAutomatic(error, 'hono_error_handler', true))
    return options.onError ? options.onError(error, c) : c.text('Internal Server Error', 500)
  })
}
