// NOTE: This file exists only as a compatibility shim.
// CRA module resolution can pick .js before .ts, so re-export from the canonical api.ts.

export { default } from './api.ts';
export * from './api.ts';
