import 'reflect-metadata'
import { describe, it, expect, vi } from 'vitest'
import { BaseExceptionFilter } from '@nestjs/core'
import { GetMonitorExceptionFilter } from '../extensions/nestjs'

describe('GetMonitorExceptionFilter', () => {
  it('captures the exception as nestjs_filter and delegates to BaseExceptionFilter.catch', () => {
    const client = { captureAutomatic: vi.fn().mockResolvedValue(undefined) }
    const superCatch = vi.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined)

    const filter = new GetMonitorExceptionFilter(client)
    const exception = new Error('boom')
    const host = {} as Parameters<typeof filter.catch>[1]

    filter.catch(exception, host)

    expect(client.captureAutomatic).toHaveBeenCalledWith(exception, 'nestjs_filter', true)
    expect(superCatch).toHaveBeenCalledWith(exception, host)

    superCatch.mockRestore()
  })

  it('does not throw when captureAutomatic rejects', () => {
    let calls = 0
    const client = {
      captureAutomatic: () => {
        calls++
        return Promise.reject(new Error('captureAutomatic bug'))
      },
    }
    const superCatch = vi.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined)

    const filter = new GetMonitorExceptionFilter(client)

    expect(() => filter.catch(new Error('boom'), {} as Parameters<typeof filter.catch>[1])).not.toThrow()
    expect(calls).toBe(1)

    superCatch.mockRestore()
  })
})
