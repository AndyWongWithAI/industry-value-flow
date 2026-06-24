import { defineConfig } from "@playwright/test";

// E2E config.
//
// Why `webServer` with `reuseExistingServer: !process.env.CI`:
// - Locally: developer may have backend/frontend already running; reuse them.
// - In CI: always start fresh servers (CI workers are clean).
//
// Why explicit `cwd` per server:
// - The Playwright config file lives in `frontend/`, but the backend venv lives
//   at the project root. Without `cwd: ".."`, the backend webServer would try
//   to activate the venv from the wrong directory.
//
// Why `executablePath` from PLAYWRIGHT_CHROMIUM env var:
// - In environments where `npx playwright install` is not available (no sudo,
//   air-gapped CI), fall back to a pre-installed system chromium. The default
//   behaviour (when env var is unset) is to use the Playwright-managed
//   chromium downloaded into ~/.cache/ms-playwright/.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...(process.env.PLAYWRIGHT_CHROMIUM
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM } }
          : {}),
      },
    },
  ],
  webServer: [
    {
      command: "cd .. && source .venv/bin/activate && uvicorn main:app --port 8000",
      cwd: ".",
      port: 8000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run dev -- --host 0.0.0.0 --port 5173",
      cwd: ".",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
