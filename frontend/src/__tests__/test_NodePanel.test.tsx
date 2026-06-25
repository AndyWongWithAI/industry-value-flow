// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { NodePanel, renderWeight } from "../components/NodePanel";
import type { GraphNode, KnowledgeGraph } from "../types/api";

expect.extend(matchers);
afterEach(() => cleanup());

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

const graph: KnowledgeGraph = {
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
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      source: "B06",
      target: "C17",
      relation_type: "rely_on",
      weight: 2,
      explanation: "采矿业依赖纺织业提供的工业用布",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  generated_at: "2026-06-25T00:00:00Z",
  llm_config_hash: "mock",
  schema_version: "v1",
};

describe("NodePanel", () => {
  it("renders node label, id, category, description", () => {
    const target: GraphNode = graph.nodes[0]; // B06
    render(<NodePanel node={target} graph={graph} onClose={() => {}} />);
    expect(screen.getByText("煤炭开采和洗选业")).toBeInTheDocument();
    expect(screen.getByText("B06")).toBeInTheDocument();
    expect(screen.getByTestId("node-panel-category")).toHaveTextContent("B");
    expect(screen.getByText(/煤炭的开采/)).toBeInTheDocument();
  });

  it("shows generated status with success color label", () => {
    render(<NodePanel node={graph.nodes[0]} graph={graph} onClose={() => {}} />);
    const status = screen.getByTestId("node-panel-status");
    expect(status).toHaveTextContent("已生成");
  });

  it("shows in-edges and out-edges counts correctly for middle node", () => {
    // D44: in=B06, out=C17 → 1 in, 1 out
    render(<NodePanel node={graph.nodes[1]} graph={graph} onClose={() => {}} />);
    expect(screen.getByTestId("node-panel-in-edge-B06")).toBeInTheDocument();
    expect(screen.getByTestId("node-panel-out-edge-C17")).toBeInTheDocument();
  });

  it("shows red failed banner and failed reason when status=failed", () => {
    const failedNode: GraphNode = {
      ...graph.nodes[0],
      status: "failed",
      failed_reason: "LLM 超时(30s)",
    };
    render(<NodePanel node={failedNode} graph={graph} onClose={() => {}} />);
    expect(screen.getByTestId("node-panel-failed-banner")).toBeInTheDocument();
    expect(screen.getByTestId("node-panel-failed-banner")).toHaveTextContent(
      "重跑"
    );
    expect(screen.getByTestId("node-panel-status")).toHaveTextContent("生成失败");
    expect(screen.getByText("LLM 超时(30s)")).toBeInTheDocument();
  });

  it("invokes onClose when × button clicked", () => {
    const onClose = vi.fn();
    render(<NodePanel node={graph.nodes[0]} graph={graph} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("node-panel-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onEdgeClick when an in-edge row is clicked", () => {
    const onEdgeClick = vi.fn();
    render(
      <NodePanel
        node={graph.nodes[1]}
        graph={graph}
        onClose={() => {}}
        onEdgeClick={onEdgeClick}
      />
    );
    fireEvent.click(screen.getByTestId("node-panel-in-edge-B06"));
    expect(onEdgeClick).toHaveBeenCalled();
    const called = onEdgeClick.mock.calls[0][0];
    expect(called.source).toBe("B06");
    expect(called.target).toBe("D44");
  });

  it("shows '无入边/无出边' for isolated node", () => {
    const isolated: GraphNode = {
      id: "X99",
      label: "孤立节点",
      category: "T",
      description: "无连接",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    };
    const isolatedGraph: KnowledgeGraph = {
      ...graph,
      nodes: [...graph.nodes, isolated],
    };
    render(<NodePanel node={isolated} graph={isolatedGraph} onClose={() => {}} />);
    expect(screen.getByText("无入边")).toBeInTheDocument();
    expect(screen.getByText("无出边")).toBeInTheDocument();
  });

  it("renders chinese relation tooltip on edge row hover", () => {
    render(<NodePanel node={graph.nodes[1]} graph={graph} onClose={() => {}} />);
    const row = screen.getByTestId("node-panel-in-edge-B06");
    fireEvent.mouseEnter(row.querySelector("[data-testid=tooltip-trigger]")!);
    // Tooltip content should appear with the explanation
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
  });
});

describe("renderWeight helper", () => {
  it("renders 1-5 dot for valid weight", () => {
    expect(renderWeight(1)).toBe("●○○○○");
    expect(renderWeight(3)).toBe("●●●○○");
    expect(renderWeight(5)).toBe("●●●●●");
  });
  it("clamps out-of-range weights", () => {
    expect(renderWeight(0)).toBe("○○○○○");
    expect(renderWeight(7)).toBe("●●●●●");
  });
});
