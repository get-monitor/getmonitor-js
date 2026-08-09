import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { resolveRelease } from '../resolveRelease'

describe('resolveRelease', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'getmonitor-cli-test-'))
    delete process.env.GETMONITOR_RELEASE
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env.GETMONITOR_RELEASE
  })

  it('prefers the explicit release argument over everything else', () => {
    process.env.GETMONITOR_RELEASE = 'env-release'
    expect(resolveRelease(dir, 'explicit-release')).toBe('explicit-release')
  })

  it('falls back to GETMONITOR_RELEASE when no explicit release is given', () => {
    process.env.GETMONITOR_RELEASE = 'env-release'
    expect(resolveRelease(dir)).toBe('env-release')
  })

  it('falls back to the current git commit SHA inside a git working tree', () => {
    execFileSync('git', ['init'], { cwd: dir })
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir })
    writeFileSync(join(dir, 'file.txt'), 'x')
    execFileSync('git', ['add', '.'], { cwd: dir })
    execFileSync('git', ['commit', '-m', 'init'], { cwd: dir })
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()

    expect(resolveRelease(dir)).toBe(sha)
  })

  it('falls back to the nearest package.json version when not in a git repo', () => {
    const subDir = join(dir, 'nested')
    mkdirSync(subDir)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '2.3.4' }))

    expect(resolveRelease(subDir)).toBe('2.3.4')
  })

  it('falls through to the final throw when package.json is malformed', () => {
    writeFileSync(join(dir, 'package.json'), '{ not valid json')

    expect(() => resolveRelease(dir)).toThrow(/Could not resolve a release/)
  })

  it('falls through to the final throw when version is not a string', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: 123 }))

    expect(() => resolveRelease(dir)).toThrow(/Could not resolve a release/)
  })

  it('throws when nothing resolves the release', () => {
    expect(() => resolveRelease(dir)).toThrow(/Could not resolve a release/)
  })
})
