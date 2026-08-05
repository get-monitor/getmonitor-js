# @getmonitor/core

Shared internals for GetMonitor's error-tracking SDKs. This package holds everything that's identical between `@getmonitor/browser` and `@getmonitor/node` — the event schema, stack trace parsing, error normalization, fingerprinting, filtering, rate limiting, and the HTTP transport that delivers events.

You generally don't install this directly — `@getmonitor/browser` and `@getmonitor/node` depend on it and re-export what you need. It's documented here because it's where the actual capture logic and wire contract live.

## Installation

```bash
npm install @getmonitor/core
```

## What's in here

| Export | Purpose |
| --- | --- |
| `GetMonitorEvent`, `ExceptionValue`, `StackFrame`, `Breadcrumb`, `ExceptionMechanism`, `CaptureOptions`, `FilterOptions`, `UrlFilterOptions`, `RateLimitOptions`, `CoreConfig` | Shared TypeScript types for the event schema and SDK config. |
| `buildEvent(params)` | Assembles a `GetMonitorEvent` from a raw thrown value plus context (breadcrumbs, user, release, environment). |
| `normalizeError(error)` | Turns any thrown value — an `Error`, a chained `error.cause`, an `AggregateError`, a plain string, anything — into an ordered `ExceptionValue[]` chain (root cause first, primary error last). |
| `parseStackTrace(stack)` | Clean-room V8/Firefox/Safari stack-frame parser (not vendored from Sentry/PostHog). Modern evergreen browsers only — IE frame formats aren't supported. |
| `computeDefaultFingerprint(exceptions)` | Default grouping key: exception type + message when there's no stack, otherwise type + the first in-app frame (`filename:function`). |
| `applyFilters(event, options)` / `matchesIgnoreErrors` / `matchesUrlFilters` | `ignoreErrors` (string/RegExp match against type or message), `denyUrls`/`allowUrls` (match against stack-frame filenames — browser-only in practice), and a `beforeCapture` hook that can mutate the event or return `null` to drop it. Filters run in that order, and always *before* rate limiting, so a dropped event never consumes rate-limit budget. |
| `TokenBucketRateLimiter` | Per-key (exception type) token bucket. Defaults: 10 tokens, refill 1/10s. Construct one per `GetMonitor` instance — it is not a process-global singleton. |
| `BreadcrumbBuffer` | Count-capped ring buffer (default 20 entries, oldest dropped first). `add()`/`getAll()`/`clear()`. |
| `HttpTransport` | Delivers events to `{apiHost}/api/v1/exceptions`. `send()` enqueues onto an in-memory retry queue (exponential backoff, 3 retries by default) and resolves once delivered or retries are exhausted; a failed send doesn't block subsequently queued sends. `sendImmediate()` sends inline with no queue and no retry — used where you need to guarantee delivery started before a process is allowed to exit. |
| `safeCapture(fn)` | Isolates a call site against both a synchronous throw and a rejected promise from `fn`, always resolving. Used everywhere the SDKs invoke their own instrumentation (`captureAutomatic`) or a customer-supplied hook (`beforeCapture`), so a bug in that code can never itself become a new uncaught exception or unhandled rejection. |
| `generateEventId()` | `crypto.randomUUID()` where available (Node ≥19, evergreen browsers), with a fallback UUIDv4-shaped generator otherwise. |

## Event schema

Both SDKs build and send the identical shape via `buildEvent` + `HttpTransport`:

```jsonc
POST {apiHost}/api/v1/exceptions
Authorization: Bearer <public project key>
Content-Type: application/json

{
  "eventId": "uuid",
  "timestamp": "2026-08-02T14:03:11.000Z",
  "release": "1.4.2",
  "environment": "production",
  "fingerprint": ["TypeError", "checkout.ts:42"],

  "exceptions": [
    {
      "type": "TypeError",
      "message": "Cannot read properties of undefined",
      "stacktrace": {
        "frames": [
          { "filename": "checkout.ts", "function": "submitOrder", "lineno": 42, "colno": 9, "inApp": true }
        ]
      }
    }
  ],

  "handled": false,
  "level": "error",
  "mechanism": "uncaught_exception",

  "breadcrumbs": [{ "timestamp": "...", "category": "console", "message": "...", "level": "log" }],
  "user": { "id": "user_123" },
  "tags": {},
  "context": {
    "url": "https://app.example.com/checkout",
    "userAgent": "...",
    "sdk": { "name": "@getmonitor/browser", "version": "0.1.0" }
  }
}
```

- `exceptions` is an array (root cause first) to support chained causes and `AggregateError`, not a single object.
- `mechanism` is one of: `uncaught_exception | unhandled_rejection | console_error | manual | react_error_boundary | express_middleware`.
- `context` differs by platform: browser sends `url`/`userAgent`; Node sends `hostname`/`runtime` instead.
- Auth is a public, write-only project key (`gm_xxx`) — safe to embed in a browser bundle, scoped ingest-only on the backend (same trust model as a Sentry DSN).

## Development

```bash
pnpm --filter @getmonitor/core build   # rollup -> dist/ (ESM + CJS + .d.ts)
pnpm --filter @getmonitor/core test    # vitest run
pnpm --filter @getmonitor/core lint    # tsc --noEmit
```

`@getmonitor/browser` and `@getmonitor/node` both consume this package via `workspace:*`, so it must build before either of them can type-check or bundle — `pnpm build` at the repo root handles this ordering via `turbo.json`.
