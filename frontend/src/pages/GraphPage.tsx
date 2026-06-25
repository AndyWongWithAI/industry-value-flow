import { useState } from "react";
import { GraphView } from "../components/GraphView";
import type { GraphEdge, GraphNode, KnowledgeGraph } from "../types/api";

/**
 * 占位 mock 数据(T2 + T3 完成后接真实 API)。
 * - 3 节点 2 边,覆盖 A/B/C/D 4 大类配色
 * - 1 个 provide 边 + 1 个 service 边
 * - T6 阶段会改为从 /api/graph 拉取 + 加 status:failed 节点以验证红色边框
 */
const MOCK_GRAPH: KnowledgeGraph = {
  nodes: [
    {
      id: "B06",
      label: "煤炭开采和洗选业",
      category: "B",
      description: "煤炭的开采、洗选与初步加工",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      id: "D44",
      label: "电力、热力生产和供应业",
      category: "D",
      description: "电力与热力的生产、输送与供应",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      id: "C17",
      label: "纺织业",
      category: "C",
      description: "纺织纤维的加工与织造",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  edges: [
    {
      source: "B06",
      target: "D44",
      relation_type: "provide",
      weight: 4,
      explanation: "煤炭是火力发电的主要燃料",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      source: "D44",
      target: "C17",
      relation_type: "service",
      weight: 3,
      explanation: "纺织业生产高度依赖电力供应",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  generated_at: new Date().toISOString(),
  llm_config_hash: "mock",
  schema_version: "v1",
};

/**
 * 知识图谱页(T5 范围内):
 * - 整图 react-flow 渲染(由 GraphView 负责 dagre 布局)
 * - 点击节点/边 → 右侧 360px 抽屉显示简单信息
 * - T6 会扩展:接入真实 API / NodePanel / EdgePanel / 「AI 解释」按钮 / 状态条
 * - T7 会扩展:LLM 不可用 fallback UI
 */
export function GraphPage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  return (
    <div style={{ position: "relative" }}>
      <GraphView
        graph={MOCK_GRAPH}
        onNodeClick={setSelectedNode}
        onEdgeClick={setSelectedEdge}
      />
      {selectedNode && (
        <div
          data-testid="node-panel"
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            width: 360,
            height: "100vh",
            background: "#FFFFFF",
            borderLeft: "1px solid #E5E7EB",
            padding: 24,
            overflowY: "auto",
            boxShadow: "-2px 0 8px rgba(0,0,0,0.04)",
            zIndex: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{selectedNode.label}</h2>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
            GB/T 4754: {selectedNode.id} · {selectedNode.category}
          </div>
          <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.6, color: "#1A1A1A" }}>
            {selectedNode.description}
          </p>
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              marginTop: 24,
              padding: "8px 16px",
              background: "#F8F9FA",
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
              color: "#1A1A1A",
            }}
          >
            关闭
          </button>
        </div>
      )}
      {selectedEdge && (
        <div
          data-testid="edge-panel"
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            width: 360,
            height: "100vh",
            background: "#FFFFFF",
            borderLeft: "1px solid #E5E7EB",
            padding: 24,
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            {selectedEdge.relation_type} · weight {selectedEdge.weight}
          </h2>
          <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.6 }}>
            {selectedEdge.explanation}
          </p>
          <button
            onClick={() => setSelectedEdge(null)}
            style={{
              marginTop: 24,
              padding: "8px 16px",
              background: "#F8F9FA",
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
              color: "#1A1A1A",
            }}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
