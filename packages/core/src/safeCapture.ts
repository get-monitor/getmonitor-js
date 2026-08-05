// The SDK's own capture pipeline must never itself become a new uncaught exception or
// unhandled rejection: a customer's captureAutomatic/beforeCapture bug that throws
// synchronously or returns a rejected promise could otherwise re-trigger the very listener
// that invoked it (window.onerror, unhandledRejection, an Express error handler, etc.),
// recursing or hanging the host process/tab. safeCapture isolates a call site against both
// failure modes and always resolves.
export function safeCapture(fn: () => Promise<void> | void): Promise<void> {
  try {
    const result = fn()
    if (result && typeof result.catch === 'function') {
      return result.catch(() => undefined)
    }
    return Promise.resolve()
  } catch {
    return Promise.resolve()
  }
}
