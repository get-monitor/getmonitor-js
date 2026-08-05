import { describe, it, expect } from 'vitest'
import { normalizeError } from '../normalizeError'

describe('normalizeError', () => {
  it('normalizes a plain Error into a single-element chain', () => {
    const [exc] = normalizeError(new TypeError('boom'))
    expect(exc.type).toBe('TypeError')
    expect(exc.message).toBe('boom')
  })

  it('walks the cause chain, root cause first, primary error last', () => {
    const root = new Error('root cause')
    const wrapped = new Error('wrapped', { cause: root })
    const chain = normalizeError(wrapped)
    expect(chain.map((e) => e.message)).toEqual(['root cause', 'wrapped'])
  })

  it('expands an AggregateError into its inner errors plus itself, itself last', () => {
    const agg = new AggregateError([new Error('a'), new Error('b')], 'both failed')
    const chain = normalizeError(agg)
    expect(chain.map((e) => e.message)).toEqual(['a', 'b', 'both failed'])
  })

  it('wraps a non-Error thrown value', () => {
    expect(normalizeError('just a string')).toEqual([
      { type: 'Error', message: 'just a string', stacktrace: { frames: [] } },
    ])
  })

  it('wraps a thrown plain object', () => {
    const chain = normalizeError({ code: 'ECONNRESET' })
    expect(chain).toHaveLength(1)
    expect(chain[0].message).toContain('ECONNRESET')
  })
})
