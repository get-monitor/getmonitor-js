# @getmonitor/cli

## 0.3.3

### Patch Changes

- Republish with the actual build output included. 0.3.2 was published with an empty `dist/` (no `bin.js`, no `index.js`/`.cjs`, no type declarations) because nothing forced a build to run before publish — this version adds a `prepublishOnly` script so it can't happen again.

## 0.3.2

### Patch Changes

- [`87e6b7e`](https://github.com/get-monitor/getmonitor-js/commit/87e6b7ebf9976a03218c4acbfc854b048f3472ba) Thanks [@washingtonserip](https://github.com/washingtonserip)! - Upload source map artifacts concurrently (bounded to 20 in flight) instead of one at a time. `processSourceMaps` previously awaited each upload serially, so a build with over a thousand artifacts spent minutes waiting on per-file network round trips one after another. `result.uploaded`/`result.failed` still come back in the same deterministic (discovery) order regardless of which upload finishes first.

## 0.3.1

### Patch Changes

- [`ad10c6f`](https://github.com/get-monitor/getmonitor-js/commit/ad10c6fb032ade4cd9d06fb32452c022f19ff030) Thanks [@washingtonserip](https://github.com/washingtonserip)! - Log the actual error (HTTP status, malformed map JSON, etc.) when a source map artifact fails to process, instead of silently discarding it. Previously `processSourceMaps` only reported the failed file path with no way to tell an auth failure from a network error from a corrupt map.

## 0.3.0

### Minor Changes

- stable version

## 0.2.0

### Minor Changes

- [`e7dc909`](https://github.com/get-monitor/getmonitor-js/commit/e7dc90952f9f13e8cd9e1bd0370702c112d06b77) Thanks [@washingtonserip](https://github.com/washingtonserip)! - New API key strategy

- [`e7dc909`](https://github.com/get-monitor/getmonitor-js/commit/e7dc90952f9f13e8cd9e1bd0370702c112d06b77) Thanks [@washingtonserip](https://github.com/washingtonserip)! - Stable version
