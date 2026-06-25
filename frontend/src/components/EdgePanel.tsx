import type { GraphEdge, GraphNode, RelationType } from "../types/api";
import { renderWeight } from "./NodePanel";

/**
 * 边详情面板(T6 §6.6):
 *  - 顶部:源节点 → 目标节点(代码 + 中文名)
 *  - 关系类型(中文)+ 强度(●●●○○)
 *  - 状态 + 解释(支持"正在生成..."/真实解释)
 *  - 重新解释按钮:调用 T4 端点,T4 还没做,先 stub
 *
 * 设计决策:
 *  - 不在面板里跑 LLM,只触发回调,由 GraphPage 决定怎么请求
 *  - 解释正在生成时:状态条显示⟳(琥珀色),不阻塞操作
 *  - 解释失败时:显示 failed_reason 区域,沿用 NodePanel 视觉规范
 */

const RELATION_LABELS: Record<RelationType, string> = {
  provide: "支撑",
  rely_on: "依赖",
  service: "服务",
  consume: "消费",
};

export interface EdgePanelProps {
  edge: GraphEdge;
  sourceNode?: GraphNode | null;
  targetNode?: GraphNode | null;
  onClose: () => void;
  onReExplain: () => void;
  reExplaining: boolean;
}

export function EdgePanel({
  edge,
  sourceNode,
  targetNode,
  onClose,
  onReExplain,
  reExplaining,
}: EdgePanelProps) {
  const relationLabel = RELATION_LABELS[edge.relation_type];
  const isGenerating = edge.status === "pending";
  const isFailed = edge.status === "failed";

  return (
    <aside
      data-testid="edge-panel"
      aria-label="边详情"
      style={{
        position: "fixed",
        right: 0,
        top: 56,
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
            marginBottom: "var(--space-3)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-text-tertiary)",
            }}
          >
            边详情
          </h2>
          <button
            data-testid="edge-panel-close"
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
        <div
          data-testid="edge-panel-nodes"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: 1.4,
          }}
        >
          <span data-testid="edge-panel-source">
            {sourceNode ? sourceNode.label : edge.source}
          </span>
          <span
            style={{
              margin: "0 var(--space-2)",
              color: "var(--color-text-tertiary)",
              fontWeight: 400,
            }}
          >
            →
          </span>
          <span data-testid="edge-panel-target">
            {targetNode ? targetNode.label : edge.target}
          </span>
        </div>
        <div
          style={{
            marginTop: "var(--space-2)",
            display: "flex",
            gap: "var(--space-2)",
            alignItems: "center",
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>{edge.source}</span>
          <span>→</span>
          <span>{edge.target}</span>
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
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-3)",
            fontSize: 13,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                marginBottom: 4,
              }}
            >
              关系
            </div>
            <div
              data-testid="edge-panel-relation"
              style={{
                display: "inline-block",
                padding: "2px 8px",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-brand)",
                fontWeight: 500,
              }}
            >
              {relationLabel}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                marginBottom: 4,
              }}
            >
              强度
            </div>
            <div
              data-testid="edge-panel-weight"
              style={{
                fontSize: 16,
                color: "var(--color-brand)",
                letterSpacing: 2,
              }}
              title={`${edge.weight} / 5`}
            >
              {renderWeight(edge.weight)}
            </div>
          </div>
        </div>
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
          data-testid="edge-panel-status"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-bg-elevated)",
            border: `1px solid ${
              edge.status === "generated"
                ? "var(--color-success)"
                : edge.status === "pending"
                ? "var(--color-warning)"
                : "var(--color-error)"
            }`,
            fontSize: 12,
            color:
              edge.status === "generated"
                ? "var(--color-success)"
                : edge.status === "pending"
                ? "var(--color-warning)"
                : "var(--color-error)",
            fontWeight: 500,
          }}
        >
          {edge.status === "generated" && "✓ 已生成"}
          {edge.status === "pending" && "⟳ 生成中"}
          {edge.status === "failed" && "✕ 生成失败"}
        </div>
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
          解释
        </div>
        {isGenerating ? (
          <div
            data-testid="edge-panel-explanation-loading"
            style={{
              padding: "var(--space-3)",
              background: "var(--color-bg-elevated)",
              border: "1px dashed var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              color: "var(--color-warning)",
              fontStyle: "italic",
            }}
          >
            正在生成...
          </div>
        ) : isFailed ? (
          <div>
            <div
              data-testid="edge-panel-explanation-failed"
              style={{
                padding: "var(--space-3)",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-error)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                color: "var(--color-error)",
              }}
            >
              解释生成失败
            </div>
            {edge.failed_reason && (
              <div
                style={{
                  marginTop: "var(--space-2)",
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
                {edge.failed_reason}
              </div>
            )}
          </div>
        ) : (
          <p
            data-testid="edge-panel-explanation"
            style={{
              margin: 0,
              padding: "var(--space-3)",
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--color-text-primary)",
            }}
          >
            {edge.explanation}
          </p>
        )}
      </section>

      <section style={{ padding: "var(--space-4) var(--space-5)" }}>
        <button
          data-testid="edge-panel-reexplain"
          onClick={onReExplain}
          disabled={reExplaining}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "8px 16px",
            background: reExplaining
              ? "var(--color-bg-elevated)"
              : "var(--color-brand)",
            color: reExplaining
              ? "var(--color-text-tertiary)"
              : "var(--color-bg)",
            border: reExplaining
              ? "1px solid var(--color-border)"
              : "1px solid var(--color-brand)",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {reExplaining ? "重新解释中..." : "✨ 重新解释"}
        </button>
      </section>
    </aside>
  );
}

export { RELATION_LABELS as EDGE_PANEL_RELATION_LABELS };
