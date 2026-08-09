import { describe, it, expect, afterEach } from 'vitest'
import { injectDebugId } from '../injectDebugId'

/** Actually executes generated `result.js` (rather than just pattern-matching its source
 * text) with `(new Error()).stack` forced to `fakeStack` for the duration of the run, so
 * the tests below genuinely exercise the runtime self-identification logic the way a real
 * browser would, not just the string the code generator happened to produce. Works by
 * temporarily swapping the global `Error` constructor for one whose instances report
 * `fakeStack` — free variables inside code built via `new Function` resolve against the
 * real global object at call time, so the swap is visible inside the executed snippet. */
function runWithFakeStack(js: string, fakeStack: string): void {
  const OriginalError = globalThis.Error

  function FakeError(this: { stack: string }) {
    this.stack = fakeStack
  }

  // @ts-expect-error - intentionally swapping the global Error constructor for the run
  globalThis.Error = FakeError
  try {
    // eslint-disable-next-line no-new-func -- the whole point is to run the generated snippet as real code
    new Function(js)()
  } finally {
    globalThis.Error = OriginalError
  }
}

describe('injectDebugId', () => {
  it('appends a debug-ID-registering snippet to the JS content', () => {
    const result = injectDebugId('console.log(1)', '{"version":3}', 'debug-abc')

    expect(result.js).toContain('console.log(1)')
    expect(result.js).toContain('debug-abc')
    expect(result.js).toContain('__getmonitorDebugIds')
  })

  it('removes the sourceMappingURL comment from the JS content', () => {
    const js = 'console.log(1)\n//# sourceMappingURL=main.js.map'

    const result = injectDebugId(js, '{"version":3}', 'debug-abc')

    expect(result.js).not.toContain('sourceMappingURL')
  })

  it('sets a debugId field on the returned source map JSON', () => {
    const result = injectDebugId('console.log(1)', '{"version":3,"sources":[]}', 'debug-abc')

    expect(JSON.parse(result.map)).toMatchObject({ version: 3, sources: [], debugId: 'debug-abc' })
  })

  it('does not mutate its inputs', () => {
    const originalJs = 'console.log(1)'
    const originalMap = '{"version":3}'

    injectDebugId(originalJs, originalMap, 'debug-abc')

    expect(originalJs).toBe('console.log(1)')
    expect(originalMap).toBe('{"version":3}')
  })

  it('removes multiple sourceMappingURL comments from the JS content', () => {
    const js = 'console.log(1)\n//# sourceMappingURL=old.js.map\nconsole.log(2)\n//# sourceMappingURL=main.js.map'

    const result = injectDebugId(js, '{"version":3}', 'debug-abc')

    expect(result.js).not.toContain('sourceMappingURL')
    expect(result.js).toContain('console.log(1)')
    expect(result.js).toContain('console.log(2)')
  })

  it('throws when the source map JSON is malformed', () => {
    expect(() => injectDebugId('console.log(1)', 'not json', 'debug-abc')).toThrow()
  })
})

describe('injectDebugId generated snippet, actually executed', () => {
  afterEach(() => {
    delete (globalThis as { __getmonitorDebugIds?: unknown }).__getmonitorDebugIds
  })

  it('registers the correct filename from a V8-style stack (header line + parenthesized frames)', () => {
    const result = injectDebugId('', '{"version":3}', 'debug-v8')
    const fakeStack = [
      'Error',
      '    at ownFunction (https://cdn.example.com/own-file.js:12:34)',
      '    at callerFunction (https://cdn.example.com/caller-file.js:56:78)',
    ].join('\n')

    runWithFakeStack(result.js, fakeStack)

    expect((globalThis as { __getmonitorDebugIds?: Record<string, string> }).__getmonitorDebugIds).toEqual({
      'https://cdn.example.com/own-file.js': 'debug-v8',
    })
  })

  it('registers the correct filename from a Gecko-style stack (no header line, fn@file:line:col)', () => {
    const result = injectDebugId('', '{"version":3}', 'debug-gecko')
    const fakeStack = [
      'ownFunction@https://cdn.example.com/own-file.js:12:34',
      'callerFunction@https://cdn.example.com/caller-file.js:56:78',
    ].join('\n')

    runWithFakeStack(result.js, fakeStack)

    expect((globalThis as { __getmonitorDebugIds?: Record<string, string> }).__getmonitorDebugIds).toEqual({
      'https://cdn.example.com/own-file.js': 'debug-gecko',
    })
  })

  it('registers the correct filename from a Safari/WebKit-style stack (no header line, no parens, no function name)', () => {
    const result = injectDebugId('', '{"version":3}', 'debug-safari')
    const fakeStack = [
      'at https://cdn.example.com/own-file.js:12:34',
      'at https://cdn.example.com/caller-file.js:56:78',
    ].join('\n')

    runWithFakeStack(result.js, fakeStack)

    expect((globalThis as { __getmonitorDebugIds?: Record<string, string> }).__getmonitorDebugIds).toEqual({
      'https://cdn.example.com/own-file.js': 'debug-safari',
    })
  })
})
