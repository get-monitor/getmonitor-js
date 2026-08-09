// packages/cli/src/injectDebugId.ts

export interface InjectedArtifact {
  js: string
  map: string
}

/** Computes the debug-ID-injected JS content and the debug-ID-tagged source map JSON, in
 * memory — callers decide whether/when to persist the result to disk (processSourceMaps
 * only writes it after a successful upload, so a failed upload never leaves partially
 * mutated files behind). The injected JS also has its `//# sourceMappingURL=` comment(s)
 * removed, since the source map it names is only ever kept in GetMonitor's backend after
 * a successful upload — never served publicly alongside it.
 *
 * `originalMapJson` must be valid JSON — this is a pure function with no fallback to
 * degrade to (unlike discoverArtifacts, which can skip an unreadable file, this function's
 * caller expects a definite result), so a malformed map is left to throw via JSON.parse
 * rather than being swallowed here. */
export function injectDebugId(originalJs: string, originalMapJson: string, debugId: string): InjectedArtifact {
  const withoutMapComment = originalJs
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//# sourceMappingURL='))
    .join('\n')

  const map = JSON.parse(originalMapJson)
  map.debugId = debugId

  return {
    js: `${withoutMapComment}\n${buildInjectedSnippet(debugId)}`,
    map: JSON.stringify(map),
  }
}

/** At load time, captures this statement's own `Error().stack`, extracts this file's
 * identity from it using the same frame-shape @getmonitor/core's parseStackTrace parses for
 * real errors (V8's `at ... (file:line:col)`, V8's bare `at file:line:col`, and Gecko's
 * `fn@file:line:col`), and registers the debug ID under that identity. Like parseStackTrace,
 * it scans every stack line and takes the first one that matches any of those shapes, rather
 * than assuming a fixed line index — V8 prefixes an `"ErrorType: message"` header line that
 * Gecko and Safari don't emit, so a fixed index would grab the wrong frame (or the wrong
 * file's identity) on non-V8 engines; the header line simply fails to match any frame regex
 * and is skipped automatically. A later real error whose frame.filename is parsed from the
 * same JS-engine stack serialization will look up the same key. Wrapped in try/catch so any
 * parsing edge case can never break the host app; wrapped in an IIFE so its locals don't leak
 * into the file's module scope.
 *
 * `debugId` is interpolated unescaped into the generated snippet's string literal. That's
 * safe today because every caller in this system sources `debugId` from
 * `crypto.randomUUID()` (a later task), which can never contain a quote or backslash — but
 * this function itself doesn't enforce that shape, so a caller passing an arbitrary string
 * containing `'` or `\` would produce invalid/injected JS here. Flagged, not fixed, since
 * validating/escaping isn't part of this function's specified contract. */
function buildInjectedSnippet(debugId: string): string {
  return (
    ";(function(){try{var s=(new Error()).stack||'';var ls=s.split('\\n');var m=null;" +
    'for(var i=0;i<ls.length&&!m;i++){var l=ls[i];' +
    "m=l.match(/\\((.*):(\\d+):(\\d+)\\)\\s*$/)||l.match(/at (.*):(\\d+):(\\d+)\\s*$/)||l.match(/@(.*):(\\d+):(\\d+)\\s*$/)}" +
    "var f=m&&m[1];if(f){var g=(typeof globalThis!=='undefined'?globalThis:self);" +
    `g.__getmonitorDebugIds=g.__getmonitorDebugIds||{};g.__getmonitorDebugIds[f]='${debugId}';` +
    '}}catch(e){}})();'
  )
}
