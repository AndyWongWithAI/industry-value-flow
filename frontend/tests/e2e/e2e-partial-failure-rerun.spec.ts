// @ts-nocheck
/**
 * E2E 5/5 — 部分失败场景 + 重跑流程.
 *
 * 验证:
 *   - 初始:3 generated + 2 failed + 1 edge,状态条 "已生成 4 / 5, 失败 1"
 *   - 失败节点红色边框(GraphNode FAILED_BORDER_COLOR = #DC2626)
 *   - 点"重跑失败部分" → POST /api/graph/regenerate-failed body={scope:"all"}
 *   - 重跑后:状态条 "已生成 5 / 5, 失败 0",红色边框消失
 *
 * 关键策略:
 *   - 第一次 page.route /api/graph 返回 4 generated + 1 failed
 *   - 第二次(POST regenerate-failed 后)返回 5 generated + 0 failed
 *   - 用 page.route 不同 method 区分 GET / POST
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
  test("初始 4/5 已生成 + 1 failed,状态条显示失败计数", async ({ page }) => {
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
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    // 状态条 stats 显示:已生成 5 / 6,失败 1 (5 nodes + 1 edge = 6 entities,
    // 5 generated,1 failed)
    const stats = page.getByTestId("status-bar-stats");
    await expect(stats).toContainText("5");
    await expect(stats).toContainText("6");
    await expect(stats).toContainText("失败");
    await expect(stats).toContainText("1");
  });

  test("失败节点用红色边框", async ({ page }) => {
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
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    // L72 是 failed 节点
    const failedNode = page.locator('[data-testid="graph-node-商务服务业"]');
    await expect(failedNode).toBeVisible({ timeout: 5_000 });
    const borderColor = await failedNode.evaluate(
      (el) => getComputedStyle(el).borderTopColor
    );
    // FAILED_BORDER_COLOR = #DC2626 → rgb(220, 38, 38)
    expect(borderColor).toBe("rgb(220, 38, 38)");

    // 生成成功节点(B06)用蓝色边框,不是红色
    const okNode = page.locator('[data-testid="graph-node-煤炭开采和洗选业"]');
    await expect(okNode).toBeVisible();
    const okBorderColor = await okNode.evaluate(
      (el) => getComputedStyle(el).borderTopColor
    );
    expect(okBorderColor).not.toBe("rgb(220, 38, 38)");
  });

  test("点重跑 → POST regenerate-failed(scope=all) → 状态条更新 + 红色边框消失", async ({
    page,
  }) => {
    // React 18 StrictMode 会触发 useEffect 两次(挂载/卸载/挂载),所以
    // page.route 在第一次 GET 时可能收到多次调用 — 不能用 count 切,
    // 改用 "POST 触发后" 切换。
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
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 10_000 });

    // 验证初始:状态条显示失败 1
    const stats = page.getByTestId("status-bar-stats");
    await expect(stats).toContainText("失败");
    await expect(stats).toContainText("1");

    // 点"重跑失败部分"
    const rerunBtn = page.getByTestId("status-bar-rerun");
    await expect(rerunBtn).toBeVisible();
    await expect(rerunBtn).toHaveText("重跑失败部分");
    await rerunBtn.click();

    // 等待状态条更新:已生成 6 / 6,失败 0 (5 nodes + 1 edge = 6 entities)
    await expect(stats).toContainText("6", { timeout: 5_000 });
    // failed=0 时,组件仍然渲染"失败 0"(用 tertiary 色)
    await expect(stats).toContainText("0");

    // POST body 应是 {scope:"all"}
    expect(postBody).toBeTruthy();
    const parsed = JSON.parse(postBody!);
    expect(parsed.scope).toBe("all");

    // 失败节点(L72)的红色边框应消失
    const failedNode = page.locator('[data-testid="graph-node-商务服务业"]');
    await expect(failedNode).toBeVisible();
    const borderColor = await failedNode.evaluate(
      (el) => getComputedStyle(el).borderTopColor
    );
    expect(borderColor).not.toBe("rgb(220, 38, 38)");
  });
});