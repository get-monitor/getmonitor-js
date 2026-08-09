import { describe, it, expect, vi } from 'vitest'

const processSourceMapsMock = vi.fn().mockResolvedValue({ uploaded: [], failed: [] })
vi.mock('@getmonitor/cli', () => ({ processSourceMaps: (...args: unknown[]) => processSourceMapsMock(...args) }))

import { withGetMonitor } from '../withGetMonitor'

function createFakeCompiler() {
  const afterEmitHooks: Array<() => Promise<void>> = []
  return {
    hooks: {
      afterEmit: {
        tapPromise: (_name: string, fn: () => Promise<void>) => {
          afterEmitHooks.push(fn)
        },
      },
    },
    async triggerAfterEmit() {
      for (const fn of afterEmitHooks) await fn()
    },
  }
}

describe('withGetMonitor', () => {
  it('forces productionBrowserSourceMaps on', () => {
    const config = withGetMonitor({}, { apiHost: 'https://ingest.test' })
    expect(config.productionBrowserSourceMaps).toBe(true)
  })

  it('preserves an existing webpack config callback', () => {
    const previousWebpack = vi.fn((cfg) => ({ ...cfg, marker: 'from-previous' }))
    const config = withGetMonitor({ webpack: previousWebpack }, { apiHost: 'https://ingest.test' })

    const result = config.webpack!({}, { isServer: false, dev: false })

    expect(previousWebpack).toHaveBeenCalled()
    expect(result.marker).toBe('from-previous')
  })

  it('does not register an upload plugin in dev mode', () => {
    const config = withGetMonitor({}, { apiHost: 'https://ingest.test' })
    const result = config.webpack!({}, { isServer: false, dev: true })
    expect(result.plugins ?? []).toEqual([])
  })

  it('registers an upload plugin in production builds', () => {
    const config = withGetMonitor({}, { apiHost: 'https://ingest.test' })
    const result = config.webpack!({}, { isServer: false, dev: false })
    expect(result.plugins).toHaveLength(1)
  })

  it('does not register a second upload plugin for the edge runtime compilation', () => {
    // Next.js runs client, Node server, and (when middleware/edge routes exist) an edge server
    // compilation. Both server compilations report isServer: true and emit into .next/server —
    // only nextRuntime distinguishes the edge pass. Without excluding it, the Node server pass's
    // upload of .next/server would be redundantly repeated by the edge pass.
    const config = withGetMonitor({}, { apiHost: 'https://ingest.test' })
    const result = config.webpack!({}, { isServer: true, dev: false, nextRuntime: 'edge' })
    expect(result.plugins ?? []).toEqual([])
  })

  it('registers an upload plugin for the Node server compilation', () => {
    // isServer: true without nextRuntime (or with nextRuntime: 'nodejs') is the legitimate
    // server compilation pass — proves the edge-guard above doesn't also exclude this case.
    const config = withGetMonitor({}, { apiHost: 'https://ingest.test' })
    const result = config.webpack!({}, { isServer: true, dev: false })
    expect(result.plugins).toHaveLength(1)

    const resultNodejs = config.webpack!({}, { isServer: true, dev: false, nextRuntime: 'nodejs' })
    expect(resultNodejs.plugins).toHaveLength(1)
  })

  it('uploads from .next/static for the client compilation', async () => {
    const config = withGetMonitor({}, { apiHost: 'https://ingest.test' })
    const result = config.webpack!({}, { isServer: false, dev: false })
    const plugin = result.plugins![0] as { apply: (compiler: ReturnType<typeof createFakeCompiler>) => void }
    const compiler = createFakeCompiler()
    plugin.apply(compiler)

    await compiler.triggerAfterEmit()

    expect(processSourceMapsMock).toHaveBeenCalledWith(expect.objectContaining({ directory: '.next/static' }))
  })

  it('uploads from .next/server for the Node server compilation', async () => {
    const config = withGetMonitor({}, { apiHost: 'https://ingest.test' })
    const result = config.webpack!({}, { isServer: true, dev: false })
    const plugin = result.plugins![0] as { apply: (compiler: ReturnType<typeof createFakeCompiler>) => void }
    const compiler = createFakeCompiler()
    plugin.apply(compiler)

    await compiler.triggerAfterEmit()

    expect(processSourceMapsMock).toHaveBeenCalledWith(expect.objectContaining({ directory: '.next/server' }))
  })

  it('routes uploads through a custom distDir', async () => {
    // Next.js's distDir option (common in monorepos/Docker setups) relocates the entire .next
    // output — the upload directory must follow it or processSourceMaps ENOENTs against a
    // hardcoded '.next/...' path that doesn't exist for these customers.
    const config = withGetMonitor({ distDir: 'build' }, { apiHost: 'https://ingest.test' })

    const clientResult = config.webpack!({}, { isServer: false, dev: false })
    const clientPlugin = clientResult.plugins![0] as {
      apply: (compiler: ReturnType<typeof createFakeCompiler>) => void
    }
    const clientCompiler = createFakeCompiler()
    clientPlugin.apply(clientCompiler)
    await clientCompiler.triggerAfterEmit()
    expect(processSourceMapsMock).toHaveBeenCalledWith(expect.objectContaining({ directory: 'build/static' }))

    const serverResult = config.webpack!({}, { isServer: true, dev: false })
    const serverPlugin = serverResult.plugins![0] as {
      apply: (compiler: ReturnType<typeof createFakeCompiler>) => void
    }
    const serverCompiler = createFakeCompiler()
    serverPlugin.apply(serverCompiler)
    await serverCompiler.triggerAfterEmit()
    expect(processSourceMapsMock).toHaveBeenCalledWith(expect.objectContaining({ directory: 'build/server' }))
  })

  it("fails the build when processSourceMaps reports failed uploads", async () => {
    processSourceMapsMock.mockResolvedValue({ uploaded: [], failed: ['static/chunks/main.js'] })

    const config = withGetMonitor({}, { apiHost: 'https://ingest.test' })
    const result = config.webpack!({}, { isServer: false, dev: false })
    const plugin = result.plugins![0] as { apply: (compiler: ReturnType<typeof createFakeCompiler>) => void }
    const compiler = createFakeCompiler()
    plugin.apply(compiler)

    await expect(compiler.triggerAfterEmit()).rejects.toThrow(/1 source map/)
  })

  it('does not throw when processSourceMaps reports no failures', async () => {
    processSourceMapsMock.mockResolvedValue({ uploaded: ['static/chunks/main.js'], failed: [] })

    const config = withGetMonitor({}, { apiHost: 'https://ingest.test' })
    const result = config.webpack!({}, { isServer: false, dev: false })
    const plugin = result.plugins![0] as { apply: (compiler: ReturnType<typeof createFakeCompiler>) => void }
    const compiler = createFakeCompiler()
    plugin.apply(compiler)

    await expect(compiler.triggerAfterEmit()).resolves.toBeUndefined()
  })
})
