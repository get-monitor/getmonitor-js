// packages/cli/src/resolveRelease.ts
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Resolves the release identifier to tag uploaded source maps with. Precedence: explicit
 * argument -> GETMONITOR_RELEASE env var -> current git commit SHA (if `directory` is inside
 * a git working tree) -> `version` field of the nearest package.json walking up from
 * `directory`. Matches the SDKs' own optional `release` field so events and source maps
 * for the same deploy carry the same value. */
export function resolveRelease(directory: string, explicit?: string): string {
  if (explicit) return explicit
  if (process.env.GETMONITOR_RELEASE) return process.env.GETMONITOR_RELEASE

  const gitSha = tryGitSha(directory)
  if (gitSha) return gitSha

  const packageVersion = tryPackageVersion(directory)
  if (packageVersion) return packageVersion

  throw new Error(
    'Could not resolve a release. Pass --release, set GETMONITOR_RELEASE, run inside a git repository, or add a package.json with a "version" field.',
  )
}

function tryGitSha(directory: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

function tryPackageVersion(directory: string): string | undefined {
  let dir = directory
  for (let i = 0; i < 20; i++) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
        return typeof pkg.version === 'string' ? pkg.version : undefined
      } catch {
        return undefined
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
  return undefined
}
