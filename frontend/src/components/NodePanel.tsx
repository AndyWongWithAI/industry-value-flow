import type { GraphEdge, GraphNode, KnowledgeGraph, RelationType } from "../types/api";
import { Tooltip } from "./Tooltip";

/**
 * 节点详情面板(T6 §6.5):
 *  - 顶部:类别图标 + 名称 + 代码 + 类别
 *  - 描述 + 状态 + 失败原因
 *  - 入边列表 + 出边列表
 *  - status=failed 时,顶部加红色提示条
 *  - 点击 × 关闭面板(由 onClose 控制,父级清空 selectedNode)
 *
 * 设计决策:
 *  - 关系类型用中文标签,与 GraphEdge 组件保持一致
 *  - 强度用 ●○○○○ (1-5) 圆点
 *  - 入/出边按"代码 + 中文名"渲染,方向用 → 标识
 *  - 复用 Tooltip 显示 failed_reason(避免硬编码 title 属性)
 */

const RELATION_LABELS: Record<RelationType, string> = {
  provide: "支撑",
  rely_on: "依赖",
  service: "服务",
  consume: "消费",
};

function renderWeight(weight: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(weight)));
  return "●".repeat(filled) + "○".repeat(5 - filled);
}

function findNode(graph: KnowledgeGraph, id: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

const STATUS_LABELS: Record<GraphNode["status"], { label: string; color: string }> = {
  generated: { label: "已生成", color: "var(--color-success)" },
  pending: { label: "生成中", color: "var(--color-warning)" },
  failed: { label: "生成失败", color: "var(--color-error)" },
};

export interface NodePanelProps {
  node: GraphNode;
  graph: KnowledgeGraph;
  onClose: () => void;
  onEdgeClick?: (edge: GraphEdge) => void;
}

export function NodePanel({ node, graph, onClose, onEdgeClick }: NodePanelProps) {
  const inEdges = graph.edges.filter((e) => e.target === node.id);
  const outEdges = graph.edges.filter((e) => e.source === node.id);
  const statusInfo = STATUS_LABELS[node.status];

  return (
    <aside
      data-testid="node-panel"
      aria-label="节点详情"
      style={{
        position: "fixed",
        right: 0,
        top: 56, // 状态条高度
        width: 360,
        height: "calc(100vh - 56px)",
        background: "var(--color-bg)",
        borderLeft: "1px solid var(--color-border)",
        overflowY: "auto",
        boxShadow: "-2px 0 8px rgba(15,23,42,0.04)",
        zIndex: 10,
        fontFamily: "var(--font-sans)",
      }}
    >
      {node.status === "failed" && (
        <div
          data-testid="node-panel-failed-banner"
          style={{
            padding: "var(--space-3) var(--space-4)",
            background: "rgba(220, 38, 38, 0.08)",
            borderBottom: "1px solid var(--color-error)",
            color: "var(--color-error)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          [!] 节点未生成,可在顶部点重跑
        </div>
      )}

      <div
        style={{
          padding: "var(--space-5) var(--space-5) var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginBottom: "var(--space-2)",
              }}
            >
              <span
                data-testid="node-panel-category"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                {node.category}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-tertiary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {node.id}
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                lineHeight: 1.3,
              }}
            >
              {node.label}
            </h2>
          </div>
          <button
            data-testid="node-panel-close"
            onClick={onClose}
            aria-label="关闭"
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              color: "var(--color-text-secondary)",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      <section
        style={{
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-text-tertiary)",
            marginBottom: "var(--space-2)",
          }}
        >
          描述
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--color-text-primary)",
          }}
        >
          {node.description}
        </p>
      </section>

      <section
        style={{
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-text-tertiary)",
            marginBottom: "var(--space-2)",
          }}
        >
          状态
        </div>
        <div
          data-testid="node-panel-status"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-bg-elevated)",
            border: `1px solid ${statusInfo.color}`,
            fontSize: 12,
            color: statusInfo.color,
            fontWeight: 500,
          }}
        >
          {node.status === "generated" && "✓"}
          {node.status === "pending" && "⟳"}
          {node.status === "failed" && "✕"} {statusInfo.label}
        </div>

        {node.status === "failed" && node.failed_reason && (
          <div
            style={{
              marginTop: "var(--space-3)",
              padding: "var(--space-2) var(--space-3)",
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              color: "var(--color-error)",
              fontFamily: "var(--font-mono)",
              wordBreak: "break-word",
            }}
          >
            {node.failed_reason}
          </div>
        )}
      </section>

      <section
        style={{
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-2)",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-text-tertiary)",
            }}
          >
            入边
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {inEdges.length}
          </span>
        </div>
        {inEdges.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-tertiary)",
              fontStyle: "italic",
            }}
          >
            无入边
          </div>
        ) : (
          <ul
            data-testid="node-panel-in-edges"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {inEdges.map((e, idx) => {
              const fromNode = findNode(graph, e.source);
              return (
                <li
                  key={`in-${e.source}-${e.target}-${idx}`}
                  data-testid={`node-panel-in-edge-${e.source}`}
                  onClick={() => onEdgeClick?.(e)}
                  style={{
                    padding: "var(--space-2) 0",
                    borderBottom: "1px dashed var(--color-border)",
                    cursor: onEdgeClick ? "pointer" : "default",
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <Tooltip
                    content={e.explanation || RELATION_LABELS[e.relation_type]}
                  >
                    <span>
                      <span style={{ fontFamily: "var(--font-mono)" }}>
                        {e.source}
                      </span>{" "}
                      {fromNode ? fromNode.label : "未知节点"} → {node.id}
                    </span>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section style={{ padding: "var(--space-4) var(--space-5)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-2)",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-text-tertiary)",
            }}
          >
            出边
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {outEdges.length}
          </span>
        </div>
        {outEdges.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-tertiary)",
              fontStyle: "italic",
            }}
          >
            无出边
          </div>
        ) : (
          <ul
            data-testid="node-panel-out-edges"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {outEdges.map((e, idx) => {
              const toNode = findNode(graph, e.target);
              return (
                <li
                  key={`out-${e.source}-${e.target}-${idx}`}
                  data-testid={`node-panel-out-edge-${e.target}`}
                  onClick={() => onEdgeClick?.(e)}
                  style={{
                    padding: "var(--space-2) 0",
                    borderBottom: "1px dashed var(--color-border)",
                    cursor: onEdgeClick ? "pointer" : "default",
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <Tooltip
                    content={e.explanation || RELATION_LABELS[e.relation_type]}
                  >
                    <span>
                      {node.id} →{" "}
                      <span style={{ fontFamily: "var(--font-mono)" }}>
                        {e.target}
                      </span>{" "}
                      {toNode ? toNode.label : "未知节点"}
                    </span>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}

// Export helpers for test convenience
export { renderWeight, RELATION_LABELS as NODE_PANEL_RELATION_LABELS };
