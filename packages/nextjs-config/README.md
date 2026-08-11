# @getmonitor/nextjs-config

Next.js config wrapper that enables production source maps and uploads them to GetMonitor
automatically as part of `next build` — no separate CI step needed.

## Usage

```bash
npm install --save-dev @getmonitor/nextjs-config
```

```js
// next.config.js
const { withGetMonitor } = require('@getmonitor/nextjs-config')

module.exports = withGetMonitor(
  {
    // ...your existing Next.js config
  },
  {
    authToken: process.env.GETMONITOR_AUTH_TOKEN,
    // release: '1.4.2', // optional — see @getmonitor/cli's README for auto-detection
  },
)
```

`withGetMonitor` sets `productionBrowserSourceMaps: true` and hooks into each production webpack
compilation to upload and strip that compilation's own source maps once its build finishes. It's
a no-op in `next dev`.

Next.js runs separate client and server (Node.js) compilations, plus an edge-runtime compilation
when middleware or edge API routes are present; the edge pass is skipped since it would otherwise
redundantly re-process the same server output directory. Output is read from `distDir` (defaults
to `.next`), so a custom `distDir` in your Next.js config is respected automatically.

Wraps [`@getmonitor/cli`](../cli)'s `processSourceMaps` — see that package's README for the
upload contract and auth token handling. As with the CLI, a failed upload fails the build rather
than shipping silently without maps uploaded.

## API reference

| Export | Signature |
| --- | --- |
| `withGetMonitor(nextConfig, options)` | `(NextConfig, GetMonitorNextOptions) => NextConfig` |

`GetMonitorNextOptions` = `{ authToken?: string; release?: string }`. Uploads always go to the
fixed GetMonitor ingest host — not customer-configurable.

## Development

```bash
pnpm --filter @getmonitor/nextjs-config build     # rollup -> dist/ (ESM+CJS+.d.ts)
pnpm --filter @getmonitor/nextjs-config test      # vitest run (excludes e2e/)
pnpm --filter @getmonitor/nextjs-config test:e2e  # vitest run e2e/build.spec.ts — real `next build` + real HTTP server
pnpm --filter @getmonitor/nextjs-config lint      # tsc --noEmit (src/) + tsc --noEmit -p e2e
```

The `e2e/` suite runs a real `next build` against a minimal fixture app, with `withGetMonitor`
pointed at a real (in-process) mock ingestion server — no mocked `fetch`, and no mocked
`next build`.
