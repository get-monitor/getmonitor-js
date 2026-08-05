import { test, expect } from '@playwright/test'
import path from 'node:path'
import { startMockIngestServer, MockIngestServer } from './fixtures/mockServer'

let mock: MockIngestServer

test.beforeEach(async ({ page }) => {
  mock = await startMockIngestServer()
  await page.goto(`file://${path.join(__dirname, 'fixtures/index.html')}`)
  await page.evaluate(
    (apiHost) => (window as any).GetMonitor.init('gm_e2e_test', { apiHost }),
    mock.url
  )
})

test.afterEach(() => {
  mock.server.close()
})

test('captures an unhandled window error', async ({ page }) => {
  await page.evaluate(() => (window as any).triggerUnhandledError())
  await page.waitForTimeout(200)

  expect(mock.requests).toHaveLength(1)
  expect((mock.requests[0] as any).mechanism).toBe('uncaught_exception')
  expect((mock.requests[0] as any).exceptions[0].message).toBe('e2e uncaught error')
})

test('captures an unhandled promise rejection', async ({ page }) => {
  await page.evaluate(() => (window as any).triggerUnhandledRejection())
  await page.waitForTimeout(200)

  expect(mock.requests).toHaveLength(1)
  expect((mock.requests[0] as any).mechanism).toBe('unhandled_rejection')
})

test('captures a console.error call', async ({ page }) => {
  await page.evaluate(() => (window as any).triggerConsoleError())
  await page.waitForTimeout(200)

  expect(mock.requests).toHaveLength(1)
  expect((mock.requests[0] as any).mechanism).toBe('console_error')
})

test('captures a manual captureException call', async ({ page }) => {
  await page.evaluate(() => (window as any).triggerManualCapture())
  await page.waitForTimeout(200)

  expect(mock.requests).toHaveLength(1)
  expect((mock.requests[0] as any).mechanism).toBe('manual')
})
