# @getmonitor/cli

Framework-agnostic source map upload tool for GetMonitor error tracking. Used directly, or via
`@getmonitor/nextjs-config` / `@getmonitor/nuxt`, which call its programmatic API automatically
as part of a customer's build.

## What it does

For every `*.js` file with a resolvable source map under a directory, `processSourceMaps`:

1. Generates a debug ID and injects it into both the JS file and its source map.
2. Uploads the tagged source map to `{apiHost}/api/v1/sourcemaps`.
3. On a successful upload: deletes the `.map` file and strips the `//# sourceMappingURL=`
   comment from the JS file, so nothing readable ships publicly.
4. On a failed upload: leaves both files untouched, so the artifact can be retried.

A source map is resolved primarily via the JS file's `//# sourceMappingURL=` comment, falling
back to same-basename-plus-`.map` when there's no comment, it's a `data:` URI, or the referenced
file doesn't exist — this matters because bundlers don't always name maps predictably (content
hashes, CDN rewrites).

See the [Phase 2 design spec](../../docs/superpowers/specs/2026-08-09-phase-2-source-maps-design.md)
for the full architecture and upload contract.

## CLI usage

```bash
npm install --save-dev @getmonitor/cli
```

```bash
getmonitor sourcemaps upload ./dist \
  --api-host https://ingest.getmonitor.com \
  --release 1.4.2 \
  --auth-token $GETMONITOR_AUTH_TOKEN
```

`--release` and `--auth-token` are optional if `GETMONITOR_RELEASE` / `GETMONITOR_AUTH_TOKEN`
are set, or (for release) if the directory is inside a git working tree or has a reachable
`package.json` with a `version` field. Release resolution precedence: `--release` flag >
`GETMONITOR_RELEASE` env var > current git commit SHA > nearest `package.json`'s `version` field.

The auth token is a **secret credential**, separate from the public `gm_xxx` key the SDKs use —
never commit it or expose it client-side.

## Programmatic usage

```ts
import { processSourceMaps } from '@getmonitor/cli'

const result = await processSourceMaps({
  directory: './dist',
  apiHost: 'https://ingest.getmonitor.com',
  authToken: process.env.GETMONITOR_AUTH_TOKEN,
})

console.log(result.uploaded, result.failed)
```

This is what `@getmonitor/nextjs-config` and `@getmonitor/nuxt` call from their bundler's
build-finished hook — see those packages for the build-tool-integrated version of this flow.

## API reference

| Export | Signature |
| --- | --- |
| `processSourceMaps(options)` | `(ProcessSourceMapsOptions) => Promise<ProcessSourceMapsResult>` |

`ProcessSourceMapsOptions` = `{ directory: string; apiHost: string; release?: string; authToken?: string; fetchImpl?: typeof fetch }`
(`fetchImpl` is a test/dependency-injection hook — most consumers won't need it).
`ProcessSourceMapsResult` = `{ uploaded: string[]; failed: string[] }` — full on-disk paths of
each processed artifact, split by outcome.

## Development

```bash
pnpm --filter @getmonitor/cli build     # rollup -> dist/ (library ESM+CJS+.d.ts, plus dist/bin.js)
pnpm --filter @getmonitor/cli test      # vitest run (excludes e2e/)
pnpm --filter @getmonitor/cli test:e2e  # vitest run e2e/processSourceMaps.spec.ts — real esbuild output + real HTTP server
pnpm --filter @getmonitor/cli lint      # tsc --noEmit (src/) + tsc --noEmit -p e2e
```

The `e2e/` suite builds a real fixture through `esbuild`, runs `processSourceMaps` against the
real output, and asserts against a real (in-process) mock ingestion server — no mocked `fetch`.
