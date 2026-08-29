# @getmonitor/node

## 0.4.2

### Patch Changes

- Updated dependencies []:
  - @getmonitor/core@0.4.1

## 0.4.1

### Patch Changes

- Fix the 0.4.0 publish, which shipped a stale `dist/` missing the CJS build, the `./nestjs` subpath export, and all TypeScript declarations. A leftover `tsconfig.tsbuildinfo` from a prior build was suppressing declaration emission on the main entry, and the last publish ran without a clean rebuild first. Added a `prepublishOnly` script that always does a clean rebuild before publishing.

## 0.4.0

### Minor Changes

- [`34ae448`](https://github.com/get-monitor/getmonitor-js/commit/34ae448e4be79ec187d504a105ed27fbc0ddc73b) Thanks [@washingtonserip](https://github.com/washingtonserip)! - Add Fastify, Koa, Hono, and NestJS framework integrations to @getmonitor/node

### Patch Changes

- Updated dependencies [[`34ae448`](https://github.com/get-monitor/getmonitor-js/commit/34ae448e4be79ec187d504a105ed27fbc0ddc73b)]:
  - @getmonitor/core@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @getmonitor/core@0.3.1

## 0.3.0

### Minor Changes

- stable version

### Patch Changes

- Updated dependencies [`c57b8a8`]:
  - @getmonitor/core@0.3.0

## 0.2.0

### Minor Changes

- [`e7dc909`](https://github.com/get-monitor/getmonitor-js/commit/e7dc90952f9f13e8cd9e1bd0370702c112d06b77) Thanks [@washingtonserip](https://github.com/washingtonserip)! - New API key strategy

- [`e7dc909`](https://github.com/get-monitor/getmonitor-js/commit/e7dc90952f9f13e8cd9e1bd0370702c112d06b77) Thanks [@washingtonserip](https://github.com/washingtonserip)! - Stable version

### Patch Changes

- Updated dependencies [[`e7dc909`](https://github.com/get-monitor/getmonitor-js/commit/e7dc90952f9f13e8cd9e1bd0370702c112d06b77), [`e7dc909`](https://github.com/get-monitor/getmonitor-js/commit/e7dc90952f9f13e8cd9e1bd0370702c112d06b77)]:
  - @getmonitor/core@0.2.0
