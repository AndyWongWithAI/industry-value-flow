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
  // Pre-flight: backend reachable. This catches "backend not started" early,
  // before Playwright wastes time loading a broken frontend.
  const ctx = await request.newContext({ baseURL: "http://localhost:8000" });
  const apiResp = await ctx.get("/api/industries");
  expect(apiResp.ok(), `backend /api/industries must return 2xx, got ${apiResp.status()}`).toBeTruthy();
  await ctx.dispose();

  // 1. Home renders.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "行业价值流转" })).toBeVisible();
  await expect(page.locator('[data-testid="sankey-svg"]')).toBeVisible();
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
});
