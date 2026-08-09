import { describe, it, expect } from 'vitest'
import { parseArgs } from '../bin'

describe('parseArgs', () => {
  it('parses the required directory and api-host', () => {
    expect(parseArgs(['sourcemaps', 'upload', './dist', '--api-host', 'https://ingest.test'])).toEqual({
      directory: './dist',
      apiHost: 'https://ingest.test',
    })
  })

  it('parses optional --release and --auth-token', () => {
    expect(
      parseArgs([
        'sourcemaps',
        'upload',
        './dist',
        '--api-host',
        'https://ingest.test',
        '--release',
        '1.2.3',
        '--auth-token',
        'secret',
      ]),
    ).toEqual({ directory: './dist', apiHost: 'https://ingest.test', release: '1.2.3', authToken: 'secret' })
  })

  it('throws when the command is not "sourcemaps upload"', () => {
    expect(() => parseArgs(['bogus', './dist'])).toThrow(/Usage/)
  })

  it('throws when --api-host is missing', () => {
    expect(() => parseArgs(['sourcemaps', 'upload', './dist'])).toThrow(/api-host/)
  })
})
