import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { startMockIngestServer, type MockIngestServer } from '../../browser/e2e/fixtures/mockServer'

const fixtureDir = join(__dirname, 'fixtures/app')

function runViteBuild(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite', 'build'], { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`vite build exited with code ${code}`))
    })
  })
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g

function startVitePreview(cwd: string): Promise<{ process: ChildProcess; url: string }> {
  return new Promise((resolve, reject) => {
    // `detached: true` puts this child in its own process group (group id == its own pid).
    // That matters because `npx` doesn't exec into `vite` directly -- it stays running as an
    // `npm exec` wrapper with the real `vite preview` server as ITS child. Killing just the
    // `npx` process (the default, non-detached behavior) leaves that grandchild server running
    // forever as an orphan once this test process exits, listening on its port indefinitely.
    // Spawning detached lets afterEach below kill the whole group with one negative-pid signal.
    const child = spawn('npx', ['vite', 'preview', '--port', '0', '--strictPort'], { cwd, detached: true })
    let output = ''
    const onData = (chunk: Buffer) => {
      // Playwright's test runner sets FORCE_COLOR, which this child process inherits, so
      // vite's preview banner is wrapped in ANSI color codes (e.g. an escape sequence sits
      // between "localhost:" and the port digits). Strip them before matching the URL.
      output += chunk.toString().replace(ANSI_PATTERN, '')
      const match = output.match(/Local:\s+(http:\/\/localhost:\d+)\//)
      if (match) {
        child.stdout?.off('data', onData)
        resolve({ process: child, url: match[1] })
      }
    }
    child.stdout?.on('data', onData)
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== null) reject(new Error(`vite preview exited early with code ${code}`))
    })
  })
}

test.describe('GetMonitorErrorBoundary e2e (real vite build + real browser)', () => {
  let mock: MockIngestServer
  let preview: { process: ChildProcess; url: string }

  test.beforeAll(async () => {
    await runViteBuild(fixtureDir)
  })

  test.beforeEach(async () => {
    mock = await startMockIngestServer()
    preview = await startVitePreview(fixtureDir)
  })

  test.afterEach(async () => {
    mock.server.close()
    // Signal the whole detached process group (negative pid), not just the `npx` wrapper --
    // see the comment in startVitePreview for why a plain preview.process.kill() would leak
    // the actual vite preview server as an orphan.
    if (preview.process.pid) {
      try {
        process.kill(-preview.process.pid, 'SIGTERM')
      } catch {
        // Already exited; nothing to clean up.
      }
    }
  })

  test('reports a caught render error and shows the fallback UI', async ({ page }) => {
    await page.goto(`${preview.url}/?apiHost=${encodeURIComponent(mock.url)}`)
    await page.getByText('crash').click()

    await expect(page.getByText('Something went wrong')).toBeVisible()

    await page.waitForTimeout(200)
    expect(mock.requests).toHaveLength(1)
    const event = mock.requests[0] as { mechanism: string; handled: boolean; tags: { componentStack: string } }
    expect(event.mechanism).toBe('react_error_boundary')
    expect(event.handled).toBe(true)
    expect(typeof event.tags.componentStack).toBe('string')
  })
})
