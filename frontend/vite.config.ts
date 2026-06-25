import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // v6+ 部署修复:npm script 的 CWD 是 package.json 所在目录(根),不是 frontend/。
  // 显式指定 root + build.outDir,让 `npm run build` 在根目录跑也能 work。
  root: __dirname,
  build: {
    outDir: `${__dirname}/dist`,
    emptyOutDir: true,
  },
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8000" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: `${__dirname}/src/test-setup.ts`,
    include: `${__dirname}/src/**/*.{test,spec}.?(c|m)[jt]s?(x)`,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "./tests/e2e/**",
      "./tests/**",
      "**/tests/e2e/**",
    ],
    root: __dirname,
  },
});