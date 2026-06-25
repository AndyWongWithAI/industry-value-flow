// @ts-nocheck
/**
 * E2E 1/5 — 知识图谱渲染基本链路.
 *
 * v6:react-flow → react-force-graph-2d
 *   - react-force-graph-2d 用 <canvas> 渲染,没有 .react-flow 容器
 *   - 也没有 [data-testid="graph-node-{label}"] DOM 节点
 *   - 验证策略:canvas 出现 + data-testid="graph-view" 容器出现
 *   - 不依赖具体节点位置(物理 simulation 随机)
 *   - 节点 hover 由 react-force-graph 自带 nodeLabel 控制
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

const MOCK_STATS = { total: 4, generated: 4, failed: 0, pending: 0 };

test.describe("E2E 1/5: graph renders with canvas", () => {
  test("访问 / → ForceGraph canvas 加载 → graph-view 容器出现", async ({ page }) => {
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

    // ForceGraph 容器(来自 ForceGraph.tsx 包装 div)
    await expect(page.locator('[data-testid="graph-view"]')).toBeVisible({
      timeout: 10_000,
    });

    // canvas 元素出现(react-force-graph-2d 渲染)
    const canvas = page.locator('[data-testid="graph-view"] canvas');
    await expect(canvas).toBeVisible({ timeout: 5_000 });
    // canvas 应有非零大小
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }

    // 状态条出现
    await expect(page.getByTestId("status-bar")).toBeVisible();
  });

  test("无 graph-node-{label} DOM 节点(canvas 渲染,验证 v6 行为)", async ({
    page,
  }) => {
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
    await expect(page.locator('[data-testid="graph-view"]')).toBeVisible({
      timeout: 10_000,
    });

    // v6 没有 graph-node-{label} DOM 节点 — 这是关键 contract。
    // 节点渲染完全在 canvas 里,无法用 DOM selector 拿。
    const domNodes = page.locator('[data-testid^="graph-node-"]');
    expect(await domNodes.count()).toBe(0);
  });
});