// 根 vitest 配置 — 让 `cd <root> && npm test` 也只跑前端 src/__tests__,
// 不跑 frontend/tests/e2e(那是 playwright 的活)。
//
// 真正的 vitest 配置在 frontend/vite.config.ts(用于 `cd frontend && npm test`)。
// 这里只是为了从根 npm test 走时不踩坑。
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["./frontend/src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "./frontend/tests/e2e/**",
      "./frontend/tests/**",
      "**/frontend/tests/e2e/**",
    ],
  },
});