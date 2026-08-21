import { ArgumentsHost, Catch, HttpServer } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { safeCapture } from '@getmonitor/core'

interface CaptureTarget {
  captureAutomatic(error: unknown, mechanism: 'nestjs_filter', handled: boolean): Promise<void>
}

/**
 * Register with `app.useGlobalFilters(new GetMonitorExceptionFilter(gm, httpAdapter))`, where
 * `httpAdapter` comes from `app.get(HttpAdapterHost).httpAdapter` — Nest's own documented
 * "catch everything" pattern. A bare `new GetMonitorExceptionFilter(gm)` with no httpAdapter
 * will crash inside `super.catch()` on the first real exception: BaseExceptionFilter resolves
 * its HttpServer adapter either from this constructor argument or from Nest's DI-populated
 * httpAdapterHost, and a manually-`new`'d filter (as opposed to a DI-registered provider) is
 * never wired up by DI.
 */
@Catch()
export class GetMonitorExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly client: CaptureTarget,
    httpAdapter?: HttpServer
  ) {
    super(httpAdapter)
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    void safeCapture(() => this.client.captureAutomatic(exception, 'nestjs_filter', true))
    super.catch(exception, host)
  }
}
