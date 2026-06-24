import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8000" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // Exclude Playwright e2e — those are run by `npx playwright test`, not vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
  },
});