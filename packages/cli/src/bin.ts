// packages/cli/src/bin.ts
import { processSourceMaps } from './processSourceMaps'

interface ParsedArgs {
  directory: string
  apiHost: string
  release?: string
  authToken?: string
}

/** Exported (not just used internally) so it's unit-testable without spawning a process. */
export function parseArgs(argv: string[]): ParsedArgs {
  const [command, subcommand, directory, ...rest] = argv
  if (command !== 'sourcemaps' || subcommand !== 'upload' || !directory) {
    throw new Error(
      'Usage: getmonitor sourcemaps upload <directory> --api-host <url> [--release <release>] [--auth-token <token>]',
    )
  }

  let release: string | undefined
  let authToken: string | undefined
  let apiHost: string | undefined

  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i]
    const value = rest[i + 1]
    if (flag === '--release') release = value
    else if (flag === '--auth-token') authToken = value
    else if (flag === '--api-host') apiHost = value
    else throw new Error(`Unknown flag: ${flag}`)
  }

  if (!apiHost) {
    throw new Error('Usage: getmonitor sourcemaps upload <directory> --api-host <url> [...]')
  }

  return { directory, apiHost, release, authToken }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const result = await processSourceMaps({
    directory: args.directory,
    release: args.release,
    authToken: args.authToken,
    apiHost: args.apiHost,
  })

  console.log(`Uploaded ${result.uploaded.length} source map(s).`)
  if (result.failed.length > 0) {
    console.error(`Failed to upload ${result.failed.length} source map(s):`)
    for (const file of result.failed) console.error(`  ${file}`)
    process.exitCode = 1
  }
}

// Skipped under Vitest (which imports this module to test parseArgs) — only run when
// invoked directly as the built dist/bin.js executable. Confirmed empirically that Vitest
// sets process.env.VITEST = 'true' in the process that loads this module, so this check
// reliably prevents main() (which does real I/O and can set process.exitCode) from running
// during `pnpm test`.
if (process.env.VITEST === undefined) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
