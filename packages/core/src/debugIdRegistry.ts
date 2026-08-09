// packages/core/src/debugIdRegistry.ts

/** Populated at runtime by the snippet @getmonitor/cli's processSourceMaps() appends to
 * built JS files — one entry per file, keyed by exactly the `filename` string
 * parseStackTrace would extract from a real stack frame pointing at that file (both are
 * derived from the JS engine's own stack serialization, so they agree by construction).
 * Read via a structural cast rather than `declare global` so this module has zero
 * build-time dependency on the injected code. */
export function lookupDebugId(filename: string): string | undefined {
  const registry = (globalThis as { __getmonitorDebugIds?: Record<string, string> }).__getmonitorDebugIds
  return registry?.[filename]
}
