import { describe, it, expect } from 'vitest'
import { applyFilters, matchesIgnoreErrors } from '../filters'
import { GetMonitorEvent } from '../types'

function baseEvent(overrides: Partial<GetMonitorEvent> = {}): GetMonitorEvent {
  return {
    eventId: '1',
    timestamp: new Date().toISOString(),
    fingerprint: ['TypeError'],
    exceptions: [{ type: 'TypeError', message: 'Script error', stacktrace: { frames: [] } }],
    handled: false,
    level: 'error',
    mechanism: 'manual',
    breadcrumbs: [],
    tags: {},
    context: {},
    ...overrides,
  }
}

describe('matchesIgnoreErrors', () => {
  it('matches by exact type string', () => {
    expect(matchesIgnoreErrors(baseEvent(), ['TypeError'])).toBe(true)
  })

  it('matches by message substring', () => {
    expect(matchesIgnoreErrors(baseEvent(), ['Script error'])).toBe(true)
  })

  it('matches by regex against type or message', () => {
    expect(matchesIgnoreErrors(baseEvent(), [/^Type/])).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(matchesIgnoreErrors(baseEvent(), ['RangeError'])).toBe(false)
  })
})

describe('applyFilters', () => {
  it('drops the event when it matches ignoreErrors', () => {
    expect(applyFilters(baseEvent(), { ignoreErrors: ['TypeError'] })).toBeNull()
  })

  it('runs beforeCapture and returns its (possibly mutated) result', () => {
    const result = applyFilters(baseEvent(), {
      beforeCapture: (event) => ({ ...event, fingerprint: ['custom'] }),
    })
    expect(result?.fingerprint).toEqual(['custom'])
  })

  it('lets beforeCapture drop the event by returning null', () => {
    expect(applyFilters(baseEvent(), { beforeCapture: () => null })).toBeNull()
  })

  it('passes the event through unchanged when no filters are configured', () => {
    const event = baseEvent()
    expect(applyFilters(event, {})).toBe(event)
  })

  it('drops the event when a frame filename matches denyUrls', () => {
    const event = baseEvent({
      exceptions: [
        {
          type: 'TypeError',
          message: 'boom',
          stacktrace: {
            frames: [{ filename: 'https://evil-extension.example/inject.js', function: 'f', lineno: 1, colno: 1, inApp: false }],
          },
        },
      ],
    })
    expect(applyFilters(event, { denyUrls: ['evil-extension.example'] })).toBeNull()
  })

  it('drops the event when allowUrls is set and no frame matches it', () => {
    const event = baseEvent({
      exceptions: [
        {
          type: 'TypeError',
          message: 'boom',
          stacktrace: { frames: [{ filename: 'https://other.example/app.js', function: 'f', lineno: 1, colno: 1, inApp: true }] },
        },
      ],
    })
    expect(applyFilters(event, { allowUrls: ['https://app.example.com'] })).toBeNull()
  })

  it('keeps the event when a frame matches allowUrls', () => {
    const event = baseEvent({
      exceptions: [
        {
          type: 'TypeError',
          message: 'boom',
          stacktrace: {
            frames: [{ filename: 'https://app.example.com/checkout.js', function: 'f', lineno: 1, colno: 1, inApp: true }],
          },
        },
      ],
    })
    expect(applyFilters(event, { allowUrls: ['https://app.example.com'] })).not.toBeNull()
  })

  it('ignores denyUrls/allowUrls entirely when neither is provided (Node case)', () => {
    const event = baseEvent()
    expect(applyFilters(event, { ignoreErrors: [] })).toBe(event)
  })
})
