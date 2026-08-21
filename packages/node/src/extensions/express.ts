import { safeCapture } from '@getmonitor/core'
import type { Application, NextFunction, Request, Response } from 'express'

interface CaptureTarget {
  captureAutomatic(error: unknown, mechanism: 'express_middleware', handled: boolean): Promise<void>
}

/**
 * Register after all routes and other middleware, before any custom error handlers you define
 * — Express only reaches error-handling middleware (4-arg functions) registered after the
 * route/middleware that threw.
 */
export function setupExpressErrorHandler(client: CaptureTarget, app: Application): void {
  app.use((err: unknown, _req: Request, _res: Response, next: NextFunction) => {
    void safeCapture(() => client.captureAutomatic(err, 'express_middleware', true))
    next(err)
  })
}
