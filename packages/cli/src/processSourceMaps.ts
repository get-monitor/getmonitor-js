// packages/cli/src/processSourceMaps.ts
import { randomUUID } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { discoverArtifacts } from './discoverArtifacts'
import { injectDebugId, InjectedArtifact } from './injectDebugId'
import { resolveRelease } from './resolveRelease'
import { uploadSourceMap } from './uploadSourceMap'
import { ProcessSourceMapsOptions, ProcessSourceMapsResult } from './types'

/**
 * @internal Test-only host override, intersected into `processSourceMaps`'s options but
 * deliberately not part of the exported `ProcessSourceMapsOptions` type — see
 * `uploadSourceMap`'s `UploadSourceMapParams.apiHost`. Used by this package's own e2e suite
 * and by nextjs-config/nuxt's e2e suites (via their own internal overrides) to redirect
 * delivery to a local mock server; real callers must never set it.
 */
interface InternalTestOverrides {
  apiHost?: string
}

/** Number of artifacts uploaded at once. Each upload is an independent network round trip to
 * ingester-api, so processing them one at a time made wall-clock time scale linearly with
 * artifact count for no reason — a real Next.js build can emit well over a thousand of them,
 * turning a few hundred ms of per-file latency into many minutes of serial waiting. */
const UPLOAD_CONCURRENCY = 20

/** Finds every JS/map artifact pair under `options.directory`, and for each one: injects a
 * debug ID, uploads the tagged source map, and — only on a successful upload — writes the
 * debug-ID-injected JS back to disk and deletes the `.map` file. An artifact whose upload
 * fails is left completely untouched on disk, so it can be retried by re-running this
 * function against the same directory. Artifacts are uploaded concurrently (bounded by
 * `UPLOAD_CONCURRENCY`), but `result.uploaded`/`result.failed` are always ordered to match
 * `discoverArtifacts`'s output, regardless of which upload happens to finish first. */
export async function processSourceMaps(
  options: ProcessSourceMapsOptions & InternalTestOverrides
): Promise<ProcessSourceMapsResult> {
  const authToken = options.authToken ?? process.env.GETMONITOR_AUTH_TOKEN
  if (!authToken) {
    throw new Error('Missing auth token. Pass --auth-token or set GETMONITOR_AUTH_TOKEN.')
  }

  const release = resolveRelease(options.directory, options.release)
  const artifacts = discoverArtifacts(options.directory)
  // Indexed by each artifact's position in `artifacts` rather than appended in completion
  // order, so the final result below is deterministic no matter which worker finishes first.
  const outcomes: Array<{ path: string; ok: boolean }> = new Array(artifacts.length)

  const processOne = async (index: number): Promise<void> => {
    const artifact = artifacts[index]
    const debugId = randomUUID()
    let injected: InjectedArtifact

    try {
      const originalJs = readFileSync(artifact.jsPath, 'utf8')
      const originalMap = readFileSync(artifact.mapPath, 'utf8')
      // injectDebugId is a pure function that throws on malformed map JSON (by design — see
      // its own doc comment). That's deliberately caught here, alongside upload failures: one
      // corrupt/unreadable artifact on disk must not abort processing of every other artifact
      // in the directory, the same failure-isolation principle discoverArtifacts applies to
      // unreadable files during its walk. Nothing has been uploaded or written yet at this
      // point, so a thrown injectDebugId or upload failure leaves the artifact's files
      // completely untouched, and it's safe to report it as `failed` for a retry.
      injected = injectDebugId(originalJs, originalMap, debugId)

      await uploadSourceMap({
        apiHost: options.apiHost,
        authToken,
        release,
        debugId,
        // Relative to options.directory, not the absolute on-disk path — the backend has no
        // use for (and shouldn't see) the build machine's local filesystem layout.
        filename: relative(options.directory, artifact.jsPath),
        mapContent: injected.map,
        fetchImpl: options.fetchImpl,
      })
    } catch (error) {
      // Surfaced here rather than swallowed: this is the only place the actual failure reason
      // (injectDebugId's malformed-JSON error, or uploadSourceMap's `status statusText` message)
      // is available. Without logging it, callers only ever see a bare list of failed paths with
      // no way to tell an auth failure from a malformed map from a network error.
      console.error(`Failed to process ${artifact.jsPath}:`, error instanceof Error ? error.message : error)
      outcomes[index] = { path: artifact.jsPath, ok: false }
      return
    }

    try {
      writeFileSync(artifact.jsPath, injected.js)
      rmSync(artifact.mapPath)
      outcomes[index] = { path: artifact.jsPath, ok: true }
    } catch (cleanupError) {
      // The upload above already succeeded, so this must never land in `failed` — a caller
      // retrying failed artifacts would mint a fresh debugId and re-upload, orphaning this
      // upload server-side under the old one with no way to reconcile the two. The local
      // cleanup failure (disk full, permission error, file lock) is real and worth knowing
      // about, so it's surfaced here rather than silently swallowed, but it doesn't change
      // the artifact's outcome.
      outcomes[index] = { path: artifact.jsPath, ok: true }
      console.error(`Uploaded ${artifact.jsPath} but failed to update local files:`, cleanupError)
    }
  }

  // A fixed-size pool of workers, each pulling the next unclaimed artifact index off a shared
  // cursor, bounds concurrency to UPLOAD_CONCURRENCY regardless of how many artifacts there are.
  let nextIndex = 0
  const runWorker = async (): Promise<void> => {
    while (nextIndex < artifacts.length) {
      const index = nextIndex++
      await processOne(index)
    }
  }
  const workerCount = Math.min(UPLOAD_CONCURRENCY, artifacts.length)
  await Promise.all(Array.from({ length: workerCount }, runWorker))

  const result: ProcessSourceMapsResult = { uploaded: [], failed: [] }
  for (const outcome of outcomes) {
    ;(outcome.ok ? result.uploaded : result.failed).push(outcome.path)
  }
  return result
}
