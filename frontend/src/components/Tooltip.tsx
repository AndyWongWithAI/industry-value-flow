import { type ReactNode, useState, useRef, useEffect } from "react";

/**
 * 通用 hover tooltip(企业风 — 白底 + 阴影 + 圆角,无浮夸动画)。
 *
 * 设计决策(T6 §6.7):
 * - 不引入 popper.js / floating-ui 等第三方,简单 absolute 定位即可
 * - 触发方式:hover(纯视觉提示,不挡操作)
 * - 不传 children 时,只有 trigger + 文字,触发器用 <span> 包裹
 * - 失败原因用此组件展示,统一视觉规范
 *
 * 使用:
 *   <Tooltip content="LLM 超时">
 *     <button>...</button>
 *   </Tooltip>
 */
export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** 显示在触发器上方(top)还是下方(bottom),默认 top */
  position?: "top" | "bottom";
  /** z-index,默认 var(--z-tooltip) */
  zIndex?: number;
}

export function Tooltip({
  content,
  children,
  position = "top",
  zIndex,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(
    null
  );

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const top =
      position === "top"
        ? rect.top + window.scrollY - 8
        : rect.bottom + window.scrollY + 8;
    const left = rect.left + window.scrollX + rect.width / 2;
    setCoords({ left, top });
  }, [visible, position]);

  return (
    <span
      ref={triggerRef}
      style={{ display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      data-testid="tooltip-trigger"
    >
      {children}
      {visible && content && (
        <span
          role="tooltip"
          data-testid="tooltip-content"
          style={{
            position: "absolute",
            left: coords?.left ?? 0,
            top: coords?.top ?? 0,
            transform:
              position === "top"
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0)",
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: 12,
            lineHeight: 1.4,
            maxWidth: 280,
            boxShadow: "var(--shadow-md)",
            pointerEvents: "none",
            whiteSpace: "pre-wrap",
            zIndex: zIndex ?? undefined,
            // z-index fallback when var not loaded in test env
            ...(zIndex === undefined ? { zIndex: 1200 } : {}),
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
