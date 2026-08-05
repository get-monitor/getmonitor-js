import { describe, it, expect } from 'vitest'
import { safeCapture } from '../safeCapture'

describe('safeCapture', () => {
  it('resolves normally when fn succeeds synchronously', async () => {
    let called = false
    await expect(
      safeCapture(() => {
        called = true
      })
    ).resolves.toBeUndefined()
    expect(called).toBe(true)
  })

  it('resolves normally when fn returns a resolving promise', async () => {
    await expect(safeCapture(() => Promise.resolve())).resolves.toBeUndefined()
  })

  it('does not throw and resolves when fn throws synchronously', async () => {
    await expect(
      safeCapture(() => {
        throw new Error('boom')
      })
    ).resolves.toBeUndefined()
  })

  it('does not reject and resolves when fn returns a rejecting promise', async () => {
    // Deliberately a plain closure with a manual counter, not vi.fn(): Vitest's mock
    // instrumentation marks a mock's returned promise "handled" internally regardless of
    // whether safeCapture's own .catch() runs, which would make this test pass even if
    // the isolation logic were removed. A plain closure is the only version of this test
    // that genuinely fails without the .catch().
    let calls = 0
    const fn = () => {
      calls++
      return Promise.reject(new Error('boom'))
    }

    await expect(safeCapture(fn)).resolves.toBeUndefined()
    expect(calls).toBe(1)
  })
})
