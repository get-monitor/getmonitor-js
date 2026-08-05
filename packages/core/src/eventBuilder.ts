// packages/core/src/eventBuilder.ts
import { Breadcrumb, CaptureOptions, ExceptionMechanism, GetMonitorEvent } from './types'
import { normalizeError } from './normalizeError'
import { computeDefaultFingerprint } from './fingerprint'
import { generateEventId } from './id'

export interface BuildEventParams {
  error: unknown
  mechanism: ExceptionMechanism
  handled: boolean
  breadcrumbs: Breadcrumb[]
  user?: Record<string, unknown>
  release?: string
  environment?: string
  context: Record<string, unknown>
  options?: CaptureOptions
}

export function buildEvent(params: BuildEventParams): GetMonitorEvent {
  const exceptions = normalizeError(params.error)

  return {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    release: params.release,
    environment: params.environment,
    fingerprint: params.options?.fingerprint ?? computeDefaultFingerprint(exceptions),
    exceptions,
    handled: params.handled,
    level: params.options?.level ?? 'error',
    mechanism: params.mechanism,
    breadcrumbs: params.breadcrumbs,
    user: params.user,
    tags: params.options?.tags ?? {},
    context: params.context,
  }
}
