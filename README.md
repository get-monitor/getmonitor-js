# getmonitor-js

JavaScript/TypeScript client SDKs for GetMonitor error tracking.

This repo owns the **client side only**: capturing exceptions in a browser tab or a Node process, normalizing them into a common event shape, and shipping them to `ingester-api`, GetMonitor's ingestion backend (a separate repo). See [`@getmonitor/core`](packages/core) for the wire contract these SDKs POST against.

## Packages

This is a pnpm + Turborepo monorepo. Every package is published independently under the `@getmonitor` npm scope.

| Package | Description |
| --- | --- |
| [`@getmonitor/core`](packages/core) | Shared internals: types, stack trace parser, rate limiter, breadcrumb buffer, fingerprinting, filtering, error normalization, HTTP transport. Not typically installed directly. |
| [`@getmonitor/browser`](packages/browser) | Browser SDK. Captures `window.onerror`, unhandled promise rejections, and `console.error`; ships as ESM, CJS, and a UMD `<script>` build. |
| [`@getmonitor/node`](packages/node) | Node SDK. Captures `uncaughtException`/`unhandledRejection`, plus an Express error-handling middleware. |
| [`@getmonitor/cli`](packages/cli) | Framework-agnostic source map upload tool: injects debug IDs, uploads to GetMonitor, and strips maps from the public build output. |
| [`@getmonitor/nextjs-config`](packages/nextjs-config) | Next.js config wrapper — enables source maps and runs `@getmonitor/cli`'s upload automatically as part of `next build`. |
| [`@getmonitor/nuxt`](packages/nuxt) | Nuxt module — the same, for `nuxt build`. |
| [`@getmonitor/react`](packages/react) | React error boundary (`<GetMonitorErrorBoundary>`) that reports caught render errors via `@getmonitor/browser`. |

**Current scope:** Phase 1 (capture engine — automatic + manual exception capture, breadcrumbs, filtering, rate limiting, delivery), Phase 2 (source maps — debug ID injection, upload, stripping; see `@getmonitor/cli`'s README for the upload contract), and Phase 3 (`@getmonitor/react`'s `<GetMonitorErrorBoundary>`).

## Quickstart

```bash
# Browser
npm install @getmonitor/browser
```
```ts
import { GetMonitor } from '@getmonitor/browser'

GetMonitor.init('gm_xxx')
GetMonitor.captureException(new Error('something broke'))
```

```bash
# Node
npm install @getmonitor/node
```
```ts
import { GetMonitor } from '@getmonitor/node'

const gm = new GetMonitor('gm_xxx')
gm.captureException(new Error('something broke'))
```

See each package's own README for the full API, configuration options, and framework integrations.

## Architecture

Both SDKs are thin, platform-specific shells around `@getmonitor/core`, which owns everything that doesn't differ between a browser tab and a Node process: the event schema, stack trace parsing, error normalization (cause chains, `AggregateError`), fingerprinting, `ignoreErrors`/`beforeCapture` filtering, the per-exception-type rate limiter, and the retrying HTTP transport. `@getmonitor/browser` and `@getmonitor/node` each add only what's genuinely platform-specific: how exceptions are observed (`window.onerror` vs. `process.on('uncaughtException')`), how user identity is scoped (a page-level singleton vs. `AsyncLocalStorage`-scoped per request), and how breadcrumbs are auto-recorded (console/nav/click vs. manual-only).

Every captured exception is POSTed as a single JSON event to `https://ingest.getmonitor.io/api/v1/exceptions` — the ingestion host is fixed and not customer-configurable — authenticated with a public, write-only project key (`gm_xxx`) — safe to ship inside a browser bundle, the same trust model as a Sentry DSN or PostHog project key. The full wire schema is documented in [`@getmonitor/core`](packages/core#event-schema).

## Development

Requirements: Node ≥20 (see `.nvmrc`), [pnpm](https://pnpm.io) 10.

```bash
pnpm install       # install workspace dependencies
pnpm build         # build all packages (turbo run build, topologically ordered)
pnpm test          # unit tests, all packages (turbo run test)
pnpm test:e2e      # integration tests against a real HTTP server / real browser (turbo run test:e2e)
pnpm lint          # type-check all packages, including e2e/ directories (turbo run lint)
```

Scope a command to one package with pnpm's `--filter`, e.g. `pnpm --filter @getmonitor/node test`.

Turborepo caches build/test/lint output keyed on file contents, so a second run with no changes returns instantly ("FULL TURBO"). `@getmonitor/core` must build before `browser`/`node` can type-check against it — `pnpm build` (or any script that depends on it) handles that ordering automatically via `turbo.json`.

There is currently no CI pipeline configured for this repo (no `.github/workflows`) — the commands above must be run locally before merging.

## License

Apache License 2.0
