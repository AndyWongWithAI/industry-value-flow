import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import type {
  GraphEdge as GraphEdgeData,
  GraphNode as GraphNodeData,
  KnowledgeGraph,
} from "../types/api";
import { layoutWithDagre } from "../lib/dagre-layout";
import { GraphEdge as GraphEdgeComponent } from "./GraphEdge";
import type { GraphEdgeData as GraphEdgeComponentData } from "./GraphEdge";
import { GraphNode as GraphNodeComponent } from "./GraphNode";
import type { GraphNodeData as GraphNodeComponentData } from "./GraphNode";

const nodeTypes = { graphNode: GraphNodeComponent };
const edgeTypes = { graphEdge: GraphEdgeComponent };

interface GraphViewProps {
  graph: KnowledgeGraph;
  onNodeClick?: (node: GraphNodeData) => void;
  onEdgeClick?: (edge: GraphEdgeData) => void;
}

/**
 * react-flow 知识图谱视图(spec §8.3):
 * - dagre 自动布局
 * - 节点配色按 GB/T 4754 大类
 * - 边样式按 relation_type + weight
 * - 失败节点红色边框,失败边虚线
 * - fitView 默认启用 + 工具栏(Background / Controls / MiniMap)
 */
export function GraphView({ graph, onNodeClick, onEdgeClick }: GraphViewProps) {
  // 转换为 react-flow 格式
  const initialNodes: Node<GraphNodeComponentData>[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: "graphNode",
        data: {
          label: n.label,
          category: n.category,
          description: n.description,
          status: n.status,
          failed_reason: n.failed_reason,
        },
        position: { x: 0, y: 0 }, // dagre 会重写
      })),
    [graph.nodes]
  );

  const initialEdges: Edge<GraphEdgeComponentData>[] = useMemo(
    () =>
      graph.edges.map((e, idx) => ({
        id: `${e.source}->${e.target}-${idx}`,
        source: e.source,
        target: e.target,
        type: "graphEdge",
        data: {
          relation_type: e.relation_type,
          weight: e.weight,
          explanation: e.explanation,
          status: e.status,
          failed_reason: e.failed_reason,
        },
      })),
    [graph.edges]
  );

  const laidOutNodes = useMemo(
    () => layoutWithDagre(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const originalNode = graph.nodes.find((n) => n.id === node.id);
      if (originalNode && onNodeClick) onNodeClick(originalNode);
    },
    [graph.nodes, onNodeClick]
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      // edge.id 形如 `${source}->${target}-${idx}`,拆出前两段
      const dashIdx = edge.id.lastIndexOf("-");
      const head = dashIdx >= 0 ? edge.id.slice(0, dashIdx) : edge.id;
      const [source, target] = head.split("->");
      const originalEdge = graph.edges.find(
        (e) => e.source === source && e.target === target
      );
      if (originalEdge && onEdgeClick) onEdgeClick(originalEdge);
    },
    [graph.edges, onEdgeClick]
  );

  return (
    <div
      data-testid="graph-view"
      style={{ width: "100%", height: "100vh", background: "#FFFFFF" }}
    >
      <ReactFlow
        nodes={laidOutNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#F0F0F0" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as { category?: string };
            if (data?.category) {
              // 动态从 gbt4754-colors 取色,避免循环依赖,直接 import 函数
              // 这里简化:用 CSS 变量 + 兜底灰
              return `var(--cat-${data.category}, #999999)`;
            }
            return "#999999";
          }}
          style={{ background: "#F8F9FA", border: "1px solid #E5E7EB" }}
        />
      </ReactFlow>
    </div>
  );
}
