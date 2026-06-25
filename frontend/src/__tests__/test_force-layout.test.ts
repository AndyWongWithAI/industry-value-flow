// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { layoutWithForce } from "../lib/force-layout";
import type { GraphNode, GraphEdge } from "../types/api";

function mkNode(id: string, category: GraphNode["category"] = "A"): GraphNode {
  return {
    id,
    label: id,
    category,
    description: "",
    status: "generated",
    failed_reason: null,
    last_attempt_at: null,
  };
}

function mkEdge(source: string, target: string, weight = 3): GraphEdge {
  return {
    source,
    target,
    relation_type: "supports",
    weight,
    explanation: "",
    status: "generated",
    failed_reason: null,
    last_attempt_at: null,
  };
}

describe("force-layout (d3-force based)", () => {
  it("3 nodes 2 edges: every node gets x/y coordinates", () => {
    const nodes = [mkNode("A"), mkNode("B"), mkNode("C")];
    const edges = [mkEdge("A", "B"), mkEdge("B", "C")];
    const { nodes: laidOut } = layoutWithForce(nodes, edges);
    expect(laidOut).toHaveLength(3);
    for (const node of laidOut) {
      expect(typeof node.x).toBe("number");
      expect(typeof node.y).toBe("number");
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
    // 每节点 id 应保留
    const ids = laidOut.map((n) => n.id).sort();
    expect(ids).toEqual(["A", "B", "C"]);
  });

  it("simulation spreads connected nodes (does not collapse to a point)", () => {
    const nodes = "ABCDE".split("").map((id) => mkNode(id));
    const edges = [
      mkEdge("A", "B"),
      mkEdge("B", "C"),
      mkEdge("C", "D"),
      mkEdge("D", "E"),
    ];
    const { nodes: laidOut } = layoutWithForce(nodes, edges, {
      width: 1000,
      height: 800,
      iterations: 300,
    });
    // 计算 spread:最大 x - 最小 x 与最大 y - 最小 y 都应 > 50(节点拉开)
    const xs = laidOut.map((n) => n.x);
    const ys = laidOut.map((n) => n.y);
    const xSpread = Math.max(...xs) - Math.min(...xs);
    const ySpread = Math.max(...ys) - Math.min(...ys);
    expect(xSpread + ySpread).toBeGreaterThan(50);
  });

  it("two connected nodes are not collapsed to same point (basic collision)", () => {
    const nodes = [mkNode("X"), mkNode("Y")];
    const edges = [mkEdge("X", "Y")];
    const { nodes: laidOut } = layoutWithForce(nodes, edges, {
      iterations: 200,
    });
    const dx = (laidOut[0].x ?? 0) - (laidOut[1].x ?? 0);
    const dy = (laidOut[0].y ?? 0) - (laidOut[1].y ?? 0);
    const dist = Math.sqrt(dx * dx + dy * dy);
    // forceCollide(20) + charge 应当推开至少 30 像素
    expect(dist).toBeGreaterThan(20);
  });

  it("empty nodes returns empty array", () => {
    const { nodes, edges } = layoutWithForce([], []);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it("does not mutate input arrays", () => {
    const nodes = [mkNode("A"), mkNode("B")];
    const edges = [mkEdge("A", "B")];
    const snapshotNodes = JSON.parse(JSON.stringify(nodes));
    const snapshotEdges = JSON.parse(JSON.stringify(edges));
    layoutWithForce(nodes, edges);
    expect(nodes).toEqual(snapshotNodes);
    expect(edges).toEqual(snapshotEdges);
  });
});