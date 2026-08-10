# @getmonitor/nuxt

Nuxt module that enables client + server source maps and uploads them to GetMonitor
automatically as part of `nuxt build` — no separate CI step needed.

## Usage

```bash
npm install --save-dev @getmonitor/nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@getmonitor/nuxt'],
  getmonitor: {
    apiHost: 'https://ingest.getmonitor.com',
    authToken: process.env.GETMONITOR_AUTH_TOKEN,
    // release: '1.4.2', // optional — see @getmonitor/cli's README for auto-detection
  },
})
```

Uploads and strips source maps under `.output/` — both the client bundle (`.output/public`) and
the Nitro server build (`.output/server`, including its `.mjs` chunks) — once `nuxt build`
finishes. It's a no-op in `nuxt dev`.

Hooks into Nuxt's `close` lifecycle event, which fires only after `.output/` has been fully
written by Nitro.

Wraps [`@getmonitor/cli`](../cli)'s `processSourceMaps` — see that package's README for the
upload contract and auth token handling. As with the CLI, a failed upload fails the build rather
than shipping silently without maps uploaded.

## API reference

| Export | Signature |
| --- | --- |
| `default` (Nuxt module) | registered via `modules: ['@getmonitor/nuxt']` |

`ModuleOptions` (the `getmonitor` config key) = `{ apiHost: string; authToken?: string; release?: string }`.

## Development

```bash
pnpm --filter @getmonitor/nuxt build     # rollup -> dist/ (ESM+CJS+.d.ts)
pnpm --filter @getmonitor/nuxt test:e2e  # vitest run e2e/build.spec.ts — real `nuxt build` + real HTTP server
pnpm --filter @getmonitor/nuxt lint      # tsc --noEmit (src/) + tsc --noEmit -p e2e
```

No unit tests: `defineNuxtModule`'s setup function is a thin call into Nuxt's own hook system,
which isn't meaningfully testable without a real Nuxt instance — the `e2e/` suite (a real
`nuxt build` against a minimal fixture app, with a real in-process mock ingestion server, no
mocked `fetch`) is this package's only test coverage.
