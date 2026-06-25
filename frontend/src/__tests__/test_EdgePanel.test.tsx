// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { EdgePanel } from "../components/EdgePanel";
import type { GraphEdge, GraphNode } from "../types/api";

expect.extend(matchers);
afterEach(() => cleanup());

const sourceNode: GraphNode = {
  id: "B06",
  label: "煤炭开采和洗选业",
  category: "B",
  description: "煤炭的开采、洗选与初步加工",
  status: "generated",
  failed_reason: null,
  last_attempt_at: null,
};

const targetNode: GraphNode = {
  id: "D44",
  label: "电力、热力生产和供应业",
  category: "D",
  description: "电力与热力的生产、输送与供应",
  status: "generated",
  failed_reason: null,
  last_attempt_at: null,
};

const baseEdge: GraphEdge = {
  source: "B06",
  target: "D44",
  relation_type: "supports",
  weight: 4,
  explanation: "煤炭是火力发电的主要燃料",
  status: "generated",
  failed_reason: null,
  last_attempt_at: null,
};

describe("EdgePanel", () => {
  it("renders source + target node labels with arrow", () => {
    render(
      <EdgePanel
        edge={baseEdge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        onClose={() => {}}
        onReExplain={() => {}}
        reExplaining={false}
      />
    );
    expect(screen.getByTestId("edge-panel-source")).toHaveTextContent("煤炭开采和洗选业");
    expect(screen.getByTestId("edge-panel-target")).toHaveTextContent("电力");
    expect(screen.getByTestId("edge-panel-nodes").textContent).toContain("→");
  });

  it("renders chinese relation label", () => {
    render(
      <EdgePanel
        edge={baseEdge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        onClose={() => {}}
        onReExplain={() => {}}
        reExplaining={false}
      />
    );
    expect(screen.getByTestId("edge-panel-relation")).toHaveTextContent("支撑");
  });

  it("renders weight as dot indicator (●●●○○ for 4)", () => {
    render(
      <EdgePanel
        edge={baseEdge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        onClose={() => {}}
        onReExplain={() => {}}
        reExplaining={false}
      />
    );
    expect(screen.getByTestId("edge-panel-weight")).toHaveTextContent("●●●●○");
  });

  it("renders explanation text for generated edges", () => {
    render(
      <EdgePanel
        edge={baseEdge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        onClose={() => {}}
        onReExplain={() => {}}
        reExplaining={false}
      />
    );
    expect(screen.getByTestId("edge-panel-explanation")).toHaveTextContent(
      "煤炭是火力发电"
    );
  });

  it("shows loading state for pending edges", () => {
    const pendingEdge: GraphEdge = { ...baseEdge, status: "pending", explanation: "" };
    render(
      <EdgePanel
        edge={pendingEdge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        onClose={() => {}}
        onReExplain={() => {}}
        reExplaining={false}
      />
    );
    expect(screen.getByTestId("edge-panel-explanation-loading")).toBeInTheDocument();
    expect(screen.getByTestId("edge-panel-status")).toHaveTextContent("生成中");
  });

  it("shows failed state with reason for failed edges", () => {
    const failedEdge: GraphEdge = {
      ...baseEdge,
      status: "failed",
      failed_reason: "模型返回 502",
    };
    render(
      <EdgePanel
        edge={failedEdge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        onClose={() => {}}
        onReExplain={() => {}}
        reExplaining={false}
      />
    );
    expect(screen.getByTestId("edge-panel-explanation-failed")).toBeInTheDocument();
    expect(screen.getByText("模型返回 502")).toBeInTheDocument();
    expect(screen.getByTestId("edge-panel-status")).toHaveTextContent("生成失败");
  });

  it("invokes onClose when × clicked", () => {
    const onClose = vi.fn();
    render(
      <EdgePanel
        edge={baseEdge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        onClose={onClose}
        onReExplain={() => {}}
        reExplaining={false}
      />
    );
    fireEvent.click(screen.getByTestId("edge-panel-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onReExplain when re-explain button clicked", () => {
    const onReExplain = vi.fn();
    render(
      <EdgePanel
        edge={baseEdge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        onClose={() => {}}
        onReExplain={onReExplain}
        reExplaining={false}
      />
    );
    fireEvent.click(screen.getByTestId("edge-panel-reexplain"));
    expect(onReExplain).toHaveBeenCalledTimes(1);
  });

  it("disables re-explain button when reExplaining", () => {
    render(
      <EdgePanel
        edge={baseEdge}
        sourceNode={sourceNode}
        targetNode={targetNode}
        onClose={() => {}}
        onReExplain={() => {}}
        reExplaining={true}
      />
    );
    const btn = screen.getByTestId("edge-panel-reexplain");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("重新解释中...");
  });

  it("falls back to edge ids when node lookup fails", () => {
    render(
      <EdgePanel
        edge={baseEdge}
        sourceNode={null}
        targetNode={null}
        onClose={() => {}}
        onReExplain={() => {}}
        reExplaining={false}
      />
    );
    expect(screen.getByTestId("edge-panel-source")).toHaveTextContent("B06");
    expect(screen.getByTestId("edge-panel-target")).toHaveTextContent("D44");
  });
});
