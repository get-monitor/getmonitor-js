// packages/node/src/GetMonitor.ts
import { hostname } from 'node:os'
import { AsyncLocalStorage } from 'node:async_hooks'
import {
  BreadcrumbBuffer,
  BreadcrumbInput,
  TokenBucketRateLimiter,
  HttpTransport,
  buildEvent,
  applyFilters,
  CoreConfig,
  CaptureOptions,
  ExceptionMechanism,
} from '@getmonitor/core'
import { installAutoCapture, AutoCaptureHandle } from './autoCapture'

const SDK_VERSION = '0.1.0'

export interface NodeInitOptions extends Omit<CoreConfig, 'apiKey'> {
  enableExceptionAutocapture?: boolean
}

interface Identity {
  id: string
  traits?: Record<string, unknown>
}

export class GetMonitor {
  private readonly config: NodeInitOptions & { apiKey: string }
  private readonly breadcrumbs: BreadcrumbBuffer
  private readonly rateLimiter: TokenBucketRateLimiter
  private readonly transport: HttpTransport
  private readonly identityStorage = new AsyncLocalStorage<Identity>()
  private globalIdentity: Identity | null = null
  private autoCaptureHandle: AutoCaptureHandle | null = null

  constructor(apiKey: string, options: NodeInitOptions) {
    this.config = { apiKey, ...options }
    this.breadcrumbs = new BreadcrumbBuffer(options.maxBreadcrumbs)
    this.rateLimiter = new TokenBucketRateLimiter(options.rateLimit)
    this.transport = new HttpTransport({ apiHost: options.apiHost, apiKey })

    if (options.enableExceptionAutocapture ?? true) {
      this.autoCaptureHandle = installAutoCapture(this)
    }
  }

  /**
   * Called outside a `runWithIdentity` scope, this sets a per-instance global identity shared
   * by every concurrent call on this `GetMonitor` — safe for single-user processes (e.g. a
   * CLI, a worker with one logical user at a time), but on a concurrent server calling this
   * directly from a request handler will leak one request's identity onto another's
   * in-flight events. Wrap request handling in `runWithIdentity(id, () => identify(id))` (or
   * call `identify` inside that scope) for per-request isolation.
   */
  identify(id: string, traits?: Record<string, unknown>): void {
    const store = this.identityStorage.getStore()
    if (store) {
      store.id = id
      store.traits = traits
    } else {
      this.globalIdentity = { id, traits }
    }
  }

  /** Scopes identify() calls made inside `fn` to this async context (per-request isolation). */
  runWithIdentity<T>(id: string, fn: () => T, traits?: Record<string, unknown>): T {
    return this.identityStorage.run({ id, traits }, fn)
  }

  addBreadcrumb(breadcrumb: BreadcrumbInput): void {
    this.breadcrumbs.add(breadcrumb)
  }

  captureException(error: unknown, extra?: CaptureOptions): Promise<void> {
    return this.dispatch(error, extra, 'manual', true, false)
  }

  captureExceptionImmediate(error: unknown, extra?: CaptureOptions): Promise<void> {
    return this.dispatch(error, extra, 'manual', true, true)
  }

  /** @internal used by autoCapture/expressMiddleware — not part of the public API */
  captureAutomatic(
    error: unknown,
    mechanism: ExceptionMechanism,
    handled: boolean,
    opts: { immediate?: boolean } = {}
  ): Promise<void> {
    return this.dispatch(error, undefined, mechanism, handled, opts.immediate ?? false)
  }

  shutdown(): void {
    this.autoCaptureHandle?.uninstall()
    this.autoCaptureHandle = null
  }

  private currentIdentity(): Identity | null {
    return this.identityStorage.getStore() ?? this.globalIdentity
  }

  private dispatch(
    error: unknown,
    extra: CaptureOptions | undefined,
    mechanism: ExceptionMechanism,
    handled: boolean,
    immediate: boolean
  ): Promise<void> {
    try {
      const identity = this.currentIdentity()

      const event = buildEvent({
        error,
        mechanism,
        handled,
        breadcrumbs: this.breadcrumbs.getAll(),
        user: identity ? { id: identity.id, ...identity.traits } : undefined,
        release: this.config.release,
        environment: this.config.environment,
        context: {
          hostname: hostname(),
          runtime: `node/${process.version}`,
          sdk: { name: '@getmonitor/node', version: SDK_VERSION },
        },
        options: extra,
      })

      // Filters (including a customer-supplied beforeCapture hook) run before rate limiting,
      // so an ignored/denied event never consumes rate-limit budget that a real event could
      // have used — see the identical ordering fix applied to @getmonitor/browser's
      // GetMonitor.ts (Task 14).
      const filtered = applyFilters(event, this.config)
      if (!filtered) return Promise.resolve()

      const primaryType = filtered.exceptions[filtered.exceptions.length - 1]?.type ?? 'Error'
      if (!this.rateLimiter.allow(primaryType)) {
        console.warn(`GetMonitor: rate limit exceeded for "${primaryType}", dropping event`)
        return Promise.resolve()
      }

      const sendPromise = immediate ? this.transport.sendImmediate(filtered) : this.transport.send(filtered)
      return sendPromise.catch((err) => {
        // A transport-layer failure (bad API key, network error, exhausted retries) must
        // never reject the promise returned to a customer's fire-and-forget captureException
        // call: Node crashes the process on an unhandled rejection by default since v15, which
        // would make an SDK ingestion outage take down the customer's own application.
        console.warn('GetMonitor: failed to send captured exception', err)
      })
    } catch (err) {
      // The SDK's own capture pipeline (including a customer-supplied beforeCapture hook)
      // must never itself become a new uncaught error at the captureException call site —
      // see the identical fix applied to @getmonitor/browser's GetMonitor.ts (Task 14).
      console.warn('GetMonitor: failed to capture exception', err)
      return Promise.resolve()
    }
  }
}
