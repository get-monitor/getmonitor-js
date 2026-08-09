// packages/nextjs-config/src/withGetMonitor.ts
import { processSourceMaps } from '@getmonitor/cli'

export interface GetMonitorNextOptions {
  apiHost: string
  authToken?: string
  release?: string
}

// Minimal structural shapes for the subset of Next.js/webpack config this plugin touches —
// avoids a hard dependency on `next`'s or `webpack`'s own types.
interface NextConfig {
  productionBrowserSourceMaps?: boolean
  distDir?: string
  webpack?: (config: WebpackConfig, context: WebpackContext) => WebpackConfig
  [key: string]: unknown
}

interface WebpackConfig {
  plugins?: unknown[]
  [key: string]: unknown
}

interface WebpackContext {
  isServer: boolean
  dev: boolean
  nextRuntime?: 'nodejs' | 'edge'
}

interface WebpackCompiler {
  hooks: {
    afterEmit: {
      tapPromise: (name: string, fn: () => Promise<void>) => void
    }
  }
}

export function withGetMonitor(nextConfig: NextConfig, options: GetMonitorNextOptions): NextConfig {
  const previousWebpack = nextConfig.webpack

  return {
    ...nextConfig,
    productionBrowserSourceMaps: true,
    webpack(config: WebpackConfig, context: WebpackContext) {
      const updated = previousWebpack ? previousWebpack(config, context) : config

      if (context.dev) return updated

      // Next.js runs three separate webpack compilations in a production build: client,
      // Node.js server, and (when middleware/edge API routes are present) an "edge" runtime
      // server. Only `isServer`/`nextRuntime` together distinguish all three — `isServer` alone
      // is true for both the Node server *and* the edge server compilation. The edge
      // compilation emits into `.next/server` alongside the Node server compilation, so routing
      // purely on `isServer` (as if only two compilations existed) would make the edge pass
      // re-run processSourceMaps against `.next/server` a second time: harmless in itself since
      // discoverArtifacts/processSourceMaps are idempotent over already-processed files (the
      // debug-ID-injected .js has no matching .map left to find), but wasteful and worth
      // avoiding explicitly. Skip the upload on the edge pass and let the Node server pass
      // (which always runs) own `.next/server`.
      if (context.nextRuntime === 'edge') return updated

      // Next.js emits into `distDir` (default `.next`) rather than a hardcoded `.next`, e.g.
      // customers with `distDir: 'build'` (common in monorepos/Docker setups). Reading it from
      // nextConfig avoids pointing processSourceMaps at a directory that doesn't exist.
      const outputRoot = nextConfig.distDir ?? '.next'
      const outputDirectory = context.isServer ? `${outputRoot}/server` : `${outputRoot}/static`
      return {
        ...updated,
        plugins: [...(updated.plugins ?? []), createUploadPlugin(outputDirectory, options)],
      }
    },
  }
}

function createUploadPlugin(outputDirectory: string, options: GetMonitorNextOptions) {
  return {
    apply(compiler: WebpackCompiler) {
      compiler.hooks.afterEmit.tapPromise('GetMonitorSourceMapUpload', async () => {
        const result = await processSourceMaps({
          directory: outputDirectory,
          apiHost: options.apiHost,
          authToken: options.authToken,
          release: options.release,
        })

        // Per the spec's Error Handling section: a partial/total upload failure must fail
        // the build, not ship silently without maps uploaded.
        if (result.failed.length > 0) {
          throw new Error(
            `GetMonitor: failed to upload ${result.failed.length} source map(s): ${result.failed.join(', ')}`,
          )
        }
      })
    },
  }
}
