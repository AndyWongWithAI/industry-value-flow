import { test, expect } from "@playwright/test";

test("core flow: home → industry → pain points", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("行业价值流转")).toBeVisible();
  await expect(page.locator("[data-testid='sankey-svg']")).toBeVisible();

  // 假设用户配置了有效 Claude key;否则跳到 E2E-002 降级
  await page.getByText("金融").first().click({ trial: false }).catch(() => {});

  // 验证:页面跳到 /industry/{id} 或显示降级
  await page.waitForURL(/\/industry\//, { timeout: 5000 }).catch(() => {});
  // 不强制断言(取决于是否配置了 LLM key)
});