/** The one ingestion host every SDK instance talks to — not customer-configurable. */
export const DEFAULT_API_HOST = 'http://ingest.getmonitor.io'

export interface TransportConfig {
  /**
   * @internal Test-only override for redirecting delivery to a local mock server (see the
   * browser/node e2e suites). Never exposed through `GetMonitor.init`'s public options —
   * application code always ships to {@link DEFAULT_API_HOST}.
   */
  apiHost?: string
  apiKey: string
  fetchImpl?: typeof fetch
  maxRetries?: number
  retryBaseDelayMs?: number
}

export class HttpTransport {
  private readonly apiHost: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly maxRetries: number
  private readonly retryBaseDelayMs: number
  private queue: Promise<void> = Promise.resolve()

  constructor(config: TransportConfig) {
    this.apiHost = config.apiHost ?? DEFAULT_API_HOST
    this.apiKey = config.apiKey
    // Must bind to globalThis: browsers' native fetch() throws "Illegal invocation" if it's
    // called with a `this` other than Window/WorkerGlobalScope, and `this.fetchImpl(...)`
    // below invokes it as a method of the HttpTransport instance. Unit tests never caught this
    // because they always pass a mock fetchImpl — this surfaced only via Task 19's real-browser
    // Playwright suite, where every one of the 4 mechanism tests failed with 0 requests received
    // until this bind was added.
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis)
    this.maxRetries = config.maxRetries ?? 3
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 500
  }

  /** Sends immediately, no queue, no retry. Caller is expected to await this. */
  async sendImmediate(event: unknown): Promise<void> {
    await this.postOnce(event)
  }

  /** Enqueues onto an in-memory retry queue; resolves once delivered or retries are exhausted. */
  send(event: unknown): Promise<void> {
    const task = this.queue.then(() => this.postWithRetry(event))
    // One failed send must not block subsequent queued sends.
    this.queue = task.catch(() => undefined)
    return task
  }

  private async postWithRetry(event: unknown): Promise<void> {
    let attempt = 0
    let lastError: unknown

    while (attempt <= this.maxRetries) {
      try {
        await this.postOnce(event)
        return
      } catch (error) {
        lastError = error
        attempt += 1
        if (attempt > this.maxRetries) break
        await delay(this.retryBaseDelayMs * 2 ** (attempt - 1))
      }
    }

    throw lastError
  }

  private async postOnce(event: unknown): Promise<void> {
    const response = await this.fetchImpl(`${this.apiHost}/api/v1/exceptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      throw new Error(`GetMonitor: ingestion request failed with status ${response.status}`)
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
