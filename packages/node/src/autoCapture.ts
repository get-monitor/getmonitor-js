import { safeCapture, type ExceptionMechanism } from '@getmonitor/core'

interface CaptureTarget {
  captureAutomatic(
    error: unknown,
    mechanism: Extract<ExceptionMechanism, 'uncaught_exception' | 'unhandled_rejection'>,
    handled: boolean,
    opts: { immediate: boolean }
  ): Promise<void>
}

export interface AutoCaptureHandle {
  uninstall(): void
}

/**
 * Both hooks call captureAutomatic with immediate:true (captureExceptionImmediate under the
 * hood) and await delivery before letting the process proceed — this is what prevents the
 * "event dropped because the process exited before the request finished" failure mode.
 * uncaughtException re-implements Node's default terminate-the-process behavior via
 * process.exit(1) because registering our own listener suppresses that default.
 *
 * Each call site is wrapped in safeCapture (from @getmonitor/core): a bug in captureAutomatic
 * that throws synchronously or returns a rejected promise must never itself become a new
 * unhandled exception/rejection — on the unhandledRejection path specifically, that would
 * re-trigger this very listener and recurse.
 */
export function installAutoCapture(client: CaptureTarget): AutoCaptureHandle {
  const onUncaughtException = (error: Error) => {
    void safeCapture(() => client.captureAutomatic(error, 'uncaught_exception', false, { immediate: true })).finally(
      () => process.exit(1)
    )
  }

  const onUnhandledRejection = (reason: unknown) => {
    void safeCapture(() => client.captureAutomatic(reason, 'unhandled_rejection', false, { immediate: true }))
  }

  process.on('uncaughtException', onUncaughtException)
  process.on('unhandledRejection', onUnhandledRejection)

  return {
    uninstall() {
      process.off('uncaughtException', onUncaughtException)
      process.off('unhandledRejection', onUnhandledRejection)
    },
  }
}
