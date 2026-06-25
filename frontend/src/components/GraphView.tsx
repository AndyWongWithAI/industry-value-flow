import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type Viewport,
} from "reactflow";
import "reactflow/dist/style.css";
import type {
  GraphEdge as GraphEdgeData,
  GraphNode as GraphNodeData,
  KnowledgeGraph,
} from "../types/api";
import { layoutWithForce } from "../lib/force-layout";
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

/** v5 缩放自适应阈值(spec §8.3 Obsidian 风格):
 *  - < 0.4 :节点变成色点
 *  - < 0.8 :节点只显示 label,无完整 border
 *  - < 0.5 :边完全不可见
 *  - < 1.0 :边只画线,无 label 无箭头
 *  - >= 1.0:边显示 label + 箭头
 */
const NODE_LABEL_MIN_ZOOM = 0.4;
const NODE_FULL_MIN_ZOOM = 0.8;
const EDGE_LINE_MIN_ZOOM = 0.5;
const EDGE_DETAIL_MIN_ZOOM = 1.0;

/**
 * react-flow 知识图谱视图(spec §8.3 v5):
 * - d3-force 力导向布局(取代 dagre 的死板布局)
 * - 节点配色按 GB/T 4754 大类
 * - 缩放自适应:缩远只剩色点,放大后显示 label/边/箭头/explanation
 * - 失败节点红色边框,失败边虚线
 * - fitView 默认启用 + 工具栏(Background / Controls / MiniMap)
 */
export function GraphView({ graph, onNodeClick, onEdgeClick }: GraphViewProps) {
  // v5:当前 viewport 的 zoom(由 onMove 回调更新)
  const [zoom, setZoom] = useState<number>(1);

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
        position: { x: 0, y: 0 }, // force-layout 会重写
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
        // v5:始终挂箭头 marker,实际显隐由 GraphEdge 根据 zoom 决定
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: e.status === "failed" ? "#DC2626" : "#94A3B8",
          width: 12,
          height: 12,
        },
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

  // v5:用 d3-force 跑一次 simulation,得到节点位置
  const laidOutNodes = useMemo(() => {
    const { nodes: positions } = layoutWithForce(graph.nodes, graph.edges, {
      width: 1200,
      height: 800,
      iterations: 300,
    });
    const posMap = new Map(positions.map((p) => [p.id, p]));
    return initialNodes.map((n) => {
      const pos = posMap.get(n.id);
      return {
        ...n,
        position: {
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
        },
      };
    });
  }, [graph.nodes, graph.edges, initialNodes]);

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

  // v5:onMove 回调更新 zoom state
  const handleMove = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      setZoom(viewport.zoom);
    },
    []
  );

  // 把 zoom 通过 data 字段注入到节点/边组件(react-flow 11 没有直接 prop 通道,
  // 但 data 字段会作为 props.data 传给自定义组件)
  const nodesWithZoom = useMemo(
    () =>
      laidOutNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          zoom,
          zoomLabelMin: NODE_LABEL_MIN_ZOOM,
          zoomFullMin: NODE_FULL_MIN_ZOOM,
        } as GraphNodeComponentData,
      })),
    [laidOutNodes, zoom]
  );

  const edgesWithZoom = useMemo(
    () =>
      initialEdges.map((e) => ({
        ...e,
        data: {
          ...e.data,
          zoom,
          zoomLineMin: EDGE_LINE_MIN_ZOOM,
          zoomDetailMin: EDGE_DETAIL_MIN_ZOOM,
        } as GraphEdgeComponentData,
      })),
    [initialEdges, zoom]
  );

  return (
    <div
      data-testid="graph-view"
      style={{ width: "100%", height: "100vh", background: "#FFFFFF" }}
    >
      <ReactFlow
        nodes={nodesWithZoom}
        edges={edgesWithZoom}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onMove={handleMove}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#F0F0F0" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as { category?: string };
            if (data?.category) {
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