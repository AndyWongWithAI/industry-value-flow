// @ts-nocheck
/**
 * E2E 3/5 — 点击边弹出 EdgePanel,显示关系中文标签.
 *
 * 验证:
 *   - 点击 react-flow 边 → EdgePanel 出现
 *   - EdgePanel 显示关系中文标签(支撑/依赖/服务/消费)
 *   - EdgePanel 显示源/目标节点名
 *
 * 关键策略:
 *   - react-flow 给边分配的 testid: rf__edge-{source}->{target}-{idx}
 *   - 因为 testid 包含 '>' (CSS 选择器特殊字符),
 *     getByTestId 不工作,要用 page.locator('[data-testid="..."]') 的形式
 *   - 点击 edge group 内的 path(.react-flow__edge-path)触发 react-flow onEdgeClick
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
      relation_type: "provide",
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
      relation_type: "service",
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

/** 点击 react-flow 边的辅助函数:
 *  react-flow 给 edge group 分配 testid "rf__edge-{id}",但 id 含 '>' 特殊字符。
 *  getByTestId 内部对特殊字符处理不一致,所以用 page.locator + css attr selector,
 *  再 click 其内的 .react-flow__edge-path (react-flow 的 click 监听 target)。
 */
async function clickEdge(page: any, edgeId: string) {
  const edge = page.locator(`[data-testid="rf__edge-${edgeId}"]`);
  const path = edge.locator(".react-flow__edge-path").first();
  await path.click({ force: true });
}

test.describe("E2E 3/5: click edge → EdgePanel with chinese relation label", () => {
  test("点击边 → EdgePanel 出现,显示'支撑'关系标签", async ({ page }) => {
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

    // B06 → D44 (provide)
    await clickEdge(page, "B06->D44-0");

    const panel = page.getByTestId("edge-panel");
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // 关系中文标签: "支撑" (对应 provide)
    const relation = page.getByTestId("edge-panel-relation");
    await expect(relation).toBeVisible();
    await expect(relation).toHaveText("支撑");
  });

  test("点击 service 边 → 显示'服务'中文标签", async ({ page }) => {
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

    // D44 → L72 (service)
    await clickEdge(page, "D44->L72-1");

    const panel = page.getByTestId("edge-panel");
    await expect(panel).toBeVisible();

    const relation = page.getByTestId("edge-panel-relation");
    await expect(relation).toHaveText("服务");
  });

  test("EdgePanel 显示源节点和目标节点中文名", async ({ page }) => {
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

    await clickEdge(page, "B06->D44-0");
    const panel = page.getByTestId("edge-panel");
    await expect(panel).toBeVisible();

    // 源节点 (B06 = 煤炭开采和洗选业)
    await expect(page.getByTestId("edge-panel-source")).toHaveText(
      "煤炭开采和洗选业"
    );
    // 目标节点 (D44 = 电力)
    await expect(page.getByTestId("edge-panel-target")).toContainText("电力");
  });
});