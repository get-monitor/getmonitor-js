export type ExceptionMechanism =
  | 'uncaught_exception'
  | 'unhandled_rejection'
  | 'console_error'
  | 'manual'
  | 'react_error_boundary'
  | 'express_middleware'

export interface StackFrame {
  filename: string
  function: string
  lineno: number
  colno: number
  inApp: boolean
  // Populated by parseStackTrace when @getmonitor/cli's build-time injection registered a
  // debug ID for this frame's filename. See debugIdRegistry.ts.
  debugId?: string
}

export interface ExceptionValue {
  type: string
  message: string
  stacktrace: { frames: StackFrame[] }
}

export interface Breadcrumb {
  timestamp: string
  category: string
  message: string
  data?: Record<string, unknown>
  level?: 'log' | 'info' | 'warning' | 'error'
}

export interface GetMonitorEvent {
  eventId: string
  timestamp: string
  release?: string
  environment?: string
  fingerprint: string[]
  exceptions: ExceptionValue[]
  handled: boolean
  level: 'error' | 'warning' | 'info'
  mechanism: ExceptionMechanism
  breadcrumbs: Breadcrumb[]
  user?: Record<string, unknown>
  tags: Record<string, unknown>
  context: Record<string, unknown>
}

export interface CaptureOptions {
  tags?: Record<string, unknown>
  fingerprint?: string[]
  level?: GetMonitorEvent['level']
}

export interface FilterOptions {
  ignoreErrors?: (string | RegExp)[]
  beforeCapture?: (event: GetMonitorEvent) => GetMonitorEvent | null
}

/** Browser-only — matched against stack-frame source URLs. Not part of NodeInitOptions. */
export interface UrlFilterOptions {
  denyUrls?: (string | RegExp)[]
  allowUrls?: (string | RegExp)[]
}

export interface RateLimitOptions {
  maxTokens?: number
  refillIntervalMs?: number
}

export interface CoreConfig extends FilterOptions {
  apiKey: string
  apiHost: string
  environment?: string
  release?: string
  rateLimit?: RateLimitOptions
  maxBreadcrumbs?: number
}
