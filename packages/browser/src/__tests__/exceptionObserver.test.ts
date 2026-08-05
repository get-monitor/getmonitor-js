import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installExceptionObserver } from '../exceptionObserver'

describe('installExceptionObserver', () => {
  let client: { captureAutomatic: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    client = { captureAutomatic: vi.fn() }
  })

  it('captures window "error" events as uncaught_exception', () => {
    const handle = installExceptionObserver(client, {
      captureUnhandledErrors: true,
      captureUnhandledRejections: false,
      captureConsoleErrors: false,
    })

    const error = new Error('boom')
    window.dispatchEvent(new ErrorEvent('error', { error, message: 'boom' }))

    expect(client.captureAutomatic).toHaveBeenCalledWith(error, 'uncaught_exception', false)
    handle.uninstall()
  })

  it('captures unhandledrejection events as unhandled_rejection', () => {
    const handle = installExceptionObserver(client, {
      captureUnhandledErrors: false,
      captureUnhandledRejections: true,
      captureConsoleErrors: false,
    })

    const reason = new Error('rejected')
    const event = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(event, 'reason', { value: reason })
    window.dispatchEvent(event)

    expect(client.captureAutomatic).toHaveBeenCalledWith(reason, 'unhandled_rejection', false)
    handle.uninstall()
  })

  it('captures console.error calls as console_error without suppressing the original log', () => {
    const originalError = console.error
    const handle = installExceptionObserver(client, {
      captureUnhandledErrors: false,
      captureUnhandledRejections: false,
      captureConsoleErrors: true,
    })

    console.error(new Error('console boom'))

    expect(client.captureAutomatic).toHaveBeenCalledWith(expect.any(Error), 'console_error', false)
    handle.uninstall()
    expect(console.error).toBe(originalError)
  })

  it('does not propagate a synchronous throw from captureAutomatic out of the "error" listener', () => {
    client.captureAutomatic.mockImplementation(() => {
      throw new Error('captureAutomatic bug')
    })

    const handle = installExceptionObserver(client, {
      captureUnhandledErrors: true,
      captureUnhandledRejections: false,
      captureConsoleErrors: false,
    })

    const error = new Error('boom')
    expect(() => {
      window.dispatchEvent(new ErrorEvent('error', { error, message: 'boom' }))
    }).not.toThrow()

    expect(client.captureAutomatic).toHaveBeenCalledTimes(1)
    handle.uninstall()
  })

  it('does not produce an unhandled rejection when captureAutomatic rejects during unhandledrejection handling', async () => {
    // Deliberately a plain stub, not vi.fn(): Vitest's mock instrumentation
    // (tinyspy) attaches its own handler to the returned promise for
    // internal bookkeeping, which marks it "handled" from Node/V8's
    // perspective regardless of whether the implementation under test
    // actually isolates the rejection. That makes a vi.fn()-based version of
    // this test pass even when the fix is reverted. A plain closure has no
    // such side effect, so this is the version that genuinely fails with an
    // unhandled rejection if safeCapture's isolation is removed.
    let calls = 0
    const rejectingClient = {
      captureAutomatic: () => {
        calls++
        return Promise.reject(new Error('captureAutomatic bug'))
      },
    }

    const handle = installExceptionObserver(rejectingClient, {
      captureUnhandledErrors: false,
      captureUnhandledRejections: true,
      captureConsoleErrors: false,
    })

    const event = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(event, 'reason', { value: new Error('rejected') })
    window.dispatchEvent(event)

    // Give the rejected promise's microtask a chance to be observed. If the
    // implementation lets the rejection go unhandled, Vitest will fail this
    // test file with an "Unhandled Rejection" error.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(calls).toBe(1)
    handle.uninstall()
  })

  it('does not install listeners for disabled options', () => {
    installExceptionObserver(client, {
      captureUnhandledErrors: false,
      captureUnhandledRejections: false,
      captureConsoleErrors: false,
    })

    // Vitest's jsdom environment treats a dispatched "error" event as an
    // uncaught exception (and rethrows it into the Node process) whenever
    // there is no *other* "error" listener registered on window. Since this
    // test intentionally installs zero listeners, register a harmless no-op
    // listener for the duration of the dispatch so we only assert on our
    // own observer's behavior instead of tripping Vitest's own safety net.
    const noop = () => {}
    window.addEventListener('error', noop)
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('x'), message: 'x' }))
    window.removeEventListener('error', noop)

    expect(client.captureAutomatic).not.toHaveBeenCalled()
  })
})
