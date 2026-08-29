// packages/cli/src/uploadSourceMap.ts

/** The one sourcemap-upload host every CLI invocation talks to — not customer-configurable. */
export const DEFAULT_API_HOST = 'https://track.getmonitor.io'

export interface UploadSourceMapParams {
  /**
   * @internal Test-only override for redirecting delivery to a local mock server (see
   * cli/e2e/processSourceMaps.spec.ts and the nextjs-config/nuxt e2e suites). Never exposed
   * through the public CLI/programmatic surface — real usage always ships to
   * {@link DEFAULT_API_HOST}.
   */
  apiHost?: string
  authToken: string
  release: string
  debugId: string
  filename: string
  mapContent: string
  fetchImpl?: typeof fetch
}

/** POSTs a single source map artifact to ingester-api's `/api/v1/sourcemaps` contract.
 * Throws on any non-2xx response or network failure — the caller (processSourceMaps) decides
 * what "failed" means for its own result reporting and disk-write ordering. */
export async function uploadSourceMap(params: UploadSourceMapParams): Promise<void> {
  // Must bind to globalThis, mirroring @getmonitor/core's HttpTransport: browsers' native
  // fetch() throws "Illegal invocation" if called with a `this` other than
  // Window/WorkerGlobalScope. Here fetchImpl is invoked as a plain function call below
  // (`fetchImpl(url, init)`, never `params.fetchImpl(...)` or `this.fetchImpl(...)`), so this
  // bind is defensive/consistent rather than load-bearing for this particular call site — but
  // keeping the same default expression as HttpTransport avoids a divergent default if this
  // code is ever refactored into a method.
  const fetchImpl = params.fetchImpl ?? fetch.bind(globalThis)
  const apiHost = params.apiHost ?? DEFAULT_API_HOST

  const form = new FormData()
  form.set('release', params.release)
  form.set('debugId', params.debugId)
  form.set('filename', params.filename)
  form.set('sourcemap', new Blob([params.mapContent], { type: 'application/json' }), `${params.filename}.map`)

  const response = await fetchImpl(`${apiHost}/api/v1/sourcemaps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.authToken}` },
    body: form,
  })

  if (!response.ok) {
    throw new Error(`Source map upload failed for ${params.filename}: ${response.status} ${response.statusText}`)
  }
}
