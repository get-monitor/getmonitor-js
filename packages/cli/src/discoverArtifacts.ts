// packages/cli/src/discoverArtifacts.ts
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface Artifact {
  jsPath: string
  mapPath: string
}

const SOURCE_MAPPING_URL = /^\s*\/\/#\s*sourceMappingURL=(\S+)\s*$/gm

/** Recursively finds every `*.js` file under `directory` and resolves its source map path
 * primarily via its `//# sourceMappingURL=` comment (resolved relative to the JS file's own
 * directory), falling back to same-basename-plus-`.map` when there's no comment, the comment
 * references a data: URI, or the referenced file doesn't exist. A JS file with no resolvable
 * map either way is skipped. */
export function discoverArtifacts(directory: string): Artifact[] {
  const artifacts: Artifact[] = []
  walk(directory, artifacts)
  return artifacts
}

function walk(dir: string, artifacts: Artifact[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, artifacts)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const mapPath = resolveMapPath(fullPath)
      if (mapPath) artifacts.push({ jsPath: fullPath, mapPath })
    }
  }
}

function resolveMapPath(jsPath: string): string | undefined {
  const commentMapPath = readSourceMappingUrlComment(jsPath)
  if (commentMapPath && existsSync(commentMapPath)) return commentMapPath

  const fallbackMapPath = `${jsPath}.map`
  if (existsSync(fallbackMapPath)) return fallbackMapPath

  return undefined
}

function readSourceMappingUrlComment(jsPath: string): string | undefined {
  let content: string
  try {
    content = readFileSync(jsPath, 'utf8')
  } catch {
    // Unreadable file (permission denied, broken symlink, deleted mid-walk, etc.) — treat it
    // like "no comment found" rather than aborting the whole discoverArtifacts() walk.
    return undefined
  }

  const matches = [...content.matchAll(SOURCE_MAPPING_URL)]
  if (matches.length === 0) return undefined

  // The LAST sourceMappingURL comment in the file wins, matching how bundlers/browsers treat
  // concatenated/reprocessed output — later comments supersede earlier ones.
  const reference = matches.at(-1)![1]
  if (reference.startsWith('data:')) return undefined // embedded map, nothing to discover on disk

  return join(dirname(jsPath), reference)
}
