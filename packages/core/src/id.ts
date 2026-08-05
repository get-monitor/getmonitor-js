// packages/core/src/id.ts

/** Cross-environment UUID (browser + Node both expose crypto.randomUUID as of Node 19 / evergreen browsers). */
export function generateEventId(): string {
  // No explicit `Crypto` type annotation here on purpose: @types/node's crypto.d.ts augments
  // globalThis.crypto's type but doesn't declare a bare global `Crypto` interface (that only
  // exists via the "dom" lib, which this package's tsconfig deliberately omits) — let TS infer.
  const cryptoObj = globalThis.crypto
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
