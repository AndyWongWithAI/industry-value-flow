// @ts-nocheck
/**
 * E2E 3/5 — 点击边弹出 EdgePanel,显示关系中文标签.
 *
 * v6:react-force-graph-2d 渲染边在 canvas 里,DOM 不可点。
 *   - 不再用 react-flow 的 rf__edge-{id} testid
 *   - 验证策略:走 NodePanel → 入/出边点击,触发 EdgePanel
 *     (NodePanel 内的入/出边 row 仍是真实 DOM,可以用 testid 点)
 *   - 或者:通过 dev 钩子 __simulateLinkClick(edgeId) 触发
 *
 * 这里用 dev 钩子路径(简单 + 不依赖 canvas 坐标)。
 */
import { test, expect, type Page } from "@playwright/test";

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
      id: "L72",
      label: "商务服务业",
      category: "L",
      description: "商务服务",
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
    {
      id: "D44-L72",
      source: "D44",
      target: "L72",
      relation_type: "supports",
      weight: 3,
      explanation: "电力为商务服务提供基础能源",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  generated_at: "2026-06-25T00:00:00Z",
  llm_config_hash: "e2e",
  schema_version: "v1",
};

const MOCK_STATS = { total: 5, generated: 5, failed: 0, pending: 0 };

async function mockGraphRoute(page: Page) {
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
}

test.describe("E2E 3/5: NodePanel → EdgePanel 联动", () => {
  test("打开 NodePanel → 点入边 → EdgePanel 出现 + 关系标签", async ({ page }) => {
    await mockGraphRoute(page);

    await page.goto("/");
    await expect(page.locator('[data-testid="graph-view"]')).toBeVisible({
      timeout: 10_000,
    });

    // 用 dev 钩子打开 D44 的 NodePanel
    await page.evaluate(() => {
      const w = window as unknown as {
        __simulateNodeClick?: (id: string) => void;
      };
      w.__simulateNodeClick?.("D44");
    });

    const panel = await page.waitForSelector('[data-testid="node-panel"]', {
      timeout: 5_000,
    });
    await expect(panel).toBeVisible();

    // 点入边(B06 → D44),触发 EdgePanel
    const inEdgeRow = page.getByTestId("node-panel-in-edge-B06");
    await inEdgeRow.click();
    const edgePanel = page.getByTestId("edge-panel");
    await expect(edgePanel).toBeVisible({ timeout: 5_000 });

    // 关系中文标签
    const relation = page.getByTestId("edge-panel-relation");
    await expect(relation).toHaveText("支撑");
  });

  test("EdgePanel 显示源节点和目标节点中文名", async ({ page }) => {
    await mockGraphRoute(page);

    await page.goto("/");
    await expect(page.locator('[data-testid="graph-view"]')).toBeVisible({
      timeout: 10_000,
    });

    // 打开 D44 NodePanel → 点入边 B06
    await page.evaluate(() => {
      const w = window as unknown as {
        __simulateNodeClick?: (id: string) => void;
      };
      w.__simulateNodeClick?.("D44");
    });
    await page.waitForSelector('[data-testid="node-panel"]');
    await page.getByTestId("node-panel-in-edge-B06").click();
    const panel = page.getByTestId("edge-panel");
    await expect(panel).toBeVisible();

    await expect(page.getByTestId("edge-panel-source")).toHaveText(
      "煤炭开采和洗选业",
    );
    await expect(page.getByTestId("edge-panel-target")).toContainText("电力");
  });
});