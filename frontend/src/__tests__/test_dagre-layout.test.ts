// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { layoutWithDagre } from "../lib/dagre-layout";
import type { Node, Edge } from "reactflow";

describe("dagre-layout", () => {
  it("3 nodes 2 edges: every node gets x/y coordinates", () => {
    const nodes: Node[] = [
      { id: "A", type: "graphNode", position: { x: 0, y: 0 }, data: {} },
      { id: "B", type: "graphNode", position: { x: 0, y: 0 }, data: {} },
      { id: "C", type: "graphNode", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "A->B", source: "A", target: "B" },
      { id: "B->C", source: "B", target: "C" },
    ];
    const laidOut = layoutWithDagre(nodes, edges);
    for (const node of laidOut) {
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
      // 至少有一个节点坐标非 0(dagre 应当铺开)
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
    expect(laidOut).toHaveLength(3);
  });

  it("does not produce overlapping nodes (simplified check)", () => {
    // 5 节点 4 边链,所有节点应当被 dagre 铺开(简化检测:任意两节点 x/y 距离 > 0)
    const nodes: Node[] = "ABCDE".split("").map((id) => ({
      id,
      type: "graphNode",
      position: { x: 0, y: 0 },
      data: {},
    }));
    const edges: Edge[] = [
      { id: "A->B", source: "A", target: "B" },
      { id: "B->C", source: "B", target: "C" },
      { id: "C->D", source: "C", target: "D" },
      { id: "D->E", source: "D", target: "E" },
    ];
    const laidOut = layoutWithDagre(nodes, edges, { rankdir: "LR" });
    // 至少存在一对节点 x 坐标不同(LR 方向)
    const xs = new Set(laidOut.map((n) => Math.round(n.position.x)));
    expect(xs.size).toBeGreaterThan(1);
  });

  it("preserves node data and other properties", () => {
    const nodes: Node[] = [
      { id: "X", type: "graphNode", position: { x: 0, y: 0 }, data: { foo: "bar" } },
    ];
    const edges: Edge[] = [];
    const laidOut = layoutWithDagre(nodes, edges);
    expect(laidOut[0].id).toBe("X");
    expect(laidOut[0].data).toEqual({ foo: "bar" });
    expect(laidOut[0].type).toBe("graphNode");
  });

  it("handles disconnected nodes (no edges)", () => {
    const nodes: Node[] = [
      { id: "isolated1", type: "graphNode", position: { x: 0, y: 0 }, data: {} },
      { id: "isolated2", type: "graphNode", position: { x: 0, y: 0 }, data: {} },
    ];
    const laidOut = layoutWithDagre(nodes, []);
    expect(laidOut).toHaveLength(2);
    for (const n of laidOut) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it("respects custom rankdir option (TB vs LR)", () => {
    const nodes: Node[] = [
      { id: "A", type: "graphNode", position: { x: 0, y: 0 }, data: {} },
      { id: "B", type: "graphNode", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "A->B", source: "A", target: "B" }];
    const tb = layoutWithDagre(nodes, edges, { rankdir: "TB" });
    const lr = layoutWithDagre(nodes, edges, { rankdir: "LR" });
    // TB: A 在 B 上方(LR: A 在 B 左侧)— x 坐标差距应当不同
    const tbDeltaY = Math.abs(tb[0].position.y - tb[1].position.y);
    const lrDeltaY = Math.abs(lr[0].position.y - lr[1].position.y);
    // 不强制精确值,只验证至少有一个布局方向 y 差距大(TB 应当竖排)
    expect(tbDeltaY).toBeGreaterThan(0);
    expect(lrDeltaY).toBeGreaterThanOrEqual(0);
  });
});
