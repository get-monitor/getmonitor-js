import 'reflect-metadata'
import { describe, it, expect, vi } from 'vitest'
import type { HttpServer } from '@nestjs/common'
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

  it('runs the real BaseExceptionFilter.catch logic when constructed with a minimal httpAdapter', () => {
    const client = { captureAutomatic: vi.fn().mockResolvedValue(undefined) }

    // Minimal fake HttpServer/applicationRef: just enough surface for
    // BaseExceptionFilter.catch's handleUnknownError path (used for a plain
    // Error, i.e. anything that isn't an HttpException) to run to completion
    // without reaching into real Nest DI or a real HTTP response object.
    const fakeHttpAdapter = {
      isHeadersSent: vi.fn().mockReturnValue(false),
      reply: vi.fn(),
      end: vi.fn(),
    }

    // Minimal fake ArgumentsHost: catch() only calls getArgByIndex(1) to
    // fetch the "response" object it then passes straight through to
    // applicationRef.reply/isHeadersSent without inspecting it itself.
    const fakeResponse = {}
    const fakeHost = {
      getArgByIndex: vi.fn().mockReturnValue(fakeResponse),
    } as Parameters<InstanceType<typeof GetMonitorExceptionFilter>['catch']>[1]

    const filter = new GetMonitorExceptionFilter(client, fakeHttpAdapter as unknown as HttpServer)
    const exception = new Error('boom')

    expect(() => filter.catch(exception, fakeHost)).not.toThrow()

    expect(client.captureAutomatic).toHaveBeenCalledWith(exception, 'nestjs_filter', true)
    expect(fakeHttpAdapter.isHeadersSent).toHaveBeenCalledWith(fakeResponse)
    expect(fakeHttpAdapter.reply).toHaveBeenCalledWith(
      fakeResponse,
      { statusCode: 500, message: 'Internal server error' },
      500
    )
  })
})
