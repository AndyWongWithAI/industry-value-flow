// Test-only helper: re-export tokens.css content as a string for vitest tests.
// We do NOT use Vite's `?raw` because the project's vitest setup doesn't load
// the raw suffix. Instead, this file uses Node's fs module (available at
// test time in vitest's Node environment) to read the css file synchronously.
//
// The CSS at src/styles/tokens.css is the single source of truth; this file
// only re-exports its contents for assertion in tests.
// @ts-expect-error - node:fs not in @types and the frontend tsc config doesn't include node
import { readFileSync } from "node:fs";
// @ts-expect-error - node:url not in @types
import { fileURLToPath } from "node:url";
// @ts-expect-error - node:path not in @types
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tokensPath = resolve(__dirname, "./tokens.css");

export const readTokensCss = (): string => {
  try {
    return readFileSync(tokensPath, "utf-8") as string;
  } catch {
    // Fallback for environments where fs is not available (e.g. browser).
    return "";
  }
};
