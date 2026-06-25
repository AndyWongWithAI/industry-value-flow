import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "reactflow";

/** dagre 布局参数(spec §8.3 默认 LR) */
export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  rankdir?: "TB" | "BT" | "LR" | "RL";
  nodesep?: number;
  ranksep?: number;
}

/**
 * 用 dagre 对 react-flow 节点列表做自动布局(返回 position 填充后的新数组)。
 *
 * dagre 返回的坐标是节点中心点,react-flow 期望的是左上角,
 * 所以这里减去 nodeWidth/2 与 nodeHeight/2。
 *
 * spec §8.3:
 * - 布局算法选 dagre(force 在 100+ 节点性能可接受,但 dagre 更稳定可读)
 * - 节点大小按入度+出度对数缩放(中心节点放大)— 此处 T5 用固定大小,T6 优化
 */
export function layoutWithDagre<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node<T>[] {
  const {
    nodeWidth = 160,
    nodeHeight = 60,
    rankdir = "LR",
    nodesep = 30,
    ranksep = 80,
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep });

  nodes.forEach((node) => g.setNode(node.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  return nodes.map((node) => {
    const nodeData = g.node(node.id);
    // dagre 对孤立节点(无入/出边)可能不返回 x/y,fallback 到原 position
    const cx = nodeData?.x ?? node.position.x;
    const cy = nodeData?.y ?? node.position.y;
    return {
      ...node,
      position: {
        x: cx - nodeWidth / 2,
        y: cy - nodeHeight / 2,
      },
    };
  });
}
