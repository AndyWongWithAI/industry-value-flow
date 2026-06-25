// @ts-nocheck
/**
 * E2E 1/5 — 知识图谱渲染基本链路.
 *
 * 验证:用户访问 / → react-flow 画布加载 → 至少看到 1 个节点.
 *
 * 关键策略:
 *   - 用 page.route 拦截 GET /api/graph,返回 mock graph
 *   - 验证 page.locator('[data-testid^="graph-node-"]') 至少 1 个
 *   - 验证 react-flow 的 .react-flow 容器出现
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
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      id: "C17",
      label: "纺织业",
      category: "C",
      description: "纺织纤维的加工与织造",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  edges: [
    {
      id: "B06-D44",
      source: "B06",
      target: "D44",
      relation_type: "provide",
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

const MOCK_STATS = { total: 4, generated: 4, failed: 0, pending: 0 };

test.describe("E2E 1/5: graph renders with at least one node", () => {
  test("访问 / → react-flow 加载 → 至少 1 个节点出现", async ({ page }) => {
    // 拦截 /api/graph 返回 mock
    await page.route("**/api/graph", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            nodes: MOCK_GRAPH.nodes,
            edges: MOCK_GRAPH.edges,
            stats: MOCK_STATS,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");

    // react-flow 容器
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    // 至少 1 个 graph-node-{label}
    const nodes = page.locator('[data-testid^="graph-node-"]');
    await expect(nodes.first()).toBeVisible({ timeout: 5_000 });
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 状态条出现
    await expect(page.getByTestId("status-bar")).toBeVisible();
  });

  test("Mock 至少 3 个节点都能渲染出来", async ({ page }) => {
    await page.route("**/api/graph", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            nodes: MOCK_GRAPH.nodes,
            edges: MOCK_GRAPH.edges,
            stats: MOCK_STATS,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    // 三个节点都应该出现
    await expect(
      page.locator('[data-testid="graph-node-煤炭开采和洗选业"]')
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-testid="graph-node-电力、热力生产和供应业"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="graph-node-纺织业"]')
    ).toBeVisible();
  });
});