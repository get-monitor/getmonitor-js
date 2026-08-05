// packages/core/src/normalizeError.ts
import { ExceptionValue } from './types'
import { parseStackTrace } from './stackTraceParser'

const MAX_CHAIN_DEPTH = 10

/** Normalizes any thrown value into an exception chain, root cause first, primary error last. */
export function normalizeError(error: unknown): ExceptionValue[] {
  return normalizeErrorInternal(error, new Set())
}

function normalizeErrorInternal(error: unknown, seen: Set<unknown>): ExceptionValue[] {
  if (error instanceof Error) {
    if (seen.has(error) || seen.size >= MAX_CHAIN_DEPTH) {
      return []
    }
    seen.add(error)

    const chain: ExceptionValue[] = []

    if (error instanceof AggregateError) {
      for (const inner of error.errors) {
        chain.push(...normalizeErrorInternal(inner, seen))
      }
    }

    chain.push({
      type: error.name || 'Error',
      message: error.message || '',
      stacktrace: { frames: parseStackTrace(error.stack) },
    })

    if (error.cause !== undefined) {
      chain.unshift(...normalizeErrorInternal(error.cause, seen))
    }

    return chain
  }

  return [
    {
      type: 'Error',
      message: typeof error === 'string' ? error : safeStringify(error),
      stacktrace: { frames: [] },
    },
  ]
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
