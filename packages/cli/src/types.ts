// packages/cli/src/types.ts

export interface ProcessSourceMapsOptions {
  directory: string
  release?: string
  authToken?: string
  fetchImpl?: typeof fetch
}

export interface ProcessSourceMapsResult {
  uploaded: string[]
  failed: string[]
}
