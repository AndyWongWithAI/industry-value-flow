import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: [
    { command: "cd ../ && source .venv/bin/activate && uvicorn main:app --port 8000", port: 8000, reuseExistingServer: true },
    { command: "npm run dev", port: 5173, reuseExistingServer: true },
  ],
  use: { baseURL: "http://localhost:5173" },
});