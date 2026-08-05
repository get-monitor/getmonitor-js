// packages/browser/src/umd.ts
//
// This file exists ONLY to give the UMD rollup output (see rollup.config.js,
// input: 'src/umd.ts', output.exports: 'default') a valid single-default-export
// entry point, so the browser global becomes `window.GetMonitor = <the client
// itself>` rather than a nested `{ GetMonitor: <client> }`.
//
// Do NOT "simplify" by merging this re-export back into index.ts. index.ts must
// keep its named export (for ESM/CJS consumers) and must NOT also have a default
// export, because Rollup's `output.exports: 'default'` throws a build error if the
// entry module has any named export alongside the default — it does not silently
// flatten a dual-export module. That exact failure was found and fixed during
// Task 11's review; keeping this as a separate entry point is what prevents it
// from silently coming back.
export { GetMonitor as default } from './GetMonitor'
