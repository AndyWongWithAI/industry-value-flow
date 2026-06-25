import { useEffect, useMemo, useState } from "react";
import { GraphView } from "../components/GraphView";
import { StatusBar } from "../components/StatusBar";
import { NodePanel } from "../components/NodePanel";
import { EdgePanel } from "../components/EdgePanel";
import { EmptyState } from "../components/EmptyState";
import {
  getGraph,
  getGraphStats,
  regenerateFailed,
  explainEdge,
  LLMUnavailableError,
  type ApiRegenerateFailedFn,
  type ApiExplainEdgeFn,
} from "../lib/api-helpers";
import type { GraphEdge, GraphNode, KnowledgeGraph } from "../types/api";

/**
 * 知识图谱页(T6 完整版):
 *  - 顶部 StatusBar:已生成 X / Y, 失败 Z, [重跑]
 *  - 主区:GraphView 全图渲染
 *  - 右侧:点击节点 → NodePanel,点击边 → EdgePanel
 *  - LLM 不可用 → EmptyState
 *  - Partial failure:统计 / 红色边框 / 状态条 / 失败条 统一呈现
 *
 * 设计决策:
 *  - 不在 GraphPage 维护持久 state(只维护 selectedNode/selectedEdge + 加载态)
 *  - 重跑是 fire-and-forget,T4 接入时再轮询 job 状态
 *  - 节点详情面板的入/出边点击可以跳到 EdgePanel
 */

function computeStats(graph: KnowledgeGraph) {
  // 客户端兜底计算,T4 上线后用 getGraphStats() 服务端值
  let generated = 0;
  let failed = 0;
  let pending = 0;
  for (const n of graph.nodes) {
    if (n.status === "generated") generated++;
    else if (n.status === "failed") failed++;
    else pending++;
  }
  for (const e of graph.edges) {
    if (e.status === "generated") generated++;
    else if (e.status === "failed") failed++;
    else pending++;
  }
  return { total: generated + failed + pending, generated, failed, pending };
}

export interface GraphPageProps {
  /** 测试用:允许注入自定义 API(默认从 lib/api 拉) */
  api?: {
    getGraph: typeof getGraph;
    getGraphStats?: typeof getGraphStats;
    regenerateFailed?: ApiRegenerateFailedFn;
    explainEdge?: ApiExplainEdgeFn;
  };
}

export function GraphPage(props: GraphPageProps = {}) {
  // T7 step 5+: 把 api 包成 useMemo,避免每次 render 重建对象导致 useEffect
  // 依赖变化 → 无限拉取 /api/graph(StrictMode 双调用叠加)。
  const api = useMemo(
    () =>
      props.api ?? {
        getGraph,
        getGraphStats,
        regenerateFailed,
        explainEdge: explainEdge as ApiExplainEdgeFn,
      },
    [props.api]
  );

  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [reExplaining, setReExplaining] = useState(false);
  const [llmError, setLlmError] = useState<{ title: string; subtitle: string; reason?: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // 加载图谱
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getGraph()
      .then((g) => {
        if (!cancelled) {
          setGraph(g);
          setLlmError(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof LLMUnavailableError) {
          setLlmError({
            title: "请先配置 LLM",
            subtitle:
              "本平台依赖 LLM 生成行业关系图,未配置无法展示",
            reason: err.message,
          });
        } else {
          setLlmError({
            title: "加载失败",
            subtitle: "无法加载知识图谱,请稍后重试",
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const stats = useMemo(() => {
    if (!graph) return { total: 0, generated: 0, failed: 0, pending: 0 };
    return computeStats(graph);
  }, [graph]);

  const handleRerun = async () => {
    setRerunning(true);
    try {
      if (api.regenerateFailed) {
        await api.regenerateFailed("all");
      }
      // stub 模式下重拉一次图
      const g = await api.getGraph();
      setGraph(g);
    } catch (err) {
      // 静默失败 — StatusBar 还在,可以再点
      console.warn("[GraphPage] regenerate failed", err);
    } finally {
      setRerunning(false);
    }
  };

  const handleReExplain = async () => {
    if (!selectedEdge) return;
    setReExplaining(true);
    const edgeId = selectedEdge.id ?? `${selectedEdge.source}-${selectedEdge.target}`;
    try {
      if (api.explainEdge) {
        await api.explainEdge(edgeId);
      }
      // stub 模式:更新当前边的 explanation
      setSelectedEdge((prev) =>
        prev
          ? {
              ...prev,
              status: "generated",
              explanation: `[重新生成] ${prev.source} 与 ${prev.target} 的关系解释...`,
            }
          : null
      );
    } catch (err) {
      console.warn("[GraphPage] re-explain failed", err);
    } finally {
      setReExplaining(false);
    }
  };

  const handleNodeClick = (n: GraphNode) => {
    setSelectedEdge(null);
    setSelectedNode(n);
  };

  const handleEdgeClick = (e: GraphEdge) => {
    setSelectedNode(null);
    setSelectedEdge(e);
  };

  // LLM 不可用:仅展示 EmptyState(不画图谱,也不显示 StatusBar 数据)
  if (llmError) {
    return (
      <EmptyState
        title={llmError.title}
        subtitle={llmError.subtitle}
        reason={llmError.reason}
      />
    );
  }

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--color-bg)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <StatusBar
        stats={stats}
        onRerun={handleRerun}
        rerunning={rerunning}
      />
      <main
        data-testid="graph-page-main"
        style={{
          height: "calc(100vh - 56px)",
          position: "relative",
        }}
      >
        {loading && !graph && (
          <div
            data-testid="graph-page-loading"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-tertiary)",
              fontSize: 14,
            }}
          >
            加载中...
          </div>
        )}
        {graph && (
          <GraphView
            graph={graph}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
          />
        )}
      </main>
      {graph && selectedNode && (
        <NodePanel
          node={selectedNode}
          graph={graph}
          onClose={() => setSelectedNode(null)}
          onEdgeClick={handleEdgeClick}
        />
      )}
      {graph && selectedEdge && (
        <EdgePanel
          edge={selectedEdge}
          sourceNode={
            graph.nodes.find((n) => n.id === selectedEdge.source) ?? null
          }
          targetNode={
            graph.nodes.find((n) => n.id === selectedEdge.target) ?? null
          }
          onClose={() => setSelectedEdge(null)}
          onReExplain={handleReExplain}
          reExplaining={reExplaining}
        />
      )}
    </div>
  );
}

export default GraphPage;
