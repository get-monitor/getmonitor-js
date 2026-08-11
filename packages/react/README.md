# @getmonitor/react

React bindings for GetMonitor. Ships a `GetMonitorErrorBoundary` component that catches
render-time errors in its subtree, reports them to GetMonitor, and renders a fallback UI in
their place.

## Installation

```bash
npm install @getmonitor/react
```

`react` (`^18.0.0 || ^19.0.0`) is a peer dependency — it isn't bundled, so your app's own React
install is used. `@getmonitor/browser` must already be installed and initialized somewhere
early in your app (before any component using `GetMonitorErrorBoundary` mounts):

```ts
import { GetMonitor } from '@getmonitor/browser'

GetMonitor.init('gm_xxx')
```

`GetMonitorErrorBoundary` does not have its own `init()` — it reports through the same
`GetMonitor` singleton `@getmonitor/browser` exports, so it only works once that singleton has
been initialized.

## Usage

Wrap any subtree you want error-isolated in `<GetMonitorErrorBoundary>`. `fallback` can be a
plain node:

```tsx
import { GetMonitorErrorBoundary } from '@getmonitor/react'

function App() {
  return (
    <GetMonitorErrorBoundary fallback={<p>Something went wrong.</p>}>
      <Dashboard />
    </GetMonitorErrorBoundary>
  )
}
```

...or a function, called as `fallback(error, reset)`, letting you show the caught error and let
the user retry by re-mounting `children`:

```tsx
import { GetMonitorErrorBoundary } from '@getmonitor/react'

function App() {
  return (
    <GetMonitorErrorBoundary
      fallback={(error, reset) => (
        <div>
          <p>Something went wrong: {String(error)}</p>
          <button onClick={reset}>Try again</button>
        </div>
      )}
    >
      <Dashboard />
    </GetMonitorErrorBoundary>
  )
}
```

`reset()` clears the boundary's internal error state, which causes `children` to render fresh —
use it to let the user retry without a full page reload.

Pass `onError` to run your own side effect (e.g. an in-app toast) alongside GetMonitor's
automatic report. It receives the same `error` and a `componentStack` string:

```tsx
<GetMonitorErrorBoundary
  fallback={<p>Something went wrong.</p>}
  onError={(error, componentStack) => {
    console.log('boundary caught', error, componentStack)
  }}
>
  <Dashboard />
</GetMonitorErrorBoundary>
```

`onError` (and GetMonitor's own reporting call) are both wrapped internally so a throwing
`onError` callback can't crash the boundary itself.

## Important: avoiding duplicate events

**React itself calls `console.error` internally whenever an error boundary catches an error** —
in both development and production builds, regardless of what `onError`/`fallback` you configure.

`@getmonitor/browser`'s `GetMonitor.init()` has a `captureConsoleErrors` option that defaults to
`true`: it automatically reports every `console.error` call as a `mechanism: 'console_error'`
event. There is no deduplication anywhere in the capture pipeline. Put those two facts together,
and **any app using `GetMonitorErrorBoundary` without disabling `captureConsoleErrors` will
report every boundary-caught error twice** — once automatically as `console_error` (from React's
own internal logging) and once explicitly as `react_error_boundary` (from the boundary itself).

For most apps, the fix is to disable `captureConsoleErrors` when you initialize GetMonitor:

```ts
GetMonitor.init('gm_xxx', {
  captureConsoleErrors: false,
})
```

If you'd rather keep `captureConsoleErrors: true` — for example, because you still want
`console.error` calls from code that *isn't* wrapped in a `GetMonitorErrorBoundary` to be
captured — that's a reasonable tradeoff, but understand it explicitly: every error caught by a
`GetMonitorErrorBoundary` will then show up twice in your GetMonitor dashboard (once as
`console_error`, once as `react_error_boundary`), inflating event counts for those errors
specifically.

## `'use client'`

The package's built output starts with a `'use client'` directive, so `GetMonitorErrorBoundary`
can be imported directly into Next.js App Router server components/layouts without triggering a
"only works in a Client Component" error — no extra wrapper needed on your end.

## What gets reported

When the boundary catches an error, it calls into `@getmonitor/browser` with:

- `mechanism: 'react_error_boundary'`
- `handled: true`
- a `componentStack` tag, set to React's `errorInfo.componentStack` for the caught error

## API reference

```ts
type FallbackRender = (error: unknown, reset: () => void) => ReactNode

interface GetMonitorErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode | FallbackRender
  onError?: (error: unknown, componentStack: string) => void
}
```

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | yes | The subtree to render normally, and to re-render on `reset()`. |
| `fallback` | `ReactNode \| FallbackRender` | yes | Rendered in place of `children` after a caught error. A plain node is rendered as-is; a function is called as `fallback(error, reset)`. |
| `onError` | `(error: unknown, componentStack: string) => void` | no | Called alongside GetMonitor's automatic report. Exceptions thrown from it are swallowed. |

`GetMonitorErrorBoundary` only catches errors thrown during rendering, in lifecycle methods, and
in constructors of the components below it in the tree — the same scope React's own
`componentDidCatch`/`getDerivedStateFromError` cover. It does not catch errors in event handlers,
async code, or errors thrown in the boundary itself; use `GetMonitor.captureException` from
`@getmonitor/browser` directly for those.

## Development

```bash
pnpm --filter @getmonitor/react build     # rollup -> dist/ (ESM + CJS + .d.ts, 'use client' banner)
pnpm --filter @getmonitor/react test      # vitest run (jsdom + @testing-library/react)
pnpm --filter @getmonitor/react test:e2e  # playwright test — real vite build + real browser
pnpm --filter @getmonitor/react lint      # tsc --noEmit (src/) + tsc --noEmit -p e2e
```

The unit suite mounts the boundary with `@testing-library/react` against a mocked
`@getmonitor/browser`; the Playwright suite in `e2e/` builds a real fixture app with Vite and
exercises the boundary in a real browser against a real local mock ingestion server.
