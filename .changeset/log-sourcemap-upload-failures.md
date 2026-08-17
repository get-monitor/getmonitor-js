---
"@getmonitor/cli": patch
---

Log the actual error (HTTP status, malformed map JSON, etc.) when a source map artifact fails to process, instead of silently discarding it. Previously `processSourceMaps` only reported the failed file path with no way to tell an auth failure from a network error from a corrupt map.
