# @getmonitor/browser

Browser error-tracking SDK for GetMonitor. Automatically captures uncaught errors, unhandled promise rejections, and `console.error` calls; also supports manual capture, breadcrumbs, and client-side filtering. Ships as ESM, CJS, and a UMD `<script>` build.

## Installation

```bash
npm install @getmonitor/browser
```

Or, without a bundler, load the UMD build directly:

```html
<script src="https://unpkg.com/@getmonitor/browser/dist/index.umd.js"></script>
<script>
  GetMonitor.init('gm_xxx', { apiHost: 'https://ingest.getmonitor.com' })
</script>
```

## Quickstart

```ts
import { GetMonitor } from '@getmonitor/browser'

GetMonitor.init('gm_xxx', {
  apiHost: 'https://ingest.getmonitor.com',
  environment: 'production',
  release: '1.4.2',
})

GetMonitor.identify(userId, { plan: 'pro' })

try {
  submitOrder()
} catch (error) {
  GetMonitor.captureException(error)
}
```

`GetMonitor` is a **singleton**, not a class you instantiate — call `GetMonitor.init(...)` once per page load, then use the same import everywhere in your app.

## Automatic capture

Once `init()` is called, three sources are captured automatically, each independently toggleable (all **on** by default):

| Option | Default | Hooks | Wire `mechanism` |
| --- | --- | --- | --- |
| `captureUnhandledErrors` | `true` | `window.addEventListener('error', ...)` | `uncaught_exception` |
| `captureUnhandledRejections` | `true` | `window.addEventListener('unhandledrejection', ...)` | `unhandled_rejection` |
| `captureConsoleErrors` | `true` | wraps `console.error` | `console_error` |

```ts
GetMonitor.init('gm_xxx', {
  apiHost: '...',
  captureConsoleErrors: false, // e.g. disable if console.error is used for non-error logging
})
```

Every automatic capture is isolated against the SDK's own instrumentation failing — a bug in a `beforeCapture` hook, for instance, can't itself trigger a new `error`/`unhandledrejection` event and recurse.

## Manual capture

```ts
GetMonitor.captureException(error, {
  tags: { checkout_step: 'payment' },
  fingerprint: ['custom-group-key'],
  level: 'warning',
})
```

`captureException` returns `Promise<void>`, resolving once the event is delivered (or retries are exhausted) — safe to leave un-awaited for fire-and-forget use, or `await` it if you need to know delivery finished (e.g. before redirecting the user away from the page).

## Breadcrumbs

A count-capped ring buffer (last 20 entries) is attached to every captured exception, never sent standalone. Three sources are recorded automatically — `console.log`/`console.info`/`console.warn` calls, navigation (`popstate` and `history.pushState`), and clicks — plus a manual API:

```ts
GetMonitor.addBreadcrumb({
  category: 'checkout',
  message: 'user applied promo code',
  data: { code: 'SAVE10' },
})
```

## Filtering

```ts
GetMonitor.init('gm_xxx', {
  apiHost: '...',
  ignoreErrors: ['ResizeObserver loop limit exceeded', /^Network request failed/],
  denyUrls: [/extensions\//, 'chrome-extension://'],
  allowUrls: [/^https:\/\/app\.example\.com/],
  beforeCapture(event) {
    if (event.user?.internal) return null // drop events from internal test accounts
    event.fingerprint = ['custom-group']
    return event
  },
})
```

- `ignoreErrors` — string (substring match against type or message) or `RegExp`.
- `denyUrls` / `allowUrls` — matched against stack-frame source filenames. `denyUrls` drops a match; `allowUrls`, if set, drops anything that *doesn't* match.
- `beforeCapture(event)` — runs last, after `ignoreErrors`/`denyUrls`/`allowUrls`. Return the (optionally mutated) event, or `null` to drop it.

Filters always run before rate limiting, so a dropped event never consumes rate-limit budget that a real event could have used.

## Fingerprinting

By default, events are grouped by exception type + message (if there's no stack) or type + the first in-app stack frame. Override per-call via `captureException(error, { fingerprint: [...] })`, or globally via `beforeCapture`.

## Rate limiting

A per-exception-type token bucket (10 tokens, refill 1 token/10s by default) guards against a crash loop flooding ingestion. Configurable via `init({ rateLimit: { maxTokens, refillIntervalMs } })`. Exhausted buckets drop the event silently (with a `console.warn`), not an error.

## API reference

| Call | Signature |
| --- | --- |
| `GetMonitor.init(apiKey, options)` | `(string, BrowserInitOptions) => void` — must be called before anything else. |
| `GetMonitor.identify(id, traits?)` | `(string, Record<string, unknown>?) => void` |
| `GetMonitor.captureException(error, extra?)` | `(unknown, CaptureOptions?) => Promise<void>` |
| `GetMonitor.addBreadcrumb(breadcrumb)` | `({ category, message, data?, level? }) => void` |

`BrowserInitOptions` = `CoreConfig` (minus `apiKey`, passed separately) + `captureUnhandledErrors`/`captureUnhandledRejections`/`captureConsoleErrors` + `denyUrls`/`allowUrls`. See [`@getmonitor/core`](../core) for `CoreConfig`, `CaptureOptions`, and the full event schema.

## Development

```bash
pnpm --filter @getmonitor/browser build     # rollup -> dist/ (ESM + CJS + UMD + .d.ts)
pnpm --filter @getmonitor/browser test      # vitest run (jsdom)
pnpm --filter @getmonitor/browser test:e2e  # playwright test — real headless Chromium, real built UMD bundle, real local mock server
pnpm --filter @getmonitor/browser lint      # tsc --noEmit (src/) + tsc --noEmit -p e2e
```

The unit suite runs under jsdom with a mocked `fetch`; the Playwright suite in `e2e/` loads the actual built `dist/index.umd.js` in a real browser against a real local HTTP server — it exists specifically to catch bugs (like an unbound `fetch` reference causing `Illegal invocation`) that are structurally invisible to any test that mocks the fetch implementation.
