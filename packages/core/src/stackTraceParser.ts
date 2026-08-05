import { StackFrame } from './types'

// Known gaps (not covered by current tests, not blocking for v1):
// - Nested-paren eval frames (V8's `eval (eval at <anonymous> (...), ...)` shape) will
//   mis-parse rather than fail cleanly. Common with Webpack's eval/eval-source-map devtool modes.
// - Safari's bare `file:line:col` anonymous frames (no function name, no `@`) don't match
//   either regex and are silently dropped rather than degraded.

const CHROME_LINE = /^\s*at (?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+)|([^)]+))\)?\s*$/
const GECKO_LINE = /^\s*(.*?)@(.*?):(\d+):(\d+)\s*$/

/** Parses a raw `Error.stack` string into frames, in the same order as the raw stack
 * (innermost/most-recent call first — the order V8 and Gecko both emit). A leading
 * "ErrorType: message" header line (V8-style) is skipped automatically since it never
 * matches either frame pattern. */
export function parseStackTrace(stack: string | undefined): StackFrame[] {
  if (!stack) return []

  const lines = stack.split('\n')
  const frames: StackFrame[] = []

  for (const line of lines) {
    const frame = parseChromeLine(line) ?? parseGeckoLine(line)
    if (frame) frames.push(frame)
  }

  return frames
}

function parseChromeLine(line: string): StackFrame | null {
  const match = CHROME_LINE.exec(line)
  if (!match) return null
  const [, fn, file, lineno, colno, evalOrNative] = match

  if (!file && evalOrNative) {
    return { filename: evalOrNative, function: fn || '?', lineno: 0, colno: 0, inApp: false }
  }
  if (!file) return null

  return {
    filename: file,
    function: fn || '?',
    lineno: Number(lineno) || 0,
    colno: Number(colno) || 0,
    inApp: isInApp(file),
  }
}

function parseGeckoLine(line: string): StackFrame | null {
  const match = GECKO_LINE.exec(line)
  if (!match) return null
  const [, fn, file, lineno, colno] = match
  if (!file) return null

  return {
    filename: file,
    function: fn || '?',
    lineno: Number(lineno) || 0,
    colno: Number(colno) || 0,
    inApp: isInApp(file),
  }
}

function isInApp(filename: string): boolean {
  return !/node_modules|chrome-extension:|moz-extension:/.test(filename)
}
