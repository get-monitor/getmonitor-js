import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { startMockSourceMapServer, MockSourceMapServer } from '../../cli/e2e/fixtures/mockServer'

const fixtureDir = join(__dirname, 'fixtures/app')

// `nuxi build` here runs against a `close` hook (module.ts) that fetches the SAME process's
// in-process mock HTTP server over loopback. execFileSync (the plan's original choice) would
// block this process's whole event loop until the child exits — but that event loop is exactly
// what the mock server needs running to accept and answer that fetch, so the build's request
// would sit unread in the kernel socket buffer forever and the two processes would deadlock.
// This is the exact same failure mode already found and fixed in nextjs-config's e2e test
// (Task 10) — see that package's `e2e/build.spec.ts` for the original repro. spawn + a Promise
// keeps the event loop turning while `nuxi build` runs as a real subprocess, so the mock server
// stays responsive.
function runNuxtBuild(cwd: string, stdio: 'inherit' | 'pipe'): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['nuxi', 'build', '.'], { cwd, stdio })

    let stderr = ''
    if (stdio === 'pipe' && child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk
      })
    }

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`nuxi build exited with code ${code}${stderr ? `:\n${stderr}` : ''}`))
      }
    })
  })
}

describe('@getmonitor/nuxt e2e (real nuxt build)', () => {
  let mockServer: MockSourceMapServer

  afterEach(async () => {
    rmSync(join(fixtureDir, '.output'), { recursive: true, force: true })
    rmSync(join(fixtureDir, '.nuxt'), { recursive: true, force: true })
    rmSync(join(fixtureDir, 'nuxt.config.ts'), { force: true })
    await new Promise((resolve) => mockServer.server.close(resolve))
  })

  it('uploads bundle source maps and strips them from .output', async () => {
    mockServer = await startMockSourceMapServer()

    writeFileSync(
      join(fixtureDir, 'nuxt.config.ts'),
      [
        "export default defineNuxtConfig({",
        "  modules: ['@getmonitor/nuxt'],",
        '  getmonitor: {',
        `    apiHost: '${mockServer.url}',`,
        "    authToken: 'secret',",
        "    release: '1.0.0-e2e',",
        '  },',
        '})',
      ].join('\n'),
    )

    await runNuxtBuild(fixtureDir, 'inherit')

    expect(mockServer.requests.length).toBeGreaterThan(0)
    expect(mockServer.requests[0].release).toBe('1.0.0-e2e')
    expect(mockServer.requests[0].filename).toMatch(/\.(js|mjs|cjs)$/)
    expect(JSON.parse(mockServer.requests[0].sourcemap)).toMatchObject({
      debugId: mockServer.requests[0].debugId,
    })

    const outputDir = join(fixtureDir, '.output')
    expect(existsSync(outputDir)).toBe(true)
    expect(anyMapFilesUnder(outputDir)).toBe(false)
  }, 180_000)

  it('fails the build when the upload endpoint returns errors', async () => {
    mockServer = await startMockSourceMapServer({ fail: true })

    writeFileSync(
      join(fixtureDir, 'nuxt.config.ts'),
      [
        "export default defineNuxtConfig({",
        "  modules: ['@getmonitor/nuxt'],",
        '  getmonitor: {',
        `    apiHost: '${mockServer.url}',`,
        "    authToken: 'secret',",
        "    release: '1.0.0-e2e',",
        '  },',
        '})',
      ].join('\n'),
    )

    await expect(runNuxtBuild(fixtureDir, 'pipe')).rejects.toThrow()
    expect(mockServer.requests.length).toBeGreaterThan(0)
    expect(mockServer.requests[0].release).toBe('1.0.0-e2e')
  }, 180_000)
})

function anyMapFilesUnder(dir: string): boolean {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (anyMapFilesUnder(full)) return true
    } else if (entry.endsWith('.map')) {
      return true
    }
  }
  return false
}
