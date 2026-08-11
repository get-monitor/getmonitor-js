import { describe, it, expect } from 'vitest'
import { parseArgs } from '../bin'

describe('parseArgs', () => {
  it('parses the required directory', () => {
    expect(parseArgs(['sourcemaps', 'upload', './dist'])).toEqual({
      directory: './dist',
    })
  })

  it('parses optional --release and --auth-token', () => {
    expect(
      parseArgs(['sourcemaps', 'upload', './dist', '--release', '1.2.3', '--auth-token', 'secret']),
    ).toEqual({ directory: './dist', release: '1.2.3', authToken: 'secret' })
  })

  it('throws when the command is not "sourcemaps upload"', () => {
    expect(() => parseArgs(['bogus', './dist'])).toThrow(/Usage/)
  })

  it('throws on an unknown flag', () => {
    expect(() => parseArgs(['sourcemaps', 'upload', './dist', '--api-host', 'https://example.com'])).toThrow(
      /Unknown flag: --api-host/,
    )
  })
})
