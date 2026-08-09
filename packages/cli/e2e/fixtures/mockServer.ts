import { createServer, Server } from 'node:http'

export interface MockSourceMapServer {
  server: Server
  url: string
  requests: { release: string; debugId: string; filename: string; sourcemap: string }[]
}

export interface StartMockSourceMapServerOptions {
  // When true, every request is recorded (so tests can still assert on what was *attempted*)
  // but answered with a 500 — used to exercise the "upload failed" path in consumers of
  // processSourceMaps without needing a real broken backend.
  fail?: boolean
}

export function startMockSourceMapServer(options: StartMockSourceMapServerOptions = {}): Promise<MockSourceMapServer> {
  const requests: MockSourceMapServer['requests'] = []

  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', async () => {
      const body = Buffer.concat(chunks)
      const contentType = req.headers['content-type'] || ''
      const boundaryMatch = contentType.match(/boundary=(.+)$/)
      const boundary = boundaryMatch ? boundaryMatch[1] : ''
      const parts = body.toString('utf8').split(`--${boundary}`)

      const fields: Record<string, string> = {}
      for (const part of parts) {
        // Negative lookbehind excludes `filename="..."`, which also contains the substring
        // `name="`. Multipart/form-data always orders `name` before `filename` per the WHATWG
        // Fetch spec's encoding algorithm, so this wasn't a live bug — but anchoring it removes
        // the reliance on that ordering rather than resting on it.
        const nameMatch = part.match(/(?<!file)name="([^"]+)"/)
        if (!nameMatch) continue
        // The outer split on `--${boundary}` already consumes the boundary delimiter itself,
        // so what's left after the header/body separator is the field's value plus the single
        // trailing `\r\n` that preceded the (now-removed) boundary marker — trim it here rather
        // than trying to re-split on a boundary string that's no longer present in this part.
        const value = part.split('\r\n\r\n')[1]?.replace(/\r\n$/, '') ?? ''
        fields[nameMatch[1]] = value
      }

      requests.push({
        release: fields.release,
        debugId: fields.debugId,
        filename: fields.filename,
        sourcemap: fields.sourcemap,
      })

      if (options.fail) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'simulated failure' }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    })
  })

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ server, url: `http://127.0.0.1:${port}`, requests })
    })
  })
}
