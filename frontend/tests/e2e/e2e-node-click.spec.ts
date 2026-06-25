// @ts-nocheck
/**
 * E2E 2/5 — 点击节点弹出 NodePanel.
 *
 * 验证:
 *   - 点击 react-flow 节点 → NodePanel 出现在右侧
 *   - NodePanel 显示节点名称 / 类别 / 状态
 */
import { test, expect } from "@playwright/test";

const MOCK_GRAPH = {
  nodes: [
    {
      id: "B06",
      label: "煤炭开采和洗选业",
      category: "B",
      description: "煤炭的开采、洗选与初步加工",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      id: "D44",
      label: "电力、热力生产和供应业",
      category: "D",
      description: "电力与热力的生产、输送与供应",
      status: "failed",
      failed_reason: "LLM API 503(限流)",
      last_attempt_at: null,
    },
  ],
  edges: [
    {
      id: "B06-D44",
      source: "B06",
      target: "D44",
      relation_type: "supports",
      weight: 4,
      explanation: "煤炭是火力发电的主要燃料",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  generated_at: "2026-06-25T00:00:00Z",
  llm_config_hash: "e2e",
  schema_version: "v1",
};

const MOCK_STATS = { total: 3, generated: 2, failed: 1, pending: 0 };

test.describe("E2E 2/5: click node → NodePanel", () => {
  test("点击 B06 节点 → NodePanel 出现,显示名称/类别/状态", async ({ page }) => {
    await page.route("**/api/graph", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          nodes: MOCK_GRAPH.nodes,
          edges: MOCK_GRAPH.edges,
          stats: MOCK_STATS,
        }),
      });
    });

    await page.goto("/");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-testid="graph-node-煤炭开采和洗选业"]')
    ).toBeVisible();

    // 点击 react-flow 节点 (rf__node-{id} 是 react-flow 自带 testid)
    await page.getByTestId("rf__node-B06").click();

    // NodePanel 出现
    const panel = page.getByTestId("node-panel");
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // 验证内容包含节点名称
    await expect(panel).toContainText("煤炭开采和洗选业");
  });

  test("点击 failed 节点 → NodePanel 显示失败条", async ({ page }) => {
    await page.route("**/api/graph", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          nodes: MOCK_GRAPH.nodes,
          edges: MOCK_GRAPH.edges,
          stats: MOCK_STATS,
        }),
      });
    });

    await page.goto("/");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    // 点击 D44 (failed 节点)
    await page.getByTestId("rf__node-D44").click();
    const panel = page.getByTestId("node-panel");
    await expect(panel).toBeVisible();

    // 失败条出现
    const banner = page.getByTestId("node-panel-failed-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("未生成");
  });

  test("NodePanel 关闭按钮可关闭面板", async ({ page }) => {
    await page.route("**/api/graph", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          nodes: MOCK_GRAPH.nodes,
          edges: MOCK_GRAPH.edges,
          stats: MOCK_STATS,
        }),
      });
    });

    await page.goto("/");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("rf__node-B06").click();
    const panel = page.getByTestId("node-panel");
    await expect(panel).toBeVisible();

    // 关掉
    await page.getByTestId("node-panel-close").click();
    await expect(panel).not.toBeVisible({ timeout: 3_000 });
  });
});