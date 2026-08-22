# @getmonitor/node

Node.js error-tracking SDK for GetMonitor. Automatically captures `uncaughtException`/`unhandledRejection`, provides error-handling integrations for Express, Fastify, Koa, Hono, and NestJS, and supports manual capture, breadcrumbs, and per-request identity scoping via `AsyncLocalStorage`.

## Installation

```bash
npm install @getmonitor/node
```

Framework support (Express, Fastify, Koa, Hono, NestJS) is provided via optional peer dependencies — install only the framework you use. See [Framework integrations](#framework-integrations).

## Quickstart

```ts
import { GetMonitor } from '@getmonitor/node'

const gm = new GetMonitor('gm_xxx', {
  environment: 'production',
  release: '1.4.2',
})

gm.identify(userId, { plan: 'pro' })

try {
  await processOrder()
} catch (error) {
  await gm.captureException(error)
}
```

Unlike the browser SDK, `GetMonitor` here is a **class you instantiate**, not a singleton — a single Node process can legitimately run multiple independent loggers (multiple projects/keys, multi-tenant services, test isolation), each with its own rate-limit budget and breadcrumb buffer.

## Identity scoping

`identify()` called outside a scope sets a per-instance **global** identity, shared by every concurrent call on that `GetMonitor` instance — fine for a CLI or a single-user script, but on a concurrent server it will leak one request's identity onto another in-flight request's events. For per-request isolation, wrap request handling in `runWithIdentity`:

```ts
app.use((req, res, next) => {
  gm.runWithIdentity(req.user.id, () => next(), { plan: req.user.plan })
})
```

`runWithIdentity(id, fn, traits?)` scopes `identify()`/the current identity to the `AsyncLocalStorage` context `fn` runs in, so concurrent requests never see each other's user data.

## Automatic capture

`enableExceptionAutocapture` (default `true`) hooks `process.on('uncaughtException')` and `process.on('unhandledRejection')`:

```ts
const gm = new GetMonitor('gm_xxx', { enableExceptionAutocapture: true })
```

| Hook | Wire `mechanism` |
| --- | --- |
| `process.on('uncaughtException')` | `uncaught_exception` |
| `process.on('unhandledRejection')` | `unhandled_rejection` |

Both hooks **await delivery** (via `captureExceptionImmediate` internally, not the queued `captureException`) before letting the process proceed — this is what prevents the event from being silently dropped because the process exits before the request to GetMonitor finishes. On `uncaughtException`, the process still terminates afterward via `process.exit(1)`, matching Node's own default behavior (registering a listener suppresses that default, so the SDK re-implements it). Each hook is isolated with `safeCapture`, so a bug in the SDK's own capture path can't itself become a new uncaught exception and recurse.

## Manual capture: `captureException` vs. `captureExceptionImmediate`

```ts
await gm.captureException(error, { tags: { job: 'payment-sync' } })
await gm.captureExceptionImmediate(error) // e.g. in a serverless/edge handler
```

- **`captureException`** enqueues onto an in-memory retry queue and returns once delivered or retries are exhausted; code that doesn't `await` it isn't blocked on delivery.
- **`captureExceptionImmediate`** sends inline, no queue, no retry — its promise resolves only when that single HTTP request completes. Use this wherever the process might exit right after the call returns (serverless functions, edge handlers, short-lived scripts) — it's the same mechanism the auto-capture hooks use internally to guarantee delivery isn't dropped on shutdown.

## Framework integrations

All five are optional peer dependencies — only install the framework you use. Each captures with `handled: true` and never blocks or delays the framework's own response on the ingest network round-trip (fire-and-forget, using the same `safeCapture` isolation as automatic capture).

### Express

```ts
import express from 'express'
import { setupExpressErrorHandler } from '@getmonitor/node'

const app = express()
// ...routes...

setupExpressErrorHandler(gm, app) // register after routes, before your own error handlers
```

Express only reaches error-handling (4-arg) middleware registered *after* the route/middleware that threw, so `setupExpressErrorHandler` must come after your routes. Captures with `mechanism: 'express_middleware'`, then calls `next(err)` so your own error handlers still run afterward.

### Fastify

```ts
import Fastify from 'fastify'
import { setupFastifyErrorHandler } from '@getmonitor/node'

const app = Fastify()
setupFastifyErrorHandler(gm, app)
```

Uses Fastify's `onError` lifecycle hook, which runs without altering Fastify's own default error response. Captures with `mechanism: 'fastify_hook'`.

### Koa

```ts
import Koa from 'koa'
import { setupKoaErrorHandler } from '@getmonitor/node'

const app = new Koa()
setupKoaErrorHandler(gm, app)
```

Listens on Koa's `app.on('error', ...)`, which Koa's own context error handler emits before it sets headers/status and calls `res.end()` — since the handler only observes and never touches `ctx.status`/`ctx.body`/the response itself, this can't affect what Koa ultimately sends. Captures with `mechanism: 'koa_error_handler'`.

### Hono

```ts
import { Hono } from 'hono'
import { setupHonoErrorHandler } from '@getmonitor/node'

const app = new Hono()
setupHonoErrorHandler(gm, app)
// Or with a custom response:
setupHonoErrorHandler(gm, app, {
  onError: (error, c) => c.json({ message: 'Something went wrong' }, 500),
})
```

Unlike the three above, Hono's `onError` handler's return value **is** the HTTP response — there's no default response already sent to observe after the fact. Without an `onError` option, this responds with a plain `500 Internal Server Error` text response (matching Hono's own built-in default). Captures with `mechanism: 'hono_error_handler'`.

### NestJS

NestJS support ships from a separate subpath, `@getmonitor/node/nestjs`, not the main package entry — this keeps `@nestjs/common`/`@nestjs/core` from being pulled in for every other framework's consumers.

```ts
import { HttpAdapterHost } from '@nestjs/core'
import { GetMonitorExceptionFilter } from '@getmonitor/node/nestjs'

const app = await NestFactory.create(AppModule)
const { httpAdapter } = app.get(HttpAdapterHost)
app.useGlobalFilters(new GetMonitorExceptionFilter(gm, httpAdapter))
```

Passing `httpAdapter` is required — this follows Nest's own documented "catch everything" pattern for a manually-constructed global filter (a filter built with `new`, rather than registered as a DI provider, isn't wired up by Nest's dependency injection, so `httpAdapter` must be provided explicitly). `GetMonitorExceptionFilter` extends `BaseExceptionFilter` and delegates to it after capturing, so Nest's normal HTTP response formatting is preserved. Captures with `mechanism: 'nestjs_filter'`.

## Breadcrumbs

Manual only — `addBreadcrumb()`. Unlike the browser SDK there's no automatic console/navigation/click capture: wrapping every `console.log` in a server process is noisy, and there's no navigation/click signal to record. Same count-capped ring buffer (last 20 entries) as browser, shared via `@getmonitor/core`.

```ts
gm.addBreadcrumb({ category: 'payment', message: 'calling Stripe', data: { orderId } })
```

## Filtering and rate limiting

`ignoreErrors` and `beforeCapture` work identically to the browser SDK (see [`@getmonitor/core`](../core)); `denyUrls`/`allowUrls` have no Node equivalent (they match stack-frame *source URLs*, a browser-specific concept). Rate limiting is the same per-exception-type token bucket (10 tokens, refill 1/10s by default, configurable via `rateLimit`), **scoped per `GetMonitor` instance** — multiple instances in one process never share a rate-limit budget.

## Shutdown

```ts
gm.shutdown() // uninstalls the uncaughtException/unhandledRejection listeners
```

Call this if you construct a `GetMonitor` instance with a lifetime shorter than the process (e.g. in tests) to avoid leaking `process` listeners.

## API reference

| Call | Signature |
| --- | --- |
| `new GetMonitor(apiKey, options)` | `(string, NodeInitOptions) => GetMonitor` |
| `.identify(id, traits?)` | `(string, Record<string, unknown>?) => void` |
| `.runWithIdentity(id, fn, traits?)` | `<T>(string, () => T, Record<string, unknown>?) => T` |
| `.captureException(error, extra?)` | `(unknown, CaptureOptions?) => Promise<void>` |
| `.captureExceptionImmediate(error, extra?)` | `(unknown, CaptureOptions?) => Promise<void>` |
| `.addBreadcrumb(breadcrumb)` | `({ category, message, data?, level? }) => void` |
| `.shutdown()` | `() => void` |
| `setupExpressErrorHandler(gm, app)` | `(GetMonitor, express.Application) => void` |
| `setupFastifyErrorHandler(gm, app)` | `(GetMonitor, FastifyInstance) => void` |
| `setupKoaErrorHandler(gm, app)` | `(GetMonitor, Koa) => void` |
| `setupHonoErrorHandler(gm, app, options?)` | `(GetMonitor, Hono, HonoErrorHandlerOptions?) => void` |
| `new GetMonitorExceptionFilter(gm, httpAdapter?)` (from `@getmonitor/node/nestjs`) | `(GetMonitor, HttpServer?) => GetMonitorExceptionFilter` |

`NodeInitOptions` = `CoreConfig` (minus `apiKey`, passed separately) + `enableExceptionAutocapture`. See [`@getmonitor/core`](../core) for `CoreConfig`, `CaptureOptions`, and the full event schema.

## Development

```bash
pnpm --filter @getmonitor/node build     # rollup -> dist/ (ESM + CJS + .d.ts)
pnpm --filter @getmonitor/node test      # vitest run (excludes e2e/)
pnpm --filter @getmonitor/node test:e2e  # vitest run e2e/exceptionCapture.spec.ts — real local HTTP server, all 4 capture mechanisms
pnpm --filter @getmonitor/node lint      # tsc --noEmit (src/) + tsc --noEmit -p e2e
```

The `e2e/` suite spins up a real `node:http` mock ingestion server and exercises manual capture, `unhandledRejection` auto-capture, the Express middleware, and `captureExceptionImmediate` against it — no mocked `fetch`. The `unhandledRejection` and Express-middleware paths are fire-and-forget internally, so their tests poll (`waitForRequests`) rather than assuming a fixed delay is enough for the real HTTP round-trip to complete.
