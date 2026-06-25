// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";
import { GraphPage } from "../pages/GraphPage";
import {
  LLMUnavailableError,
  type ApiGetGraphFn,
  type ApiRegenerateFailedFn,
  type ApiReExplainEdgeFn,
} from "../lib/api-helpers";
import type { KnowledgeGraph } from "../types/api";

expect.extend(matchers);

// react-flow v11 需要 ResizeObserver / getBoundingClientRect
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;
if (!Element.prototype.getBoundingClientRect) {
  Element.prototype.getBoundingClientRect = function () {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
}

const GRAPH: KnowledgeGraph = {
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
      failed_reason: "LLM 503",
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
      source: "D44",
      target: "C17",
      relation_type: "service",
      weight: 3,
      explanation: "纺织业生产高度依赖电力供应",
      status: "failed",
      failed_reason: "模型超时",
      last_attempt_at: null,
    },
  ],
  generated_at: "2026-06-25T00:00:00Z",
  llm_config_hash: "test",
  schema_version: "v1",
};

beforeEach(() => {
  cleanup();
});

describe("GraphPage 集成", () => {
  it("加载成功后渲染 StatusBar + GraphView(节点/边)", async () => {
    const getGraph = vi.fn<ApiGetGraphFn>(async () => GRAPH);
    render(
      <MemoryRouter>
        <GraphPage api={{ getGraph }} />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByTestId("graph-page-loading")).not.toBeInTheDocument();
    });
    // StatusBar 出现,统计正确
    const stats = await screen.findByTestId("status-bar-stats");
    expect(stats).toHaveTextContent("已生成");
    expect(stats.textContent).toMatch(/2/);
    // 节点 3 渲染
    expect(screen.getByTestId("graph-node-煤炭开采和洗选业")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-电力、热力生产和供应业")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-纺织业")).toBeInTheDocument();
  });

  it("LLM 不可用时,只渲染 EmptyState(不渲染 StatusBar / GraphView)", async () => {
    const getGraph = vi.fn<ApiGetGraphFn>(async () => {
      throw new LLMUnavailableError("未配置 LLM");
    });
    render(
      <MemoryRouter>
        <GraphPage api={{ getGraph }} />
      </MemoryRouter>
    );
    const empty = await screen.findByTestId("empty-state");
    expect(empty).toBeInTheDocument();
    expect(screen.queryByTestId("status-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("graph-view")).not.toBeInTheDocument();
    // EmptyState 包含"前往设置"链接
    expect(screen.getByTestId("empty-state-action")).toHaveAttribute("href", "/settings");
  });

  it("普通错误也走 EmptyState(显示 reason)", async () => {
    const getGraph = vi.fn<ApiGetGraphFn>(async () => {
      throw new Error("500 server boom");
    });
    render(
      <MemoryRouter>
        <GraphPage api={{ getGraph }} />
      </MemoryRouter>
    );
    const empty = await screen.findByTestId("empty-state");
    expect(empty).toHaveTextContent("加载失败");
    expect(screen.getByTestId("empty-state-reason")).toHaveTextContent("500 server boom");
  });

  it("点击节点 → 右侧 NodePanel 出现;× → 关闭", async () => {
    const getGraph = vi.fn<ApiGetGraphFn>(async () => GRAPH);
    render(
      <MemoryRouter>
        <GraphPage api={{ getGraph }} />
      </MemoryRouter>
    );
    await screen.findByTestId("graph-node-煤炭开采和洗选业");
    // 通过 react-flow 自带 data-testid rf__node-<id> 触发点击
    const rfNode = screen.getByTestId("rf__node-B06");
    fireEvent.click(rfNode);
    const panel = await screen.findByTestId("node-panel");
    expect(panel).toHaveTextContent("煤炭开采和洗选业");
    // 关闭
    fireEvent.click(screen.getByTestId("node-panel-close"));
    expect(screen.queryByTestId("node-panel")).not.toBeInTheDocument();
  });

  it("点击失败节点 → NodePanel 顶部出现红色失败条", async () => {
    const getGraph = vi.fn<ApiGetGraphFn>(async () => GRAPH);
    render(
      <MemoryRouter>
        <GraphPage api={{ getGraph }} />
      </MemoryRouter>
    );
    await screen.findByTestId("graph-node-电力、热力生产和供应业");
    fireEvent.click(screen.getByTestId("rf__node-D44"));
    const panel = await screen.findByTestId("node-panel");
    const banner = screen.getByTestId("node-panel-failed-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("重跑");
    expect(panel).toHaveTextContent("LLM 503");
  });

  it("StatusBar 重跑按钮点击 → 触发 regenerate + 重新拉取 graph", async () => {
    const getGraph = vi
      .fn<ApiGetGraphFn>()
      .mockResolvedValueOnce(GRAPH)
      .mockResolvedValueOnce({ ...GRAPH, generated_at: "reran" });
    const regenerateFailed = vi.fn<ApiRegenerateFailedFn>(async () => ({
      job_id: "j1",
    }));
    render(
      <MemoryRouter>
        <GraphPage api={{ getGraph, regenerateFailed }} />
      </MemoryRouter>
    );
    const rerunBtn = await screen.findByTestId("status-bar-rerun");
    fireEvent.click(rerunBtn);
    await waitFor(() => {
      expect(regenerateFailed).toHaveBeenCalled();
    });
    // 第二次拉图被调用
    expect(getGraph).toHaveBeenCalledTimes(2);
  });

  it("NodePanel 入边点击 → EdgePanel 出现 + 重新解释按钮触发 API", async () => {
    // 走 NodePanel 内部 onEdgeClick 路径,绕开 react-flow jsdom 边点击限制
    const getGraph = vi.fn<ApiGetGraphFn>(async () => GRAPH);
    const reExplainEdge = vi.fn<ApiReExplainEdgeFn>(async () => ({
      explanation: "新解释",
    }));
    render(
      <MemoryRouter>
        <GraphPage api={{ getGraph, reExplainEdge }} />
      </MemoryRouter>
    );
    await screen.findByTestId("graph-node-电力、热力生产和供应业");
    // 先打开 NodePanel (D44)
    fireEvent.click(screen.getByTestId("rf__node-D44"));
    await screen.findByTestId("node-panel");
    // 找 NodePanel 内的入边行 — D44 有 1 个入边 B06
    const inEdgeRow = screen.getByTestId("node-panel-in-edge-B06");
    fireEvent.click(inEdgeRow);
    // 现在应该切到 EdgePanel
    const edgePanel = await screen.findByTestId("edge-panel");
    expect(edgePanel).toBeInTheDocument();
    // 重新解释按钮
    fireEvent.click(screen.getByTestId("edge-panel-reexplain"));
    await waitFor(() => {
      expect(reExplainEdge).toHaveBeenCalled();
    });
  });
});
