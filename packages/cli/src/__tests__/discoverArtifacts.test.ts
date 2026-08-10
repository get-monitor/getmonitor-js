import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverArtifacts } from '../discoverArtifacts'

describe('discoverArtifacts', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'getmonitor-cli-test-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('finds a .js file with a sibling .js.map', () => {
    writeFileSync(join(dir, 'main.js'), 'console.log(1)')
    writeFileSync(join(dir, 'main.js.map'), '{}')

    const artifacts = discoverArtifacts(dir)

    expect(artifacts).toEqual([{ jsPath: join(dir, 'main.js'), mapPath: join(dir, 'main.js.map') }])
  })

  it('skips a .js file with no matching .map', () => {
    writeFileSync(join(dir, 'main.js'), 'console.log(1)')

    expect(discoverArtifacts(dir)).toEqual([])
  })

  it('recurses into subdirectories', () => {
    const nested = join(dir, 'chunks')
    mkdirSync(nested)
    writeFileSync(join(nested, 'chunk1.js'), 'console.log(1)')
    writeFileSync(join(nested, 'chunk1.js.map'), '{}')

    const artifacts = discoverArtifacts(dir)

    expect(artifacts).toEqual([{ jsPath: join(nested, 'chunk1.js'), mapPath: join(nested, 'chunk1.js.map') }])
  })

  it('ignores non-JS files', () => {
    writeFileSync(join(dir, 'styles.css'), 'body {}')
    writeFileSync(join(dir, 'main.js'), 'console.log(1)')
    writeFileSync(join(dir, 'main.js.map'), '{}')

    expect(discoverArtifacts(dir)).toHaveLength(1)
  })

  it('finds .mjs and .cjs files with sibling .map files', () => {
    // Nitro's node-server preset (used by @getmonitor/nuxt) emits `.output/server/**/*.mjs`
    // unconditionally — verified against a real `nuxt build` (Task 13), where a `.js`-only
    // match left every server chunk's map undiscovered and unstripped.
    writeFileSync(join(dir, 'server.mjs'), 'console.log(1)')
    writeFileSync(join(dir, 'server.mjs.map'), '{}')
    writeFileSync(join(dir, 'legacy.cjs'), 'console.log(2)')
    writeFileSync(join(dir, 'legacy.cjs.map'), '{}')

    const artifacts = discoverArtifacts(dir)

    expect(artifacts).toEqual(
      expect.arrayContaining([
        { jsPath: join(dir, 'server.mjs'), mapPath: join(dir, 'server.mjs.map') },
        { jsPath: join(dir, 'legacy.cjs'), mapPath: join(dir, 'legacy.cjs.map') },
      ]),
    )
    expect(artifacts).toHaveLength(2)
  })

  it('resolves the map via a custom sourceMappingURL comment, even with a different basename', () => {
    writeFileSync(join(dir, 'main.js'), 'console.log(1)\n//# sourceMappingURL=custom-name.map')
    writeFileSync(join(dir, 'custom-name.map'), '{}')
    // A same-basename fallback file that must NOT be picked, to prove the comment wins.
    writeFileSync(join(dir, 'main.js.map'), '{"wrong":true}')

    const artifacts = discoverArtifacts(dir)

    expect(artifacts).toEqual([{ jsPath: join(dir, 'main.js'), mapPath: join(dir, 'custom-name.map') }])
  })

  it('falls back to basename+.map when the sourceMappingURL comment points at a file that does not exist', () => {
    writeFileSync(join(dir, 'main.js'), 'console.log(1)\n//# sourceMappingURL=missing.map')
    writeFileSync(join(dir, 'main.js.map'), '{}')

    const artifacts = discoverArtifacts(dir)

    expect(artifacts).toEqual([{ jsPath: join(dir, 'main.js'), mapPath: join(dir, 'main.js.map') }])
  })

  it('skips a file whose sourceMappingURL is a data: URI and has no basename fallback', () => {
    writeFileSync(join(dir, 'main.js'), 'console.log(1)\n//# sourceMappingURL=data:application/json;base64,e30=')

    expect(discoverArtifacts(dir)).toEqual([])
  })

  it('does not abort the whole walk when one .js file is unreadable, and still finds the rest', () => {
    writeFileSync(join(dir, 'main.js'), 'console.log(1)')
    writeFileSync(join(dir, 'main.js.map'), '{}')

    const unreadablePath = join(dir, 'broken.js')
    writeFileSync(unreadablePath, 'console.log(2)')
    // Intentionally no broken.js.map: broken.js should simply be skipped once its comment
    // read fails, not crash discoverArtifacts() for the whole directory.
    chmodSync(unreadablePath, 0o000)

    try {
      let artifacts: ReturnType<typeof discoverArtifacts> = []
      expect(() => {
        artifacts = discoverArtifacts(dir)
      }).not.toThrow()

      expect(artifacts).toEqual([{ jsPath: join(dir, 'main.js'), mapPath: join(dir, 'main.js.map') }])
    } finally {
      // Restore permissions so the afterEach rmSync cleanup can't itself fail.
      chmodSync(unreadablePath, 0o644)
    }
  })

  it('uses the LAST sourceMappingURL comment when a file contains more than one', () => {
    writeFileSync(
      join(dir, 'main.js'),
      ['console.log(1)', '//# sourceMappingURL=wrong.map', 'console.log(2)', '//# sourceMappingURL=real.map'].join(
        '\n',
      ),
    )
    writeFileSync(join(dir, 'real.map'), '{}')
    // Intentionally no wrong.map on disk: if the first (wrong) comment were picked, resolution
    // would fall through to the (also-missing) main.js.map fallback and the file would be
    // skipped entirely — so finding real.map proves the LAST match won, not the first.

    const artifacts = discoverArtifacts(dir)

    expect(artifacts).toEqual([{ jsPath: join(dir, 'main.js'), mapPath: join(dir, 'real.map') }])
  })
})
