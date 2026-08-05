import { describe, it, expect } from 'vitest'
import { computeDefaultFingerprint } from '../fingerprint'
import { ExceptionValue } from '../types'

function exception(overrides: Partial<ExceptionValue> = {}): ExceptionValue {
  return {
    type: 'TypeError',
    message: 'boom',
    stacktrace: { frames: [] },
    ...overrides,
  }
}

describe('computeDefaultFingerprint', () => {
  it('falls back to type+message when there are no stack frames', () => {
    expect(computeDefaultFingerprint([exception()])).toEqual(['TypeError', 'boom'])
  })

  it('uses the deepest in-app frame when available', () => {
    const exc = exception({
      stacktrace: {
        frames: [
          { filename: 'node_modules/lib.js', function: 'libFn', lineno: 1, colno: 1, inApp: false },
          { filename: 'checkout.ts', function: 'submitOrder', lineno: 42, colno: 9, inApp: true },
        ],
      },
    })
    expect(computeDefaultFingerprint([exc])).toEqual(['TypeError', 'checkout.ts:submitOrder'])
  })

  it('falls back to the last frame when nothing is in-app', () => {
    const exc = exception({
      stacktrace: {
        frames: [{ filename: 'node_modules/lib.js', function: 'libFn', lineno: 1, colno: 1, inApp: false }],
      },
    })
    expect(computeDefaultFingerprint([exc])).toEqual(['TypeError', 'node_modules/lib.js:libFn'])
  })

  it('uses the last exception in the chain as the primary (outermost)', () => {
    const root = exception({ type: 'Error', message: 'root cause' })
    const wrapped = exception({ type: 'RangeError', message: 'wrapped' })
    expect(computeDefaultFingerprint([root, wrapped])).toEqual(['RangeError', 'wrapped'])
  })

  it('returns a sentinel fingerprint for an empty exception list', () => {
    expect(computeDefaultFingerprint([])).toEqual(['unknown'])
  })
})
