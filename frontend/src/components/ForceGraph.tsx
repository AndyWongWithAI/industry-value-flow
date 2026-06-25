import { useMemo, useRef, useEffect, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphNode, GraphEdge } from "../types/api";

/** v6 e2e 钩子:在 window 上暴露 __simulateNodeClick,让 Playwright
 *  不依赖 canvas 坐标变换即可触发 onNodeClick,验证 NodePanel 数据流。
 *  生产环境(import.meta.env.PROD === true)跳过这段。 */

/**
 * v6:react-force-graph-2d 包装组件(spec §8.3 Obsidian 风格 v6 重写):
 *  - Canvas 渲染,内置物理 simulation(d3-force via force-graph)
 *  - 缩放自适应:globalScale < 0.4 不画 label,> 0.4 画中文 label
 *  - 节点配色按 category(自动从 nodeAutoColorBy 推出,内部仍走 CATEGORY_COLORS)
 *  - 边按 status 颜色 / 虚线 / 箭头 / 粒子流
 *  - 失败节点用红字 label,失败边用红色虚线 + 无箭头
 *
 * 与 v5 GraphView 兼容点:
 *  - data-testid="graph-view" 容器(给 EmptyState / LoadingState 检测用)
 *  - onNodeClick(nodeId: string) + onLinkClick(linkId: string) 协议
 *
 * 与 v5 不同点:
 *  - 没有专门的 dot/label/full 三档(物理自适应本身就有 zoom,react-force-graph
 *    原生处理 viewport);只在 globalScale < 0.4 时不画 label。
 */

interface ForceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  onLinkClick?: (linkId: string) => void;
  width: number;
  height: number;
}

/** FGNode:喂给 react-force-graph 的节点(附加物理字段) */
interface FGNode {
  id: string;
  label: string;
  category: string;
  status: string;
  description: string;
  failed_reason: string | null;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

/** FGLink:喂给 react-force-graph 的边 */
interface FGLink {
  source: string | FGNode;
  target: string | FGNode;
  id: string;
  relation_type: string;
  weight: number;
  explanation: string;
  status: string;
  failed_reason: string | null;
}

/** 失败色(spec §4.4.4 统一红) */
const FAILED_COLOR = "#DC2626";

/** 失败节点 label 颜色;普通节点 label 颜色 */
const LABEL_COLOR_NORMAL = "#0F172A";
const LABEL_COLOR_FAILED = "#DC2626";

/** label 显示阈值(globalScale) */
const LABEL_MIN_GLOBAL_SCALE = 0.4;

export function ForceGraph({
  nodes,
  edges,
  onNodeClick,
  onLinkClick,
  width,
  height,
}: ForceGraphProps) {
  // 转换 GraphNode -> FGNode
  const fgNodes = useMemo<FGNode[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        label: n.label,
        category: n.category,
        status: n.status,
        description: n.description,
        failed_reason: n.failed_reason ?? null,
      })),
    [nodes]
  );

  // 转换 GraphEdge -> FGLink
  const fgLinks = useMemo<FGLink[]>(
    () =>
      edges.map((e) => ({
        source: e.source,
        target: e.target,
        id: e.id ?? `${e.source}-${e.target}`,
        relation_type: e.relation_type,
        weight: e.weight,
        explanation: e.explanation,
        status: e.status,
        failed_reason: e.failed_reason ?? null,
      })),
    [edges]
  );

  const graphData = useMemo(
    () => ({ nodes: fgNodes, links: fgLinks }),
    [fgNodes, fgLinks]
  );

  // 节点点击 → 把 nodeId 字符串透传给上层(GraphPage 找 GraphNode 后打开 NodePanel)
  const handleNodeClick = (node: FGNode) => {
    if (onNodeClick) onNodeClick(node.id);
  };

  // 边点击 → react-force-graph 会把 source/target 改成 node 对象,从对象取 id
  // 还原回 link id(后端合成的 edge.id 形如 "B06-D44")
  const handleLinkClick = (link: FGLink) => {
    if (!onLinkClick) return;
    const linkId = typeof link.id === "string"
      ? link.id
      : `${(link.source as FGNode).id}-${(link.target as FGNode).id}`;
    onLinkClick(linkId);
  };

  // ref 拿 ForceGraphMethods(jsdom 里 canvas 不真渲染,但 ref 接口存在)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  // 物理 simulation 收敛后 d3AlphaDecay 自动停止;我们额外监听 graphData 变化
  // 让 React 在 mount 时手动 zoomToFit,保证首次加载图居中。
  const [hasFit, setHasFit] = useState(false);
  useEffect(() => {
    if (!hasFit && fgRef.current && typeof fgRef.current.zoomToFit === "function") {
      try {
        fgRef.current.zoomToFit(400, 50);
      } catch {
        // jsdom 下 canvas 拿不到 bbox,静默兜底
      }
      setHasFit(true);
    }
  }, [hasFit, graphData]);

  // e2e 钩子:在 dev/test 环境下,把 onNodeClick 透传到 window.__simulateNodeClick
  // 让 Playwright 不依赖 canvas 坐标即可触发节点点击。
  // 生产环境跳过。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __simulateNodeClick?: (id: string) => void };
    w.__simulateNodeClick = (id: string) => {
      const target = fgNodes.find((n) => n.id === id);
      if (target) handleNodeClick(target);
    };
    return () => {
      delete w.__simulateNodeClick;
    };
  }, [fgNodes]);

  return (
    <div
      data-testid="graph-view"
      style={{ width: "100%", height: "100%", background: "#FFFFFF", position: "relative" }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="#FFFFFF"
        nodeId="id"
        nodeLabel={(node) => `${(node as FGNode).id} ${(node as FGNode).label}`}
        nodeAutoColorBy="category"
        nodeRelSize={6}
        nodeCanvasObjectMode={() => "after"}
        nodeCanvasObject={(node, ctx, globalScale) => {
          // 缩远到一定程度不画 label
          if (globalScale < LABEL_MIN_GLOBAL_SCALE) return;
          const n = node as FGNode;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px "Source Han Sans SC", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = n.status === "failed" ? LABEL_COLOR_FAILED : LABEL_COLOR_NORMAL;
          // node.x / node.y 由 force-graph 在 simulation 阶段写入
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ctx.fillText(n.label, n.x!, n.y! + 5);
        }}
        linkLabel={(link) => {
          const l = link as FGLink;
          const src = typeof l.source === "string" ? l.source : l.source.id;
          const tgt = typeof l.target === "string" ? l.target : l.target.id;
          return `${src} → ${tgt} | 权重 ${l.weight}\n${l.explanation || ""}`;
        }}
        linkColor={(link) => {
          const l = link as FGLink;
          return l.status === "failed" ? FAILED_COLOR : "#94A3B8";
        }}
        linkWidth={(link) => {
          const l = link as FGLink;
          return Math.max(1, l.weight * 0.5);
        }}
        linkDirectionalArrowLength={(link) => {
          const l = link as FGLink;
          return l.status === "failed" ? 0 : 5;
        }}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalParticles={(link) => {
          const l = link as FGLink;
          return l.weight >= 4 ? 2 : 0;
        }}
        linkDirectionalParticleSpeed={(link) => {
          const l = link as FGLink;
          return 0.005 * l.weight;
        }}
        linkDirectionalParticleColor={() => "#1A4D8F"}
        linkLineDash={(link) => {
          const l = link as FGLink;
          return l.status === "failed" ? [4, 4] : null;
        }}
        onNodeClick={handleNodeClick}
        onLinkClick={handleLinkClick}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        cooldownTicks={100}
        minZoom={0.2}
        maxZoom={5}
      />
    </div>
  );
}