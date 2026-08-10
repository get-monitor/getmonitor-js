import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GetMonitor } from '@getmonitor/browser'
import { GetMonitorErrorBoundary } from '@getmonitor/react'

const apiHost = new URLSearchParams(window.location.search).get('apiHost') ?? ''
// react-dom itself calls console.error internally whenever an error boundary catches an
// error (this happens in production builds too, not just dev). Without disabling automatic
// console.error capture here, every boundary-caught error would be double-reported: once by
// react-dom's own console.error call (mechanism: 'console_error') and once by
// GetMonitorErrorBoundary's explicit componentDidCatch report (mechanism:
// 'react_error_boundary'). A real app using the error boundary would make the same call.
GetMonitor.init('gm_e2e_test', { apiHost, captureConsoleErrors: false })

function Boom(): never {
  throw new Error('e2e boundary error')
}

function App() {
  const [crash, setCrash] = useState(false)
  return (
    <GetMonitorErrorBoundary fallback={<p>Something went wrong</p>}>
      <button onClick={() => setCrash(true)}>crash</button>
      {crash && <Boom />}
    </GetMonitorErrorBoundary>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
