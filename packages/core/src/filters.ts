import { GetMonitorEvent, FilterOptions, UrlFilterOptions } from './types'

export function matchesIgnoreErrors(event: GetMonitorEvent, ignoreErrors: (string | RegExp)[] = []): boolean {
  const primary = event.exceptions[event.exceptions.length - 1]
  if (!primary) return false

  return ignoreErrors.some((pattern) => {
    if (typeof pattern === 'string') {
      return primary.type === pattern || primary.message.includes(pattern)
    }
    return pattern.test(primary.type) || pattern.test(primary.message)
  })
}

/** Browser-only in practice: true (drop) if denyUrls matches a frame, or allowUrls is set and no frame matches it. */
export function matchesUrlFilters(event: GetMonitorEvent, options: Partial<UrlFilterOptions>): boolean {
  const filenames = event.exceptions.flatMap((exc) => exc.stacktrace.frames.map((f) => f.filename))

  if (options.denyUrls?.length) {
    if (filenames.some((filename) => matchesAnyPattern(filename, options.denyUrls!))) {
      return true
    }
  }

  if (options.allowUrls?.length) {
    if (!filenames.some((filename) => matchesAnyPattern(filename, options.allowUrls!))) {
      return true
    }
  }

  return false
}

function matchesAnyPattern(value: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some((pattern) => (typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value)))
}

/** Returns the (possibly mutated) event, or null if it should be dropped. */
export function applyFilters(
  event: GetMonitorEvent,
  options: FilterOptions & Partial<UrlFilterOptions>
): GetMonitorEvent | null {
  if (matchesIgnoreErrors(event, options.ignoreErrors)) {
    return null
  }
  if (matchesUrlFilters(event, options)) {
    return null
  }
  if (options.beforeCapture) {
    return options.beforeCapture(event)
  }
  return event
}
