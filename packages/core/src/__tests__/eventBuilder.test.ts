import { describe, it, expect } from 'vitest'
import { buildEvent } from '../eventBuilder'

describe('buildEvent', () => {
  it('assembles a complete event from a thrown Error', () => {
    const event = buildEvent({
      error: new TypeError('boom'),
      mechanism: 'manual',
      handled: true,
      breadcrumbs: [],
      context: { sdk: { name: '@getmonitor/node', version: '0.1.0' } },
    })

    expect(event.exceptions[0].type).toBe('TypeError')
    expect(event.handled).toBe(true)
    expect(event.mechanism).toBe('manual')
    expect(event.level).toBe('error')
    expect(event.eventId).toBeTruthy()
    expect(event.fingerprint.length).toBeGreaterThan(0)
    expect(typeof event.timestamp).toBe('string')
  })

  it('honors an explicit fingerprint, tags, and level from capture options', () => {
    const event = buildEvent({
      error: new Error('boom'),
      mechanism: 'manual',
      handled: true,
      breadcrumbs: [],
      context: {},
      options: { fingerprint: ['custom-group'], tags: { orderId: '123' }, level: 'warning' },
    })

    expect(event.fingerprint).toEqual(['custom-group'])
    expect(event.tags).toEqual({ orderId: '123' })
    expect(event.level).toBe('warning')
  })

  it('generates a unique eventId per call', () => {
    const a = buildEvent({ error: new Error('x'), mechanism: 'manual', handled: true, breadcrumbs: [], context: {} })
    const b = buildEvent({ error: new Error('x'), mechanism: 'manual', handled: true, breadcrumbs: [], context: {} })
    expect(a.eventId).not.toBe(b.eventId)
  })
})
