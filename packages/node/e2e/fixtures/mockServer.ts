import { createServer, Server } from 'node:http'

export interface MockIngestServer {
  server: Server
  url: string
  requests: unknown[]
}

export function startMockIngestServer(): Promise<MockIngestServer> {
  const requests: unknown[] = []

  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      requests.push(JSON.parse(body))
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
