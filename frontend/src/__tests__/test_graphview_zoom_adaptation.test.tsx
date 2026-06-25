// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { ReactFlowProvider } from "reactflow";
import { GraphView } from "../components/GraphView";
import { GraphNode } from "../components/GraphNode";
import type { KnowledgeGraph } from "../types/api";

expect.extend(matchers);
beforeEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// react-flow v11 在 jsdom 里 viewport/size 测量的兜底
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

/** Mock graph:5 节点 + 4 边 */
const MOCK_GRAPH: KnowledgeGraph = {
  nodes: [
    { id: "A", label: "煤炭", category: "B", description: "煤炭", status: "generated", failed_reason: null, last_attempt_at: null },
    { id: "B", label: "电力", category: "D", description: "电力", status: "generated", failed_reason: null, last_attempt_at: null },
    { id: "C", label: "纺织", category: "C", description: "纺织", status: "generated", failed_reason: null, last_attempt_at: null },
    { id: "D", label: "化工", category: "C", description: "化工", status: "generated", failed_reason: null, last_attempt_at: null },
    { id: "E", label: "钢铁", category: "C", description: "钢铁", status: "generated", failed_reason: null, last_attempt_at: null },
  ],
  edges: [
    { source: "A", target: "B", relation_type: "supports", weight: 4, explanation: "煤炭是火电燃料", status: "generated", failed_reason: null, last_attempt_at: null },
    { source: "B", target: "C", relation_type: "supports", weight: 3, explanation: "纺织依赖电力", status: "generated", failed_reason: null, last_attempt_at: null },
    { source: "B", target: "D", relation_type: "supports", weight: 2, explanation: "化工依赖电力", status: "generated", failed_reason: null, last_attempt_at: null },
    { source: "D", target: "E", relation_type: "supports", weight: 5, explanation: "钢铁依赖化工", status: "generated", failed_reason: null, last_attempt_at: null },
  ],
  generated_at: "2026-06-25T00:00:00Z",
  llm_config_hash: "mock",
  schema_version: "v1",
};

// helper:用 cast 绕过 NodeProps 完整性检查(测试聚焦 zoom 行为,不关心其他 props)
function renderNode(zoom: number, label: string, category: "A" | "B" | "C" | "D") {
  const props = {
    id: "X",
    data: {
      label,
      category,
      description: "desc",
      status: "generated" as const,
      failed_reason: null,
      zoom,
      zoomLabelMin: 0.4,
      zoomFullMin: 0.8,
    },
    selected: false,
  };
  return render(
    <ReactFlowProvider>
      <GraphNode {...(props as unknown as Parameters<typeof GraphNode>[0])} />
    </ReactFlowProvider>
  );
}

/**
 * v5 缩放自适应单元测试(聚焦 GraphNode 渲染行为):
 *  - zoom=1.0(初始):data-zoom-level=full,显示 label + category
 *  - zoom=0.6:data-zoom-level=label,只显示 label(无 category)
 *  - zoom=0.3:data-zoom-level=dot,只显示 8px 色点(无文字)
 *  - zoom=1.5:data-zoom-level=full,完整
 *  - GraphView 渲染 5 个 react-flow 节点
 */
describe("GraphView v5 zoom adaptation", () => {
  it("initial zoom = 1.0: nodes show full level (label + category)", () => {
    const { container } = render(
      <ReactFlowProvider>
        <GraphView graph={MOCK_GRAPH} />
      </ReactFlowProvider>
    );
    expect(screen.getByTestId("graph-node-煤炭")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-电力")).toBeInTheDocument();
    // 节点带 data-zoom-level="full"(react-flow 默认 zoom=1)
    const nodeEl = screen.getByTestId("graph-node-煤炭");
    expect(nodeEl.getAttribute("data-zoom-level")).toBe("full");
    // 注:边 label 在 jsdom 里 EdgeLabelRenderer 不一定渲染,
    // 留给 e2e 视觉验证。
  });

  it("zoom=0.3: nodes render as color dots (data-zoom-level=dot), no labels", () => {
    renderNode(0.3, "煤炭", "B");
    const nodeEl = screen.getByTestId("graph-node-煤炭");
    expect(nodeEl.getAttribute("data-zoom-level")).toBe("dot");
    expect(nodeEl.textContent).toBe(""); // 无 label
  });

  it("zoom=0.6: nodes render at label-only level, no category line", () => {
    renderNode(0.6, "电力", "D");
    const nodeEl = screen.getByTestId("graph-node-电力");
    expect(nodeEl.getAttribute("data-zoom-level")).toBe("label");
    expect(nodeEl.textContent).toContain("电力");
    // label-only 模式不显示 category 单字母
    expect(nodeEl.textContent).not.toContain("D");
  });

  it("zoom=1.5: GraphNode shows full level (label + category letter)", () => {
    renderNode(1.5, "化工", "C");
    const nodeEl = screen.getByTestId("graph-node-化工");
    expect(nodeEl.getAttribute("data-zoom-level")).toBe("full");
    expect(nodeEl.textContent).toContain("化工");
    expect(nodeEl.textContent).toContain("C");
  });

  it("GraphView renders all 5 nodes as react-flow nodes", () => {
    const { container } = render(
      <ReactFlowProvider>
        <GraphView graph={MOCK_GRAPH} />
      </ReactFlowProvider>
    );
    const rfNodes = container.querySelectorAll(".react-flow__node");
    expect(rfNodes).toHaveLength(5);
  });
});