// packages/browser/src/GetMonitor.ts
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
  UrlFilterOptions,
} from '@getmonitor/core'
import { installExceptionObserver, ExceptionObserverHandle } from './exceptionObserver'
import { installBreadcrumbSources } from './breadcrumbSources'

const SDK_VERSION = '0.1.0'

export interface BrowserInitOptions extends Omit<CoreConfig, 'apiKey'>, UrlFilterOptions {
  captureUnhandledErrors?: boolean
  captureUnhandledRejections?: boolean
  captureConsoleErrors?: boolean
}

/**
 * @internal Test-only host override, intersected into `init`'s options but deliberately not
 * part of the exported `BrowserInitOptions` type — see `HttpTransport`'s `TransportConfig.apiHost`.
 * The browser e2e suite passes this through `window.GetMonitor.init(...)` to redirect delivery
 * to its Playwright-controlled mock server; application code must never set it.
 */
interface InternalTestOverrides {
  apiHost?: string
}

interface Identity {
  id: string
  traits?: Record<string, unknown>
}

class GetMonitorClient {
  private config: (BrowserInitOptions & { apiKey: string }) | null = null
  private breadcrumbs = new BreadcrumbBuffer()
  private rateLimiter = new TokenBucketRateLimiter()
  private transport: HttpTransport | null = null
  private identity: Identity | null = null
  private observerHandle: ExceptionObserverHandle | null = null
  private breadcrumbSourcesInstalled = false

  init(apiKey: string, options: BrowserInitOptions & InternalTestOverrides = {}): void {
    this.config = { apiKey, ...options }
    this.rateLimiter = new TokenBucketRateLimiter(options.rateLimit)
    this.transport = new HttpTransport({ apiHost: options.apiHost, apiKey })

    this.observerHandle?.uninstall()
    this.observerHandle = installExceptionObserver(this, {
      captureUnhandledErrors: options.captureUnhandledErrors ?? true,
      captureUnhandledRejections: options.captureUnhandledRejections ?? true,
      captureConsoleErrors: options.captureConsoleErrors ?? true,
    })

    // installBreadcrumbSources monkey-patches console.log/info/warn and history.pushState
    // to write into whichever BreadcrumbBuffer is passed in at install time. Both the
    // buffer creation and the install must happen exactly once (not per init() call):
    // recreating the buffer on re-init while the console wrapper still closes over the
    // old one would silently stop breadcrumbs from reaching the buffer dispatch() reads.
    // (options.maxBreadcrumbs from a second init() call is intentionally ignored — re-init
    // isn't a primary supported flow, just made non-broken.)
    if (!this.breadcrumbSourcesInstalled) {
      this.breadcrumbs = new BreadcrumbBuffer(options.maxBreadcrumbs)
      installBreadcrumbSources(this.breadcrumbs)
      this.breadcrumbSourcesInstalled = true
    }
  }

  identify(id: string, traits?: Record<string, unknown>): void {
    this.identity = { id, traits }
  }

  addBreadcrumb(breadcrumb: BreadcrumbInput): void {
    this.breadcrumbs.add(breadcrumb)
  }

  captureException(error: unknown, extra?: CaptureOptions): Promise<void> {
    return this.dispatch(error, extra, 'manual', true)
  }

  /**
   * Public entry point for building custom capture integrations on top of the browser SDK
   * (e.g. `@getmonitor/react`'s error boundary). Unlike `captureException`, the caller
   * supplies its own `mechanism` and `handled` classification instead of always reporting
   * `'manual'`/`true`.
   */
  captureAutomatic(
    error: unknown,
    mechanism: ExceptionMechanism,
    handled: boolean,
    extra?: CaptureOptions
  ): Promise<void> {
    return this.dispatch(error, extra, mechanism, handled)
  }

  private dispatch(
    error: unknown,
    extra: CaptureOptions | undefined,
    mechanism: ExceptionMechanism,
    handled: boolean
  ): Promise<void> {
    if (!this.config || !this.transport) {
      console.warn('GetMonitor: captureException called before GetMonitor.init()')
      return Promise.resolve()
    }

    try {
      const event = buildEvent({
        error,
        mechanism,
        handled,
        breadcrumbs: this.breadcrumbs.getAll(),
        user: this.identity ? { id: this.identity.id, ...this.identity.traits } : undefined,
        release: this.config.release,
        environment: this.config.environment,
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          sdk: { name: '@getmonitor/browser', version: SDK_VERSION },
        },
        options: extra,
      })

      const filtered = applyFilters(event, this.config)
      if (!filtered) return Promise.resolve()

      const primaryType = filtered.exceptions[filtered.exceptions.length - 1]?.type ?? 'Error'
      if (!this.rateLimiter.allow(primaryType)) {
        console.warn(`GetMonitor: rate limit exceeded for "${primaryType}", dropping event`)
        return Promise.resolve()
      }

      return this.transport.send(filtered).catch((err) => {
        // A transport-layer failure (ad blocker, network error, exhausted retries) must never
        // reject the promise returned to a customer's fire-and-forget captureException call —
        // see the identical fix applied to @getmonitor/node's GetMonitor.ts (Task 18).
        console.warn('GetMonitor: failed to send captured exception', err)
      })
    } catch (err) {
      // The SDK's own capture pipeline (including a customer-supplied beforeCapture hook)
      // must never itself become a new uncaught error at the captureException call site.
      console.warn('GetMonitor: failed to capture exception', err)
      return Promise.resolve()
    }
  }
}

export const GetMonitor = new GetMonitorClient()
