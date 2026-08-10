import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GetMonitor } from '@getmonitor/browser'
import { GetMonitorErrorBoundary } from '@getmonitor/react'

const apiHost = new URLSearchParams(window.location.search).get('apiHost') ?? ''
GetMonitor.init('gm_e2e_test', { apiHost })

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
