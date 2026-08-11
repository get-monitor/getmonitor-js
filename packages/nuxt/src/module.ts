// packages/nuxt/src/module.ts
import { defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from 'nuxt/schema'
import { processSourceMaps } from '@getmonitor/cli'

export interface ModuleOptions {
  authToken?: string
  release?: string
}

/**
 * @internal Test-only host override, intersected into the module's option type but
 * deliberately not part of the exported `ModuleOptions` — see `@getmonitor/cli`'s
 * `uploadSourceMap`'s `UploadSourceMapParams.apiHost`. The e2e suite writes this into a
 * generated `nuxt.config.ts` to redirect delivery to its mock server; real Nuxt configs must
 * never set it.
 */
interface InternalTestOverrides {
  apiHost?: string
}

// Rollup's typescript plugin can't emit a portable `.d.ts` reference for defineNuxtModule's
// inferred return type — it resolves to the literal pnpm store path
// (`.pnpm/@nuxt+schema@.../node_modules/@nuxt/schema`) instead of a reachable module
// specifier, which silently drops `dist/module.d.ts` from the build (TS2742) even though
// `tsc --noEmit` reports no error. An explicit annotation, using the `nuxt/schema` subpath
// export (reachable since `nuxt` is already a dependency), sidesteps the inference entirely.
const getMonitorModule: NuxtModule<ModuleOptions & InternalTestOverrides> = defineNuxtModule<
  ModuleOptions & InternalTestOverrides
>({
  meta: {
    name: '@getmonitor/nuxt',
    configKey: 'getmonitor',
  },
  setup(options, nuxt) {
    nuxt.options.sourcemap = { client: true, server: true }

    // 'close' fires once nuxi's build process has finished writing `.output/` — this is now
    // confirmed, not assumed. Verified against a real `nuxt build` (Task 13's e2e test,
    // packages/nuxt/e2e/build.spec.ts): both `.output/public/**` (client assets) and
    // `.output/server/**` (Nitro's node-server preset output, including its `*.mjs` chunks)
    // exist on disk with their full byte content by the time this hook body runs, and
    // processSourceMaps successfully uploads and strips every source map under both —
    // reproduced across multiple consecutive runs with no intermittent misses. (A real, separate
    // bug surfaced along the way and briefly looked like a "close fired too early" symptom:
    // discoverArtifacts originally matched only `*.js`, so Nitro's `*.mjs` server chunks were
    // silently skipped. That went away entirely once discoverArtifacts also matched
    // `.mjs`/`.cjs` — see packages/cli/src/discoverArtifacts.ts — proving it was never a
    // hook-timing issue.) No need for Nitro's own hooks here.
    nuxt.hook('close', async () => {
      // No apiHost gate anymore (the ingest host is fixed) — gate on whether the module is
      // actually configured instead, so installing it without an auth token stays a silent
      // no-op rather than failing every build. processSourceMaps does this same env var
      // fallback internally; it's duplicated here only for this early-return check.
      const authToken = options.authToken ?? process.env.GETMONITOR_AUTH_TOKEN
      if (nuxt.options.dev || !authToken) return

      const result = await processSourceMaps({
        directory: nuxt.options.rootDir + '/.output',
        apiHost: options.apiHost,
        authToken,
        release: options.release,
      })

      // Per the spec's Error Handling section: a partial/total upload failure must fail the
      // build, not ship silently without maps uploaded.
      if (result.failed.length > 0) {
        throw new Error(
          `GetMonitor: failed to upload ${result.failed.length} source map(s): ${result.failed.join(', ')}`,
        )
      }
    })
  },
})

export default getMonitorModule
