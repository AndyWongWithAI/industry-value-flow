import { test, expect, request } from "@playwright/test";

// E2E-001: core flow — home renders, sector click navigates, detail page loads.
//
// Design principles:
// - LLM-dependent UI (PainPanel) is allowed to be in any of these states:
//     loading ("加载痛点中...") / degraded ("AI 分析暂不可用") / with data
//   The point of E2E is to verify the wiring, not the LLM output.
// - Every other claim is a strict assertion — broken backend, broken routing,
//   broken Sankey rendering, or a missing Nav will fail the test loudly.
// - No `.catch(() => {})` test-theatre: a swallowed failure cannot distinguish
//   a real bug from a degraded LLM.
//
// CI requirement: backend + frontend must be running before this test runs.
// In CI, `playwright.config.ts` starts them via `webServer`. Locally, the
// developer typically runs them by hand and Playwright reuses the existing
// servers (`reuseExistingServer: true`).

test("E2E-001: home → industry/agriculture renders and PainPanel mounts", async ({ page }) => {
  // Diagnostic capture: log console + page errors so CI failures are
  // debuggable without an attached trace.
  const consoleMsgs: string[] = [];
  const pageErrors: string[] = [];
  const requests: string[] = [];
  const responses: string[] = [];
  page.on("console", (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => pageErrors.push(`[pageerror] ${err.message}`));
  page.on("request", (req) => requests.push(`${req.method()} ${req.url()}`));
  page.on("response", (resp) => responses.push(`${resp.status()} ${resp.url()}`));

  // Always-on diagnostic dump: if the test fails anywhere below, the finally
  // block prints whatever the browser saw. `expect.toBeVisible()` throws and
  // skips the rest of the test body, so the dump has to live in finally —
  // post-test code in the test function does not run on failure.
  let dumpOnFailure = async () => {};
  try {
    // Pre-flight: backend reachable. This catches "backend not started" early,
    // before Playwright wastes time loading a broken frontend.
    const ctx = await request.newContext({ baseURL: "http://localhost:8000" });
    const apiResp = await ctx.get("/api/industries");
    expect(apiResp.ok(), `backend /api/industries must return 2xx, got ${apiResp.status()}`).toBeTruthy();
    await ctx.dispose();

    // 1. Home renders.
    // `waitUntil: "networkidle"` waits for the /api/industries fetch to finish
    // before the React app can swap "加载中..." for the real h1. CI cold starts
    // push the first paint past the default 5s, so use a longer timeout.
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "行业价值流转" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="sankey-svg"]')).toBeVisible({ timeout: 15_000 });
    // Nav should be present (new addition — confirms the recent refactor didn't
    // regress the top navigation).
    await expect(page.getByRole("link", { name: "首页" })).toBeVisible();
    await expect(page.getByRole("link", { name: "LLM 设置" })).toBeVisible();

    // 2. Click on the first sector (农业). The Sankey renders <rect> elements
    //    with click handlers attached via D3. The first node is agriculture_root.
    const firstSector = page.locator('[data-testid="sankey-svg"] rect').first();
    await expect(firstSector).toBeVisible();
    await firstSector.click();

    // 3. Navigation must happen — broken routing is a real bug, not "degraded mode".
    await page.waitForURL(/\/industry\/agriculture/, { timeout: 5_000 });
    expect(page.url()).toMatch(/\/industry\/agriculture$/);

    // 4. Industry detail page renders.
    await expect(page.getByRole("heading", { name: "农业" })).toBeVisible();
    await expect(page.locator('[data-testid="sankey-svg"]')).toBeVisible();

    // 5. PainPanel mounts. Allowed states: loading / degraded / with-data.
    //    "加载痛点中..." OR "AI 分析暂不可用" OR an <h3>痛点</h3> heading.
    //    Whichever shows up, the panel must be present — empty page is a bug.
    const painPanelRegion = page.getByTestId("pain-panel").or(
      page.locator("text=/加载痛点中|AI 分析暂不可用|^痛点$/")
    );
    await expect(painPanelRegion.first()).toBeVisible({ timeout: 10_000 });
  } finally {
    // Failure-only diagnostic dump. We capture console + pageerror + every
    // request/response throughout the test, then print them all if the
    // test failed. Writing to stderr (not console.log) because Playwright's
    // reporter suppresses stdout in some modes.
    if (test.info().status !== "passed") {
      process.stderr.write("\n=== page console ===\n");
      consoleMsgs.forEach((m) => process.stderr.write(m + "\n"));
      process.stderr.write("=== page errors ===\n");
      pageErrors.forEach((m) => process.stderr.write(m + "\n"));
      process.stderr.write("=== requests ===\n");
      requests.forEach((m) => process.stderr.write(m + "\n"));
      process.stderr.write("=== responses ===\n");
      responses.forEach((m) => process.stderr.write(m + "\n"));
      const html = await page.content();
      process.stderr.write("=== page HTML (first 2000 chars) ===\n");
      process.stderr.write(html.slice(0, 2000) + "\n");
      const fs = await import("fs/promises");
      await fs.writeFile("/tmp/e2e-page.html", html).catch(() => {});
      process.stderr.write("=== full HTML written to /tmp/e2e-page.html ===\n");
    }
    void dumpOnFailure;
  }
});
