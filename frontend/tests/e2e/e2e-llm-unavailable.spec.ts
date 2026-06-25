// @ts-nocheck
/**
 * E2E 4/5 — LLM 不可用时的 EmptyState.
 *
 * 验证:
 *   - mock GET /api/graph 返回 503(模拟 LLM 未配置)
 *   - 访问 / → EmptyState 出现,标题为 "请先配置 LLM"
 *   - "前往设置" 按钮可见且 href = /settings
 *
 * 关键策略:
 *   - page.route 拦截 /api/graph 返回 503
 *   - lib/api.ts 的 request() 把 503 → LLMUnavailableError
 *   - GraphPage catch LLMUnavailableError → 渲染 EmptyState(title="请先配置 LLM")
 *   - EmptyState 组件 data-testid="empty-state" / "empty-state-action"
 */
import { test, expect } from "@playwright/test";

test.describe("E2E 4/5: LLM unavailable → EmptyState", () => {
  test("GET /api/graph 503 → EmptyState '请先配置 LLM' + '前往设置' → /settings", async ({
    page,
  }) => {
    await page.route("**/api/graph", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "llm_unavailable",
            message: "请配置 LLM",
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");

    // EmptyState 卡片出现
    const emptyState = page.getByTestId("empty-state");
    await expect(emptyState).toBeVisible({ timeout: 10_000 });

    // 标题 "请先配置 LLM"(在 h2 里)
    await expect(emptyState.locator("h2")).toHaveText("请先配置 LLM");

    // "前往设置" 按钮,href = /settings
    const action = page.getByTestId("empty-state-action");
    await expect(action).toBeVisible();
    await expect(action).toHaveText("前往设置");
    await expect(action).toHaveAttribute("href", "/settings");
  });

  test("副标题和 reason 也正确展示", async ({ page }) => {
    await page.route("**/api/graph", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "llm_unavailable",
          message: "未配置 API Key",
        }),
      });
    });

    await page.goto("/");
    const emptyState = page.getByTestId("empty-state");
    await expect(emptyState).toBeVisible({ timeout: 10_000 });

    // 副标题(提示平台依赖 LLM)
    await expect(emptyState).toContainText("LLM");

    // reason(失败原因)展示
    const reason = page.getByTestId("empty-state-reason");
    await expect(reason).toBeVisible();
    await expect(reason).toContainText("LLM 服务不可用");
  });
});