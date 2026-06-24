// Ambient TypeScript declarations for the whole project (auto-included via
// tsconfig.json `include: ["src"]`).
//
// The DOM-only `lib` in tsconfig.json does not expose Node.js globals, but
// vitest tests in this project use `global.fetch` to mock the Fetch API.
// Aliasing `global` to `globalThis` makes tsc happy and matches runtime
// behavior (jsdom exposes a `global` proxy to globalThis).
declare const global: typeof globalThis;
