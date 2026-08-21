// packages/node/src/index.ts
export { GetMonitor } from './GetMonitor'
export type { NodeInitOptions } from './GetMonitor'
export { setupExpressErrorHandler } from './extensions/express'
export { setupFastifyErrorHandler } from './extensions/fastify'
export { setupKoaErrorHandler } from './extensions/koa'
export { setupHonoErrorHandler } from './extensions/hono'
export type { HonoErrorHandlerOptions } from './extensions/hono'
