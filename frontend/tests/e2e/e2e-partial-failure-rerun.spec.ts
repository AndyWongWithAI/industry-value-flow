// @ts-nocheck
/**
 * E2E 5/5 — 部分失败场景 + 重跑流程.
 *
 * v6 适配:
 *   - 失败节点不再用 DOM border 表达(react-force-graph 渲染在 canvas),
 *     而是用 NodePanel 顶部红色失败条 + status-bar "失败 X" 计数
 *   - 验证:status bar 显示 失败 1 → 点重跑 → status bar 显示 失败 0
 *   - 失败节点打开 NodePanel,显示红色 banner
 *
 * 关键策略:
 *   - 第一次 GET /api/graph 返回 INITIAL(1 failed)
 *   - POST regenerate-failed 后,GET 返回 AFTER_RERUN(0 failed)
 */
import { test, expect } from "@playwright/test";

const INITIAL_GRAPH = {
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
    {
      id: "C26",
      label: "化学原料和化学制品制造业",
      category: "C",
      description: "基础化学原料和化学制品的生产",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      id: "L72",
      label: "商务服务业",
      category: "L",
      description: "商务服务",
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
};

const INITIAL_STATS = { total: 6, generated: 5, failed: 1, pending: 0 };

const AFTER_RERUN_GRAPH = {
  nodes: [
    ...INITIAL_GRAPH.nodes.slice(0, 4).map((n) => ({ ...n })),
    {
      ...INITIAL_GRAPH.nodes[4],
      status: "generated",
      failed_reason: null,
    },
  ],
  edges: INITIAL_GRAPH.edges,
};

const AFTER_RERUN_STATS = { total: 6, generated: 6, failed: 0, pending: 0 };

test.describe("E2E 5/5: partial failure → rerun", () => {
  test("初始 5/6 已生成 + 1 failed,状态条显示失败计数", async ({ page }) => {
    await page.route("**/api/graph", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            nodes: INITIAL_GRAPH.nodes,
            edges: INITIAL_GRAPH.edges,
            stats: INITIAL_STATS,
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

    // 状态条 stats 显示:已生成 5 / 6,失败 1
    const stats = page.getByTestId("status-bar-stats");
    await expect(stats).toContainText("5");
    await expect(stats).toContainText("6");
    await expect(stats).toContainText("失败");
    await expect(stats).toContainText("1");
  });

  test("点击失败节点 → NodePanel 顶部出现红色失败条", async ({ page }) => {
    await page.route("**/api/graph", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            nodes: INITIAL_GRAPH.nodes,
            edges: INITIAL_GRAPH.edges,
            stats: INITIAL_STATS,
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

    // 用 dev 钩子打开失败节点 L72 的 NodePanel
    await page.evaluate(() => {
      const w = window as unknown as {
        __simulateNodeClick?: (id: string) => void;
      };
      w.__simulateNodeClick?.("L72");
    });

    const panel = page.getByTestId("node-panel");
    await expect(panel).toBeVisible({ timeout: 5_000 });
    const banner = page.getByTestId("node-panel-failed-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("未生成");
  });

  test("点重跑 → POST regenerate-failed(scope=all) → 状态条更新", async ({
    page,
  }) => {
    let hasReran = false;
    let postBody: string | null = null;

    await page.route("**/api/graph**", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.url().includes("regenerate-failed")) {
        postBody = req.postData();
        hasReran = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ job_id: "rerun-001" }),
        });
        return;
      }
      if (req.method() === "GET") {
        const body = hasReran
          ? {
              nodes: AFTER_RERUN_GRAPH.nodes,
              edges: AFTER_RERUN_GRAPH.edges,
              stats: AFTER_RERUN_STATS,
            }
          : {
              nodes: INITIAL_GRAPH.nodes,
              edges: INITIAL_GRAPH.edges,
              stats: INITIAL_STATS,
            };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/");
    await expect(page.locator('[data-testid="graph-view"]')).toBeVisible({
      timeout: 10_000,
    });

    // 验证初始:状态条显示失败 1
    const stats = page.getByTestId("status-bar-stats");
    await expect(stats).toContainText("失败");
    await expect(stats).toContainText("1");

    // 点"重跑失败部分"
    const rerunBtn = page.getByTestId("status-bar-rerun");
    await expect(rerunBtn).toBeVisible();
    await expect(rerunBtn).toHaveText("重跑失败部分");
    await rerunBtn.click();

    // 等待状态条更新:已生成 6 / 6,失败 0
    await expect(stats).toContainText("6", { timeout: 5_000 });
    await expect(stats).toContainText("0");

    // POST body 应是 {scope:"all"}
    expect(postBody).toBeTruthy();
    const parsed = JSON.parse(postBody!);
    expect(parsed.scope).toBe("all");
  });
});