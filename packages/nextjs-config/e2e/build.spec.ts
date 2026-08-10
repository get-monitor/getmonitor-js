import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { startMockSourceMapServer, MockSourceMapServer } from '../../cli/e2e/fixtures/mockServer'

const fixtureDir = join(__dirname, 'fixtures/app')

// `next build` here runs against a `webpack.afterEmit` hook (withGetMonitor) that fetches the
// SAME process's in-process mock HTTP server over loopback. execFileSync (the plan's original
// choice) would block this process's whole event loop until the child exits — but that event
// loop is exactly what the mock server needs running to accept and answer that fetch, so the
// build's request would sit unread in the kernel socket buffer forever and the two processes
// would deadlock (verified empirically: this hung indefinitely until killed). spawn + a Promise
// keeps the event loop turning while `next build` runs as a real subprocess, so the mock server
// stays responsive.
function runNextBuild(cwd: string, stdio: 'inherit' | 'pipe'): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['next', 'build'], { cwd, stdio })

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
        reject(new Error(`next build exited with code ${code}${stderr ? `:\n${stderr}` : ''}`))
      }
    })
  })
}

describe('withGetMonitor e2e (real next build)', () => {
  let mockServer: MockSourceMapServer

  afterEach(async () => {
    rmSync(join(fixtureDir, '.next'), { recursive: true, force: true })
    rmSync(join(fixtureDir, 'next.config.js'), { force: true })
    await new Promise((resolve) => mockServer.server.close(resolve))
  })

  it('uploads client bundle source maps and strips them from .next/static', async () => {
    mockServer = await startMockSourceMapServer()

    writeFileSync(
      join(fixtureDir, 'next.config.js'),
      [
        "const { withGetMonitor } = require('@getmonitor/nextjs-config')",
        'module.exports = withGetMonitor(',
        '  {},',
        `  { apiHost: '${mockServer.url}', authToken: 'secret', release: '1.0.0-e2e' },`,
        ')',
      ].join('\n'),
    )

    await runNextBuild(fixtureDir, 'inherit')

    expect(mockServer.requests.length).toBeGreaterThan(0)
    expect(mockServer.requests[0].release).toBe('1.0.0-e2e')
    expect(mockServer.requests[0].filename).toMatch(/^chunks[/\\]/)
    expect(JSON.parse(mockServer.requests[0].sourcemap)).toMatchObject({
      debugId: mockServer.requests[0].debugId,
    })

    const staticChunksDir = join(fixtureDir, '.next/static')
    const hasRemainingMaps = existsSync(staticChunksDir) && anyMapFilesUnder(staticChunksDir)
    expect(hasRemainingMaps).toBe(false)
  }, 120_000)

  it('fails the build when the upload endpoint returns errors', async () => {
    mockServer = await startMockSourceMapServer({ fail: true })

    writeFileSync(
      join(fixtureDir, 'next.config.js'),
      [
        "const { withGetMonitor } = require('@getmonitor/nextjs-config')",
        'module.exports = withGetMonitor(',
        '  {},',
        `  { apiHost: '${mockServer.url}', authToken: 'secret', release: '1.0.0-e2e' },`,
        ')',
      ].join('\n'),
    )

    await expect(runNextBuild(fixtureDir, 'pipe')).rejects.toThrow()
    expect(mockServer.requests.length).toBeGreaterThan(0)
    expect(mockServer.requests[0].release).toBe('1.0.0-e2e')
  }, 120_000)
})

function anyMapFilesUnder(dir: string): boolean {
  const { readdirSync, statSync } = require('node:fs')
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
