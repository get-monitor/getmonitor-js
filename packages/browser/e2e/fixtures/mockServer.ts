import { createServer, Server } from 'node:http'

export interface MockIngestServer {
  server: Server
  url: string
  requests: unknown[]
}

export function startMockIngestServer(): Promise<MockIngestServer> {
  const requests: unknown[] = []

  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

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
