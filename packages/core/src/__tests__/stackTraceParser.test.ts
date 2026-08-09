import { describe, it, expect, afterEach } from 'vitest'
import { parseStackTrace } from '../stackTraceParser'

describe('parseStackTrace', () => {
  it('parses a V8/Chrome-style stack trace, innermost call first', () => {
    const stack = [
      'TypeError: Cannot read properties of undefined',
      '    at submitOrder (https://app.example.com/checkout.js:42:9)',
      '    at HTMLButtonElement.onclick (https://app.example.com/checkout.js:10:3)',
    ].join('\n')

    const frames = parseStackTrace(stack)

    expect(frames).toHaveLength(2)
    expect(frames[0]).toEqual({
      filename: 'https://app.example.com/checkout.js',
      function: 'submitOrder',
      lineno: 42,
      colno: 9,
      inApp: true,
    })
    expect(frames[1]).toEqual({
      filename: 'https://app.example.com/checkout.js',
      function: 'HTMLButtonElement.onclick',
      lineno: 10,
      colno: 3,
      inApp: true,
    })
  })

  it('parses a Firefox/Gecko-style stack trace', () => {
    const stack = [
      'submitOrder@https://app.example.com/checkout.js:42:9',
      'onclick@https://app.example.com/checkout.js:10:3',
    ].join('\n')

    const frames = parseStackTrace(stack)

    expect(frames).toHaveLength(2)
    expect(frames[0].function).toBe('submitOrder')
    expect(frames[0].lineno).toBe(42)
    expect(frames[1].function).toBe('onclick')
  })

  it('marks node_modules and browser-extension frames as not in-app', () => {
    const stack = [
      'Error: boom',
      '    at foo (chrome-extension://abc123/content.js:1:1)',
      '    at bar (/app/node_modules/lib/index.js:5:5)',
    ].join('\n')

    const frames = parseStackTrace(stack)

    expect(frames.length).toBeGreaterThan(0)
    expect(frames.every((f) => f.inApp === false)).toBe(true)
  })

  it('returns an empty array for an undefined stack', () => {
    expect(parseStackTrace(undefined)).toEqual([])
  })
})

describe('parseStackTrace debug ID enrichment', () => {
  afterEach(() => {
    delete (globalThis as { __getmonitorDebugIds?: unknown }).__getmonitorDebugIds
  })

  it('attaches debugId to a frame when the registry has a match for its filename', () => {
    ;(globalThis as { __getmonitorDebugIds?: Record<string, string> }).__getmonitorDebugIds = {
      'https://app.example.com/checkout.js': 'debug-abc',
    }
    const stack = [
      'TypeError: x',
      '    at submitOrder (https://app.example.com/checkout.js:42:9)',
    ].join('\n')

    const frames = parseStackTrace(stack)

    expect(frames[0].debugId).toBe('debug-abc')
  })

  it('leaves debugId unset when there is no registry match', () => {
    const stack = [
      'TypeError: x',
      '    at submitOrder (https://app.example.com/checkout.js:42:9)',
    ].join('\n')

    const frames = parseStackTrace(stack)

    expect(frames[0].debugId).toBeUndefined()
  })
})
