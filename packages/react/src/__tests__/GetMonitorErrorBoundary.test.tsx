import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { GetMonitorErrorBoundary } from '../GetMonitorErrorBoundary'

vi.mock('@getmonitor/browser', () => ({
  GetMonitor: { captureAutomatic: vi.fn().mockResolvedValue(undefined) },
}))

import { GetMonitor } from '@getmonitor/browser'

function Boom(): never {
  throw new Error('boom')
}

describe('GetMonitorErrorBoundary', () => {
  beforeEach(() => {
    vi.mocked(GetMonitor.captureAutomatic).mockClear()
    // React logs caught errors to console.error in dev mode; expected noise, not a failure signal.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders children when nothing throws', () => {
    render(
      <GetMonitorErrorBoundary fallback={<p>fallback</p>}>
        <p>children</p>
      </GetMonitorErrorBoundary>
    )
    expect(screen.getByText('children')).toBeTruthy()
  })

  it('renders a static fallback node when a child throws', () => {
    render(
      <GetMonitorErrorBoundary fallback={<p>fallback ui</p>}>
        <Boom />
      </GetMonitorErrorBoundary>
    )
    expect(screen.getByText('fallback ui')).toBeTruthy()
  })

  it('renders a function fallback with the error and a reset handle', () => {
    render(
      <GetMonitorErrorBoundary
        fallback={(error, reset) => (
          <button onClick={reset}>{(error as Error).message}</button>
        )}
      >
        <Boom />
      </GetMonitorErrorBoundary>
    )
    expect(screen.getByText('boom')).toBeTruthy()
  })

  it('reset() re-renders children', () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('boom')
      return <p>recovered</p>
    }

    render(
      <GetMonitorErrorBoundary fallback={(_error, reset) => <button onClick={reset}>retry</button>}>
        <Flaky />
      </GetMonitorErrorBoundary>
    )

    shouldThrow = false
    fireEvent.click(screen.getByText('retry'))

    expect(screen.getByText('recovered')).toBeTruthy()
  })

  it('calls captureAutomatic with the react_error_boundary mechanism and a componentStack tag', () => {
    render(
      <GetMonitorErrorBoundary fallback={<p>fallback</p>}>
        <Boom />
      </GetMonitorErrorBoundary>
    )

    expect(GetMonitor.captureAutomatic).toHaveBeenCalledTimes(1)
    const [error, mechanism, handled, extra] = vi.mocked(GetMonitor.captureAutomatic).mock.calls[0]
    expect((error as Error).message).toBe('boom')
    expect(mechanism).toBe('react_error_boundary')
    expect(handled).toBe(true)
    expect(typeof extra?.tags?.componentStack).toBe('string')
  })

  it('calls onError with the error and componentStack', () => {
    const onError = vi.fn()
    render(
      <GetMonitorErrorBoundary fallback={<p>fallback</p>} onError={onError}>
        <Boom />
      </GetMonitorErrorBoundary>
    )
    expect(onError).toHaveBeenCalledTimes(1)
    const [error, componentStack] = onError.mock.calls[0]
    expect((error as Error).message).toBe('boom')
    expect(typeof componentStack).toBe('string')
  })

  it('still renders the fallback when onError throws', () => {
    const onError = vi.fn(() => {
      throw new Error('onError bug')
    })
    render(
      <GetMonitorErrorBoundary fallback={<p>fallback</p>} onError={onError}>
        <Boom />
      </GetMonitorErrorBoundary>
    )
    expect(screen.getByText('fallback')).toBeTruthy()
  })
})
