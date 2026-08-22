# @getmonitor/core

## 0.4.0

### Minor Changes

- [`34ae448`](https://github.com/get-monitor/getmonitor-js/commit/34ae448e4be79ec187d504a105ed27fbc0ddc73b) Thanks [@washingtonserip](https://github.com/washingtonserip)! - Add Fastify, Koa, Hono, and NestJS framework integrations to @getmonitor/node

## 0.3.1

### Patch Changes

- Fix exception ingest to send `X-GetMonitor-Project-Key` instead of `Authorization: Bearer`, matching the header ingester-api's deployed endpoint actually reads. Every exception sent by a previously-published version of this SDK was being rejected with 401 and never reached ingestion.

## 0.3.0

### Minor Changes

- stable version

## 0.2.0

### Minor Changes

- [`e7dc909`](https://github.com/get-monitor/getmonitor-js/commit/e7dc90952f9f13e8cd9e1bd0370702c112d06b77) Thanks [@washingtonserip](https://github.com/washingtonserip)! - New API key strategy

- [`e7dc909`](https://github.com/get-monitor/getmonitor-js/commit/e7dc90952f9f13e8cd9e1bd0370702c112d06b77) Thanks [@washingtonserip](https://github.com/washingtonserip)! - Stable version
