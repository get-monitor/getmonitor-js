---
"@getmonitor/cli": patch
---

Upload source map artifacts concurrently (bounded to 20 in flight) instead of one at a time. `processSourceMaps` previously awaited each upload serially, so a build with over a thousand artifacts spent minutes waiting on per-file network round trips one after another. `result.uploaded`/`result.failed` still come back in the same deterministic (discovery) order regardless of which upload finishes first.
