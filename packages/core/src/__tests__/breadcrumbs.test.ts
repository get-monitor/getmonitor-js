import { describe, it, expect } from 'vitest'
import { BreadcrumbBuffer } from '../breadcrumbs'

describe('BreadcrumbBuffer', () => {
  it('records breadcrumbs in insertion order', () => {
    const buffer = new BreadcrumbBuffer(20)
    buffer.add({ category: 'console', message: 'first' })
    buffer.add({ category: 'console', message: 'second' })

    const all = buffer.getAll()
    expect(all).toHaveLength(2)
    expect(all[0].message).toBe('first')
    expect(all[1].message).toBe('second')
  })

  it('caps at maxEntries, dropping the oldest first', () => {
    const buffer = new BreadcrumbBuffer(3)
    buffer.add({ category: 'console', message: '1' })
    buffer.add({ category: 'console', message: '2' })
    buffer.add({ category: 'console', message: '3' })
    buffer.add({ category: 'console', message: '4' })

    const all = buffer.getAll()
    expect(all.map((b) => b.message)).toEqual(['2', '3', '4'])
  })

  it('defaults level to "log" and stamps a timestamp', () => {
    const buffer = new BreadcrumbBuffer()
    buffer.add({ category: 'navigation', message: 'navigated' })

    const [crumb] = buffer.getAll()
    expect(crumb.level).toBe('log')
    expect(typeof crumb.timestamp).toBe('string')
  })

  it('defaults to a 20-entry cap when constructed with no argument', () => {
    const buffer = new BreadcrumbBuffer()
    for (let i = 0; i < 25; i++) {
      buffer.add({ category: 'console', message: String(i) })
    }
    expect(buffer.getAll()).toHaveLength(20)
  })

  it('clear() empties the buffer', () => {
    const buffer = new BreadcrumbBuffer()
    buffer.add({ category: 'console', message: 'x' })
    buffer.clear()
    expect(buffer.getAll()).toEqual([])
  })
})
