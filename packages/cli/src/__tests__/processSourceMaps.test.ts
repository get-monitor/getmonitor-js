import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { processSourceMaps } from '../processSourceMaps'

describe('processSourceMaps', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'getmonitor-cli-test-'))
    writeFileSync(join(dir, 'main.js'), 'console.log(1)\n//# sourceMappingURL=main.js.map')
    writeFileSync(join(dir, 'main.js.map'), '{"version":3}')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('uploads and strips artifacts, returning them in `uploaded`', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    const result = await processSourceMaps({
      directory: dir,
      release: '1.0.0',
      authToken: 'secret',
      fetchImpl,
    })

    expect(result).toEqual({ uploaded: [join(dir, 'main.js')], failed: [] })
    expect(existsSync(join(dir, 'main.js.map'))).toBe(false)
    const js = readFileSync(join(dir, 'main.js'), 'utf8')
    expect(js).not.toContain('sourceMappingURL')
    expect(js).toContain('__getmonitorDebugIds')
  })

  it('leaves files untouched and reports `failed` when the upload fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' })
    const originalJs = readFileSync(join(dir, 'main.js'), 'utf8')

    const result = await processSourceMaps({
      directory: dir,
      release: '1.0.0',
      authToken: 'secret',
      fetchImpl,
    })

    expect(result).toEqual({ uploaded: [], failed: [join(dir, 'main.js')] })
    expect(existsSync(join(dir, 'main.js.map'))).toBe(true)
    expect(readFileSync(join(dir, 'main.js'), 'utf8')).toBe(originalJs)
  })

  it('throws before touching any files when authToken is missing', async () => {
    const originalJs = readFileSync(join(dir, 'main.js'), 'utf8')

    await expect(
      processSourceMaps({ directory: dir, release: '1.0.0' }),
    ).rejects.toThrow(/auth token/i)

    expect(readFileSync(join(dir, 'main.js'), 'utf8')).toBe(originalJs)
    expect(existsSync(join(dir, 'main.js.map'))).toBe(true)
  })

  it('isolates a malformed .map file to that artifact\'s `failed` entry, still processing the rest', async () => {
    // A second, well-formed artifact alongside the malformed one.
    writeFileSync(join(dir, 'other.js'), 'console.log(2)\n//# sourceMappingURL=other.js.map')
    writeFileSync(join(dir, 'other.js.map'), '{"version":3}')
    // main.js.map is corrupted — injectDebugId's JSON.parse will throw on it.
    writeFileSync(join(dir, 'main.js.map'), 'not valid json{{{')
    const originalMainJs = readFileSync(join(dir, 'main.js'), 'utf8')

    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    const result = await processSourceMaps({
      directory: dir,
      release: '1.0.0',
      authToken: 'secret',
      fetchImpl,
    })

    // The whole run did not throw, and the good artifact was still uploaded/stripped.
    expect(result.uploaded).toEqual([join(dir, 'other.js')])
    expect(result.failed).toEqual([join(dir, 'main.js')])
    expect(existsSync(join(dir, 'other.js.map'))).toBe(false)

    // The bad artifact is left completely untouched, same as an upload failure.
    expect(readFileSync(join(dir, 'main.js'), 'utf8')).toBe(originalMainJs)
    expect(existsSync(join(dir, 'main.js.map'))).toBe(true)

    // uploadSourceMap was never called for the artifact that failed to inject.
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('still reports the artifact as `uploaded` when the post-upload local cleanup fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    // Stripping write permission from the directory (while leaving main.js itself writable)
    // blocks rmSync's unlink of main.js.map — deleting a directory entry needs write
    // permission on the *directory*, not the file — without preventing the read/inject/upload
    // steps above it, or even writeFileSync's in-place overwrite of main.js's content. This
    // isolates the failure to the post-upload write/delete step specifically, proving the
    // upload genuinely succeeded before cleanup broke.
    chmodSync(dir, 0o555)

    try {
      const result = await processSourceMaps({
        directory: dir,
        release: '1.0.0',
        authToken: 'secret',
          fetchImpl,
      })

      // Must NOT be in `failed`: the upload already happened, so a caller retrying `failed`
      // artifacts would mint a new debugId and re-upload, orphaning the first upload
      // server-side with no way to reconcile the two.
      expect(result.uploaded).toEqual([join(dir, 'main.js')])
      expect(result.failed).toEqual([])
      // Proves the upload was actually attempted (and succeeded) — this isn't a case where
      // the run bailed out before ever calling uploadSourceMap.
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    } finally {
      // Restore permissions so afterEach's rmSync cleanup of `dir` doesn't itself fail.
      chmodSync(dir, 0o755)
    }
  })
})
