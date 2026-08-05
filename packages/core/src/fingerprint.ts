import { ExceptionValue } from './types'

/** Default grouping key: exception type + message (no stack) or first in-app frame. */
export function computeDefaultFingerprint(exceptions: ExceptionValue[]): string[] {
  const primary = exceptions[exceptions.length - 1]
  if (!primary) return ['unknown']

  const frames = primary.stacktrace.frames
  if (frames.length === 0) {
    return [primary.type, primary.message]
  }

  // frames[0] is innermost/most-recent (raw Error.stack order) — scan forward, not reversed.
  const inAppFrame = frames.find((f) => f.inApp)
  const blameFrame = inAppFrame ?? frames[0]

  return [primary.type, `${blameFrame.filename}:${blameFrame.function}`]
}
