import { Component, type ErrorInfo, type ReactNode } from 'react'
import { GetMonitor } from '@getmonitor/browser'
import { safeCapture } from '@getmonitor/core'

export type FallbackRender = (error: unknown, reset: () => void) => ReactNode

export interface GetMonitorErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode | FallbackRender
  onError?: (error: unknown, componentStack: string) => void
}

interface State {
  error: unknown
}

export class GetMonitorErrorBoundary extends Component<GetMonitorErrorBoundaryProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    const componentStack = errorInfo.componentStack ?? ''
    safeCapture(() =>
      GetMonitor.captureAutomatic(error, 'react_error_boundary', true, {
        tags: { componentStack },
      })
    )
    safeCapture(() => this.props.onError?.(error, componentStack))
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error !== null) {
      const { fallback } = this.props
      return typeof fallback === 'function' ? fallback(error, this.reset) : fallback
    }
    return this.props.children
  }
}
