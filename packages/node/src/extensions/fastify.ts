import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { safeCapture } from '@getmonitor/core'

interface CaptureTarget {
  captureAutomatic(error: unknown, mechanism: 'fastify_hook', handled: boolean): Promise<void>
}

/**
 * Registers an onError lifecycle hook that fires after Fastify has already decided how to
 * respond — this only observes, it never calls reply.send() itself, matching
 * setupExpressErrorHandler's shape.
 */
export function setupFastifyErrorHandler(client: CaptureTarget, app: FastifyInstance): void {
  app.addHook('onError', (_request: FastifyRequest, _reply: FastifyReply, error: Error, done: () => void) => {
    void safeCapture(() => client.captureAutomatic(error, 'fastify_hook', true))
    done()
  })
}
