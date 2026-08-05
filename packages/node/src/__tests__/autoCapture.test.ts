import { describe, it, expect, vi, afterEach } from 'vitest'
import { installAutoCapture } from '../autoCapture'

describe('installAutoCapture', () => {
  afterEach(() => {
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')
  })

  it('captures uncaughtException immediately and exits the process only after delivery', async () => {
    const client = { captureAutomatic: vi.fn().mockResolvedValue(undefined) }
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    installAutoCapture(client)

    const error = new Error('fatal')
    process.emit('uncaughtException', error)
    await new Promise((resolve) => setImmediate(resolve))

    expect(client.captureAutomatic).toHaveBeenCalledWith(error, 'uncaught_exception', false, { immediate: true })
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('captures unhandledRejection without exiting the process', async () => {
    const client = { captureAutomatic: vi.fn().mockResolvedValue(undefined) }
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    installAutoCapture(client)

    process.emit('unhandledRejection', new Error('rejected'), Promise.resolve())
    await new Promise((resolve) => setImmediate(resolve))

    expect(client.captureAutomatic).toHaveBeenCalledWith(expect.any(Error), 'unhandled_rejection', false, {
      immediate: true,
    })
    expect(exitSpy).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('uninstall removes both listeners', () => {
    const client = { captureAutomatic: vi.fn() }
    const handle = installAutoCapture(client)
    handle.uninstall()

    expect(process.listenerCount('uncaughtException')).toBe(0)
    expect(process.listenerCount('unhandledRejection')).toBe(0)
  })

  it('does not crash and still exits when captureAutomatic throws synchronously on uncaughtException', async () => {
    const client = {
      captureAutomatic: vi.fn(() => {
        throw new Error('captureAutomatic bug')
      }),
    }
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    installAutoCapture(client)

    process.emit('uncaughtException', new Error('fatal'))
    await new Promise((resolve) => setImmediate(resolve))

    expect(client.captureAutomatic).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('does not recurse or produce an unhandled rejection when captureAutomatic rejects on unhandledRejection', async () => {
    let calls = 0
    const client = {
      captureAutomatic: () => {
        calls++
        return Promise.reject(new Error('captureAutomatic bug'))
      },
    }
    installAutoCapture(client)

    process.emit('unhandledRejection', new Error('rejected'), Promise.resolve())
    await new Promise((resolve) => setImmediate(resolve))

    expect(calls).toBe(1)
  })
})
