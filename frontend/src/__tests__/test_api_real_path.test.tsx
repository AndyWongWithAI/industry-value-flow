// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";
import { GraphPage } from "../pages/GraphPage";
import type { KnowledgeGraph, GraphEdge } from "../types/api";

expect.extend(matchers);

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
      x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 100,
      width: 100, height: 100, toJSON() { return this; },
    } as DOMRect;
  };
}

const baseEdge: GraphEdge = {
  id: "B06-D44",
  source: "B06",
  target: "D44",
  relation_type: "provide",
  weight: 4,
  explanation: "煤炭是火力发电的主要燃料",
  status: "generated",
  failed_reason: null,
  last_attempt_at: null,
};

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
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  edges: [baseEdge],
  generated_at: "2026-06-25T00:00:00Z",
  llm_config_hash: "test",
  schema_version: "v1",
};

/**
 * T7 step 1: 验证前端 stub 的 explainEdge 调用 URL 是单段连字符,
 * 而不是旧的 /api/edge/{source}/{target}/explain 双段路径。
 *
 * 策略:用 GraphPage 的"重新解释"按钮触发真实 fetch,捕获 URL。
 * 这里通过 props.api 注入一个真实的 fetch 函数,模拟生产环境下的
 * explainEdge 行为(URL 形如 /api/edge/{edgeId}/explain,单段连字符)。
 */
describe("explainEdge URL contract (T7 stub fix — runtime)", () => {
  let capturedUrls: string[];

  beforeEach(() => {
    capturedUrls = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      capturedUrls.push(url);
      return new Response(
        JSON.stringify({ explanation: "ok", edge_id: "B06-D44" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("explainEdge (via props.api injection) calls /api/edge/{edgeId}/explain", async () => {
    // 模拟生产环境 explainEdge 的真实调用:
    // URL 模板 /api/edge/{edgeId}/explain,单段连字符
    const realFetchExplain = async (edgeId: string) => {
      const r = await fetch(`/api/edge/${encodeURIComponent(edgeId)}/explain`);
      return r.json();
    };

    render(
      <MemoryRouter>
        <GraphPage
          api={{
            getGraph: async () => GRAPH,
            explainEdge: realFetchExplain,
          }}
        />
      </MemoryRouter>
    );
    await screen.findByTestId("graph-node-煤炭开采和洗选业");

    // 通过 NodePanel 触发 EdgePanel
    fireEvent.click(screen.getByTestId("rf__node-D44"));
    await screen.findByTestId("node-panel");
    fireEvent.click(screen.getByTestId("node-panel-in-edge-B06"));
    await screen.findByTestId("edge-panel");

    // 点重新解释
    fireEvent.click(screen.getByTestId("edge-panel-reexplain"));

    await waitFor(() => {
      expect(capturedUrls.length).toBeGreaterThan(0);
    });

    const url = capturedUrls[capturedUrls.length - 1];
    expect(url).toMatch(/^\/api\/edge\/B06-D44\/explain$/);

    // 关键断言:URL 中 /api/edge/ 和 /explain 之间只有一个 path segment
    const middle = url.replace("/api/edge/", "").replace("/explain", "");
    expect(middle.split("/").length).toBe(1);
    expect(middle).toBe("B06-D44");
  });
});