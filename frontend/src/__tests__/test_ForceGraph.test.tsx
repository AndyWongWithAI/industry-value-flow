// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import type { GraphNode, GraphEdge } from "../types/api";

expect.extend(matchers);
beforeEach(() => {
  cleanup();
});

/**
 * v6:ForceGraph tests(react-force-graph-2d 包装组件)
 *
 * 关键策略:
 *  - react-force-graph-2d 在 jsdom 里:
 *    1. canvas getContext('2d') → null(jsdom 无真实 2d context)
 *    2. d3-zoom 在 canvas 上挂 __zoom 后,内部回调 init 失败
 *    3. 物理 simulation 起不来
 *  - jsdom 测 canvas 库通常用 mock stub。我们用 vi.mock 把整个
 *    'react-force-graph-2d' 替换为一个简单 <canvas> 渲染组件,
 *    只暴露 props 契约(让 React Router / 测试可断言)。
 *  - 真实组件的视觉验证靠 e2e Playwright(headless chromium 真 canvas)。
 */

// Mock react-force-graph-2d — render 一个真正的 <canvas>,但忽略 force engine
// 和 zoom/d3 的所有副作用。我们记录最近一次收到的 props 到全局,
// 让测试可以断言"ForceGraph 把正确的 graphData / nodeLabel / linkLabel
// / onNodeClick 等传给底层库"。
import * as ReactNS from "react";
let lastForceGraph2DProps: Record<string, unknown> | null = null;
// v6.1:测试可注入的 mock ref(让单测验证 onEngineStop → zoomToFit 路径)。
// stub 会把这个对象赋给 forwardRef 的 ref.current,组件的 onEngineStop 回调
// 实际调到的就是 testRef.zoomToFit。
let testRef: { zoomToFit?: (...args: unknown[]) => void } = {};

vi.mock("react-force-graph-2d", () => {
  const Stub = ReactNS.forwardRef(function ForceGraphStub(
    props: Record<string, unknown>,
    ref: ReactNS.Ref<unknown>,
  ) {
    if (typeof ref === "function") ref(testRef);
    else if (ref) (ref as ReactNS.MutableRefObject<unknown>).current = testRef;
    lastForceGraph2DProps = props;
    return ReactNS.createElement("canvas", {
      "data-testid": "force-graph-canvas-stub",
      width: (props.width as number) ?? 800,
      height: (props.height as number) ?? 600,
    });
  });
  Stub.propTypes = {} as never; // 避免 prop-types 警告
  return { default: Stub };
});

// Import after mock
import { ForceGraph } from "../components/ForceGraph";

const NODES: GraphNode[] = [
  {
    id: "B06",
    label: "煤炭开采和洗选业",
    category: "B",
    description: "煤炭",
    status: "generated",
    failed_reason: null,
    last_attempt_at: null,
  },
  {
    id: "D44",
    label: "电力",
    category: "D",
    description: "电力",
    status: "failed",
    failed_reason: "LLM 超时",
    last_attempt_at: null,
  },
  {
    id: "C17",
    label: "纺织",
    category: "C",
    description: "纺织",
    status: "generated",
    failed_reason: null,
    last_attempt_at: null,
  },
];

const EDGES: GraphEdge[] = [
  {
    id: "B06-D44",
    source: "B06",
    target: "D44",
    relation_type: "supports",
    weight: 4,
    explanation: "煤炭是火电燃料",
    status: "generated",
    failed_reason: null,
    last_attempt_at: null,
  },
  {
    id: "D44-C17",
    source: "D44",
    target: "C17",
    relation_type: "supports",
    weight: 2,
    explanation: "纺织依赖电力",
    status: "failed",
    failed_reason: "模型错误",
    last_attempt_at: null,
  },
];

describe("ForceGraph v6 (react-force-graph-2d wrapper)", () => {
  beforeEach(() => {
    lastForceGraph2DProps = null;
    testRef = {};
  });

  it("renders a canvas element via the underlying react-force-graph-2d", () => {
    const { container } = render(
      <ForceGraph
        nodes={NODES}
        edges={EDGES}
        width={800}
        height={600}
      />
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders the graph-view container testid for backward compatibility with status bar logic", () => {
    const { container } = render(
      <ForceGraph
        nodes={NODES}
        edges={EDGES}
        width={800}
        height={600}
      />
    );
    expect(container.querySelector('[data-testid="graph-view"]')).toBeInTheDocument();
  });

  it("passes graphData with all nodes/links to react-force-graph-2d", () => {
    render(
      <ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />
    );
    expect(lastForceGraph2DProps).not.toBeNull();
    const graphData = lastForceGraph2DProps!.graphData as {
      nodes: { id: string }[];
      links: { id: string }[];
    };
    expect(graphData.nodes).toHaveLength(3);
    expect(graphData.links).toHaveLength(2);
    expect(graphData.nodes.map((n) => n.id).sort()).toEqual(["B06", "C17", "D44"]);
    expect(graphData.links.map((l) => l.id).sort()).toEqual(["B06-D44", "D44-C17"]);
  });

  it("sets nodeAutoColorBy='category' so 20 categories get distinct colors", () => {
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    expect(lastForceGraph2DProps!.nodeAutoColorBy).toBe("category");
  });

  it("renders gracefully with empty nodes/edges", () => {
    const { container } = render(
      <ForceGraph nodes={[]} edges={[]} width={400} height={300} />
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(container.querySelector('[data-testid="graph-view"]')).toBeInTheDocument();
    // graphData 应为空
    const graphData = lastForceGraph2DProps!.graphData as {
      nodes: unknown[];
      links: unknown[];
    };
    expect(graphData.nodes).toEqual([]);
    expect(graphData.links).toEqual([]);
  });

  it("does not crash when nodes/edges prop changes (re-renders)", () => {
    const { rerender, container } = render(
      <ForceGraph nodes={NODES.slice(0, 2)} edges={EDGES.slice(0, 1)} width={800} height={600} />
    );
    expect(container.querySelector("canvas")).toBeInTheDocument();
    rerender(
      <ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />
    );
    expect(container.querySelector("canvas")).toBeInTheDocument();
  });

  it("forwards onNodeClick / onLinkClick to the underlying library", () => {
    const onNodeClick = vi.fn();
    const onLinkClick = vi.fn();
    render(
      <ForceGraph
        nodes={NODES}
        edges={EDGES}
        onNodeClick={onNodeClick}
        onLinkClick={onLinkClick}
        width={800}
        height={600}
      />
    );
    expect(typeof lastForceGraph2DProps!.onNodeClick).toBe("function");
    expect(typeof lastForceGraph2DProps!.onLinkClick).toBe("function");
  });

  it("configures physics: d3AlphaDecay 0.02 + cooldownTicks 100 for stable force layout", () => {
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    expect(lastForceGraph2DProps!.d3AlphaDecay).toBe(0.02);
    expect(lastForceGraph2DProps!.cooldownTicks).toBe(100);
  });

  it("configures zoom range (minZoom 0.2 / maxZoom 5) for zoom-adaptive labels", () => {
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    expect(lastForceGraph2DProps!.minZoom).toBe(0.2);
    expect(lastForceGraph2DProps!.maxZoom).toBe(5);
  });

  it("nodeLabel uses {id} + {label} format for hover tooltips", () => {
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    const nodeLabel = lastForceGraph2DProps!.nodeLabel as (
      n: { id: string; label: string },
    ) => string;
    expect(typeof nodeLabel).toBe("function");
    expect(nodeLabel({ id: "B06", label: "煤炭" })).toBe("B06 煤炭");
  });

  it("linkLineDash for failed edges returns [4, 4] (dashed) and null for normal edges", () => {
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    const linkLineDash = lastForceGraph2DProps!.linkLineDash as (
      l: { status: string },
    ) => number[] | null;
    expect(linkLineDash({ status: "failed" })).toEqual([4, 4]);
    expect(linkLineDash({ status: "generated" })).toBeNull();
  });

  it("linkDirectionalArrowLength for failed edges returns 0 (no arrow) and 5 for normal edges", () => {
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    const arrowLen = lastForceGraph2DProps!.linkDirectionalArrowLength as (
      l: { status: string },
    ) => number;
    expect(arrowLen({ status: "failed" })).toBe(0);
    expect(arrowLen({ status: "generated" })).toBe(5);
  });

  // ---------- v6.1 polish: zoomToFit on engine stop (fix graph clumping in top-left) ----------

  it("passes onEngineStop callback to react-force-graph-2d (so centering happens AFTER simulation stabilizes, not before)", () => {
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    expect(typeof lastForceGraph2DProps!.onEngineStop).toBe("function");
  });

  it("onEngineStop calls zoomToFit on the ref (initial centering)", () => {
    const zoomToFitSpy = vi.fn();
    testRef = { zoomToFit: zoomToFitSpy };
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    const onEngineStop = lastForceGraph2DProps!.onEngineStop as () => void;
    onEngineStop();
    expect(zoomToFitSpy).toHaveBeenCalledTimes(1);
  });

  it("onEngineStop calls zoomToFit only on first engine stop (does not re-fit on subsequent stops)", () => {
    const zoomToFitSpy = vi.fn();
    testRef = { zoomToFit: zoomToFitSpy };
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    const onEngineStop = lastForceGraph2DProps!.onEngineStop as () => void;
    onEngineStop();
    onEngineStop();
    onEngineStop();
    expect(zoomToFitSpy).toHaveBeenCalledTimes(1);
  });

  it("onEngineStop re-fits when graphData changes (re-render with new data → new fit)", () => {
    const zoomToFitSpy = vi.fn();
    testRef = { zoomToFit: zoomToFitSpy };
    const { rerender } = render(
      <ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />
    );
    const onEngineStop = lastForceGraph2DProps!.onEngineStop as () => void;
    onEngineStop();
    expect(zoomToFitSpy).toHaveBeenCalledTimes(1);
    // simulate regenerate: 新的 graphData
    rerender(
      <ForceGraph
        nodes={[...NODES, {
          id: "E47",
          label: "建筑",
          category: "E",
          description: "建筑",
          status: "generated",
          failed_reason: null,
          last_attempt_at: null,
        }]}
        edges={EDGES}
        width={800}
        height={600}
      />
    );
    const onEngineStop2 = lastForceGraph2DProps!.onEngineStop as () => void;
    onEngineStop2();
    expect(zoomToFitSpy).toHaveBeenCalledTimes(2);
  });

  it("onEngineStop does not throw when ref has no zoomToFit (graceful degradation)", () => {
    testRef = {}; // no zoomToFit
    render(<ForceGraph nodes={NODES} edges={EDGES} width={800} height={600} />);
    const onEngineStop = lastForceGraph2DProps!.onEngineStop as () => void;
    expect(() => onEngineStop()).not.toThrow();
  });
});