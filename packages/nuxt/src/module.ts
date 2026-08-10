// packages/nuxt/src/module.ts
import { defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from 'nuxt/schema'
import { processSourceMaps } from '@getmonitor/cli'

export interface ModuleOptions {
  apiHost: string
  authToken?: string
  release?: string
}

// Rollup's typescript plugin can't emit a portable `.d.ts` reference for defineNuxtModule's
// inferred return type — it resolves to the literal pnpm store path
// (`.pnpm/@nuxt+schema@.../node_modules/@nuxt/schema`) instead of a reachable module
// specifier, which silently drops `dist/module.d.ts` from the build (TS2742) even though
// `tsc --noEmit` reports no error. An explicit annotation, using the `nuxt/schema` subpath
// export (reachable since `nuxt` is already a dependency), sidesteps the inference entirely.
const getMonitorModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@getmonitor/nuxt',
    configKey: 'getmonitor',
  },
  setup(options, nuxt) {
    nuxt.options.sourcemap = { client: true, server: true }

    // 'close' fires once nuxi's build process has finished writing `.output/` — verified
    // against a real `nuxt build` in this package's e2e test (Task 13). If that test shows
    // `.output/` isn't fully written yet at this point, switch to Nitro's own
    // 'nitro:build:public-assets' hook, exposed via `nuxt.hooks.hook('close', ...)`'s sibling
    // `nitro:init` handler — see Nitro's hook docs.
    nuxt.hook('close', async () => {
      if (nuxt.options.dev || !options.apiHost) return

      const result = await processSourceMaps({
        directory: nuxt.options.rootDir + '/.output',
        apiHost: options.apiHost,
        authToken: options.authToken,
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
