import { Link } from "react-router-dom";

/**
 * LLM 不可用时(或其他空态)展示的友好提示(T6 §6.7):
 *  - 居中卡片
 *  - 标题 + 副标题 + "前往设置"按钮(react-router Link)
 *  - 留可扩展的 iconSlot 供以后加图标
 *
 * 设计决策:
 *  - 用 react-router 的 <Link> 而不是 <a href>,保证 SPA 路由
 *  - EmptyState 是"通用空态",不耦合 LLM 文案 — 业务文案由 props 传入
 *  - 失败原因可由 reason 传入(可选),便于以后扩展其他空态
 */

export interface EmptyStateProps {
  title: string;
  subtitle?: string;
  /** "前往设置" 链接的目标路由,默认 /settings */
  actionTo?: string;
  actionLabel?: string;
  reason?: string;
}

export function EmptyState({
  title,
  subtitle,
  actionTo = "/settings",
  actionLabel = "前往设置",
  reason,
}: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 56px)",
        background: "var(--color-bg)",
        fontFamily: "var(--font-sans)",
        padding: "var(--space-8)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          padding: "var(--space-8) var(--space-7)",
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto var(--space-4)",
            fontSize: 24,
          }}
        >
          ⚠
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              margin: "var(--space-3) 0 var(--space-5)",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--color-text-secondary)",
            }}
          >
            {subtitle}
          </p>
        )}
        {reason && (
          <div
            data-testid="empty-state-reason"
            style={{
              margin: "0 auto var(--space-5)",
              padding: "var(--space-2) var(--space-3)",
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              color: "var(--color-error)",
              fontFamily: "var(--font-mono)",
              wordBreak: "break-word",
              textAlign: "left",
            }}
          >
            {reason}
          </div>
        )}
        <Link
          data-testid="empty-state-action"
          to={actionTo}
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: "var(--color-brand)",
            color: "var(--color-bg)",
            borderRadius: "var(--radius-md)",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
