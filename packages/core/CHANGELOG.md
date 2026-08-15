# @getmonitor/core

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
