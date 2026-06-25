// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { GraphView } from "../components/GraphView";
import type { KnowledgeGraph, GraphNode, GraphEdge } from "../types/api";

expect.extend(matchers);
beforeEach(() => {
  cleanup();
});

// react-flow v11 使用 ResizeObserver 和 Element.getBoundingClientRect,jsdom 不全支持
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
// getBoundingClientRect 兜底(react-flow 用它测 viewport)
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

const MOCK_GRAPH: KnowledgeGraph = {
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
      source: "D44",
      target: "C17",
      relation_type: "supports",
      weight: 3,
      explanation: "纺织业生产高度依赖电力供应",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  generated_at: "2026-06-25T00:00:00Z",
  llm_config_hash: "mock",
  schema_version: "v1",
};

describe("GraphView", () => {
  it("renders 3 nodes from mock graph (by label)", () => {
    render(<GraphView graph={MOCK_GRAPH} />);
    // 用 data-testid 精确锁定(避开 "B"/"C"/"D" 在多处出现)
    expect(screen.getByTestId("graph-node-煤炭开采和洗选业")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-电力、热力生产和供应业")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-纺织业")).toBeInTheDocument();
  });

  it("renders react-flow container with all 3 rf__node elements", () => {
    const { container } = render(<GraphView graph={MOCK_GRAPH} />);
    const rfNodes = container.querySelectorAll(".react-flow__node");
    expect(rfNodes).toHaveLength(3);
  });

  it("invokes onNodeClick with original GraphNode when a node is clicked", () => {
    const onNodeClick = vi.fn();
    render(<GraphView graph={MOCK_GRAPH} onNodeClick={onNodeClick} />);
    // react-flow 的节点容器带 data-id 属性(B06)
    const rfNode = screen.getByTestId("rf__node-B06");
    fireEvent.click(rfNode);
    expect(onNodeClick).toHaveBeenCalled();
    const called = onNodeClick.mock.calls[0][0] as GraphNode;
    expect(called.id).toBe("B06");
    expect(called.label).toBe("煤炭开采和洗选业");
  });

  it("renders a failed node with red border styling (failed_reason in tooltip)", () => {
    const graph: KnowledgeGraph = {
      ...MOCK_GRAPH,
      nodes: [
        { ...MOCK_GRAPH.nodes[0], status: "failed", failed_reason: "LLM 超时" },
        MOCK_GRAPH.nodes[1],
        MOCK_GRAPH.nodes[2],
      ],
    };
    render(<GraphView graph={graph} />);
    // 失败节点:title 应当包含 "生成失败" + failed_reason
    const failedNode = screen.getByTestId("graph-node-煤炭开采和洗选业");
    expect(failedNode.getAttribute("title")).toContain("生成失败");
    expect(failedNode.getAttribute("title")).toContain("LLM 超时");
  });
});
