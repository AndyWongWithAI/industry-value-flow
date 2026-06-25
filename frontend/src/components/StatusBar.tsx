import type { GraphStats } from "../types/api";

/**
 * 顶部状态条(T6 §6.4):
 *  - 左侧"行业知识图谱"标题
 *  - 右侧统计 chip:"已生成 X / Y · 失败 Z"
 *  - failed > 0 时显示"重跑失败部分"按钮
 *  - rerunning 时按钮 disabled + 文案变更
 *  - sticky 在顶部,z-index 在 modal 之下
 *
 * 设计决策:
 *  - 状态条不持久化任何状态(无 useState),纯受控组件
 *  - 进度用 GraphStats(后端 T3 提供),不自己算
 *  - 不在状态条放"刷新图谱"按钮(spec 没要求,避免功能蔓延)
 */

export interface StatusBarProps {
  stats: GraphStats;
  onRerun: () => void;
  rerunning: boolean;
}

export function StatusBar({ stats, onRerun, rerunning }: StatusBarProps) {
  const { total, generated, failed, pending } = stats;
  const showRerun = failed > 0;

  return (
    <header
      data-testid="status-bar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        padding: "0 var(--space-6)",
        background: "var(--color-bg-elevated)",
        borderBottom: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          行业知识图谱
        </h1>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            padding: "2px 8px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-bg)",
          }}
        >
          GB/T 4754
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div
          data-testid="status-bar-stats"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            fontSize: 13,
            color: "var(--color-text-secondary)",
          }}
        >
          <span>
            已生成{" "}
            <strong style={{ color: "var(--color-success)" }}>
              {generated}
            </strong>{" "}
            / {total}
          </span>
          <span style={{ color: "var(--color-border)" }}>·</span>
          {pending > 0 && (
            <>
              <span>
                待生成{" "}
                <strong style={{ color: "var(--color-warning)" }}>
                  {pending}
                </strong>
              </span>
              <span style={{ color: "var(--color-border)" }}>·</span>
            </>
          )}
          <span>
            失败{" "}
            <strong
              style={{
                color: failed > 0 ? "var(--color-error)" : "var(--color-text-tertiary)",
              }}
            >
              {failed}
            </strong>
          </span>
        </div>

        {showRerun && (
          <button
            data-testid="status-bar-rerun"
            onClick={onRerun}
            disabled={rerunning}
            style={{
              padding: "6px 14px",
              background: rerunning
                ? "var(--color-bg-elevated)"
                : "var(--color-brand)",
              color: rerunning
                ? "var(--color-text-tertiary)"
                : "var(--color-bg)",
              border: rerunning
                ? "1px solid var(--color-border)"
                : "1px solid var(--color-brand)",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              fontWeight: 500,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!rerunning) {
                e.currentTarget.style.background = "var(--color-brand-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (!rerunning) {
                e.currentTarget.style.background = "var(--color-brand)";
              }
            }}
          >
            {rerunning ? "重跑中..." : "重跑失败部分"}
          </button>
        )}
      </div>
    </header>
  );
}
