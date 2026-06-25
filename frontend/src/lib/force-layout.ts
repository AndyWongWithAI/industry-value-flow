import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import type { GraphNode, GraphEdge } from "../types/api";

/** 模拟后的节点(只有位置信息,不携带原始数据) */
export interface LayoutedNode {
  id: string;
  x: number;
  y: number;
}

/** 模拟后的边(只有 source/target) */
export interface LayoutedEdge {
  source: string;
  target: string;
}

/** d3-force 布局选项 */
export interface ForceLayoutOptions {
  /** 画布宽度(像素,默认 1200) */
  width?: number;
  /** 画布高度(像素,默认 800) */
  height?: number;
  /** 模拟迭代次数(默认 300) */
  iterations?: number;
  /** 节点互斥强度(负数,默认 -200) */
  chargeStrength?: number;
  /** 边吸引距离(像素,默认 80) */
  linkDistance?: number;
  /** 节点碰撞半径(像素,默认 20) */
  collideRadius?: number;
}

/**
 * 用 d3-force 对图谱做力导向布局(spec §8.3 v5 重写):
 * - 节点互斥(charge):自然散开
 * - 边吸引(link):关联节点靠近
 * - 中心拉力(center):防止飘出画布
 * - 碰撞(collide):避免重叠
 *
 * 返回纯位置数组,不修改原 nodes/edges。
 */
export function layoutWithForce(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options?: ForceLayoutOptions
): { nodes: LayoutedNode[]; edges: LayoutedEdge[] } {
  const {
    width = 1200,
    height = 800,
    iterations = 300,
    chargeStrength = -200,
    linkDistance = 80,
    collideRadius = 20,
  } = options ?? {};

  // 1. 复制为 simulation node(避免污染输入),初始位置在画布中心附近随机
  interface SimNode {
    id: string;
    x: number;
    y: number;
    category: GraphNode["category"];
  }
  const simNodes: SimNode[] = nodes.map((n) => ({
    id: n.id,
    x: width / 2 + (Math.random() - 0.5) * 200,
    y: height / 2 + (Math.random() - 0.5) * 200,
    category: n.category,
  }));

  // 边:只用 source/target 字符串
  interface SimLink {
    source: string;
    target: string;
  }
  const simLinks: SimLink[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
  }));

  // 2. 构造 simulation
  const sim = forceSimulation<SimNode>(simNodes)
    .force("charge", forceManyBody<SimNode>().strength(chargeStrength))
    .force(
      "link",
      forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(linkDistance)
        .strength(0.5)
    )
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide<SimNode>(collideRadius))
    .force("x", forceX<SimNode>(width / 2).strength(0.05))
    .force("y", forceY<SimNode>(height / 2).strength(0.05))
    .stop();

  // 3. 同步跑 N 次 tick(d3 标准做法)
  for (let i = 0; i < iterations; i++) {
    sim.tick();
  }

  return {
    nodes: simNodes.map((n) => ({
      id: n.id,
      x: typeof n.x === "number" ? n.x : width / 2,
      y: typeof n.y === "number" ? n.y : height / 2,
    })),
    edges: simLinks.map((l) => ({ source: l.source, target: l.target })),
  };
}