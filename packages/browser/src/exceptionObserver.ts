import { safeCapture, type ExceptionMechanism } from '@getmonitor/core'

export interface ExceptionObserverOptions {
  captureUnhandledErrors: boolean
  captureUnhandledRejections: boolean
  captureConsoleErrors: boolean
}

export interface ExceptionObserverHandle {
  uninstall(): void
}

interface CaptureTarget {
  captureAutomatic(
    error: unknown,
    mechanism: Extract<ExceptionMechanism, 'uncaught_exception' | 'unhandled_rejection' | 'console_error'>,
    handled: boolean
  ): Promise<void> | void
}

export function installExceptionObserver(
  client: CaptureTarget,
  options: ExceptionObserverOptions
): ExceptionObserverHandle {
  const onError = (event: ErrorEvent) => {
    safeCapture(() => client.captureAutomatic(event.error ?? new Error(event.message), 'uncaught_exception', false))
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    safeCapture(() => client.captureAutomatic(event.reason, 'unhandled_rejection', false))
  }

  const originalConsoleError = console.error
  const onConsoleError = (...args: unknown[]) => {
    originalConsoleError.apply(console, args)
    const [first] = args
    const error = first instanceof Error ? first : new Error(args.map(String).join(' '))
    safeCapture(() => client.captureAutomatic(error, 'console_error', false))
  }

  if (options.captureUnhandledErrors) window.addEventListener('error', onError)
  if (options.captureUnhandledRejections) window.addEventListener('unhandledrejection', onRejection)
  if (options.captureConsoleErrors) console.error = onConsoleError

  return {
    uninstall() {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      if (options.captureConsoleErrors) console.error = originalConsoleError
    },
  }
}
