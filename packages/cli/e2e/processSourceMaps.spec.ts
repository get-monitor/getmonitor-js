import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { processSourceMaps } from '../src/processSourceMaps'
import { startMockSourceMapServer, MockSourceMapServer } from './fixtures/mockServer'

describe('processSourceMaps e2e (real esbuild output)', () => {
  let outDir: string
  let mockServer: MockSourceMapServer

  afterEach(async () => {
    rmSync(outDir, { recursive: true, force: true })
    await new Promise((resolve) => mockServer.server.close(resolve))
  })

  it('uploads a real esbuild-built bundle and strips it from the output directory', async () => {
    outDir = mkdtempSync(join(tmpdir(), 'getmonitor-cli-e2e-'))
    mockServer = await startMockSourceMapServer()

    await build({
      entryPoints: [join(__dirname, 'fixtures/source/app.ts')],
      bundle: true,
      minify: true,
      sourcemap: true,
      outfile: join(outDir, 'app.js'),
    })

    const result = await processSourceMaps({
      directory: outDir,
      release: '1.0.0-e2e',
      authToken: 'secret',
      apiHost: mockServer.url,
    })

    expect(result.failed).toEqual([])
    expect(result.uploaded).toEqual([join(outDir, 'app.js')])

    expect(existsSync(join(outDir, 'app.js.map'))).toBe(false)
    const js = readFileSync(join(outDir, 'app.js'), 'utf8')
    expect(js).not.toContain('sourceMappingURL')

    expect(mockServer.requests).toHaveLength(1)
    expect(mockServer.requests[0].release).toBe('1.0.0-e2e')
    expect(JSON.parse(mockServer.requests[0].sourcemap)).toMatchObject({
      debugId: mockServer.requests[0].debugId,
    })
  })
})
