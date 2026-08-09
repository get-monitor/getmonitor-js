import { describe, it, expect, afterEach } from 'vitest'
import { lookupDebugId } from '../debugIdRegistry'

describe('lookupDebugId', () => {
  afterEach(() => {
    delete (globalThis as { __getmonitorDebugIds?: unknown }).__getmonitorDebugIds
  })

  it('returns undefined when no registry is present', () => {
    expect(lookupDebugId('main.js')).toBeUndefined()
  })

  it('returns the registered debug ID for a known filename', () => {
    ;(globalThis as { __getmonitorDebugIds?: Record<string, string> }).__getmonitorDebugIds = {
      'main.js': 'abc-123',
    }
    expect(lookupDebugId('main.js')).toBe('abc-123')
  })

  it('returns undefined for a filename not in the registry', () => {
    ;(globalThis as { __getmonitorDebugIds?: Record<string, string> }).__getmonitorDebugIds = {
      'main.js': 'abc-123',
    }
    expect(lookupDebugId('other.js')).toBeUndefined()
  })
})
