// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { Tooltip } from "../components/Tooltip";
import { readTokensCss } from "../styles/tokens-content";

expect.extend(matchers);

afterEach(() => cleanup());

/**
 * v6:删除了 GraphView / GraphNode(react-flow 弃用,改用 react-force-graph-2d)。
 * 失败节点的 tooltip 行为现在由 react-force-graph 自带的 nodeLabel 机制 +
 * NodePanel 负责承载,不再用 DOM `title` 属性。
 *
 * 这里只保留 Tooltip 组件和 CSS tokens 的测试。
 */

describe("Tooltip 显示 failed_reason(T6 §6.8 #7)", () => {
  it("可以用 Tooltip 包装任意元素显示自定义 failed_reason", () => {
    render(
      <Tooltip content="生成失败: LLM 超时(30s)">
        <button>失败节点</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByTestId("tooltip-trigger"));
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent("LLM 超时");
  });
});

describe("CSS variables 在 document.documentElement 存在(T6 §6.8 #8)", () => {
  const tokensCss = readTokensCss();

  it("tokens.css 包含核心 CSS 变量定义", () => {
    // 直接读 css 源码确认 — jsdom 不会解析 :root var() 注入
    expect(tokensCss).toContain("--color-bg: #FFFFFF");
    expect(tokensCss).toContain("--color-text-primary: #0F172A");
    expect(tokensCss).toContain("--color-brand: #1A4D8F");
    expect(tokensCss).toContain("--color-error: #DC2626");
    expect(tokensCss).toContain("--color-success: #16A34A");
    expect(tokensCss).toContain("--font-sans:");
    expect(tokensCss).toContain("--font-mono:");
    expect(tokensCss).toContain("--space-1: 4px");
    expect(tokensCss).toContain("--space-8: 48px");
    expect(tokensCss).toContain("--radius-md: 8px");
    expect(tokensCss).toContain("--z-tooltip: 1200");
  });

  it("从 tokens.css 源码中能解析出所有 :root CSS 变量名", () => {
    // 用正则解析 css 文本里 :root { ... } 块的变量名
    const rootBlock = tokensCss.match(/:root\s*\{([\s\S]*?)\}/);
    expect(rootBlock).not.toBeNull();
    const body = rootBlock![1];
    const varNames = Array.from(body.matchAll(/--([\w-]+)\s*:/g)).map(
      (m) => `--${m[1]}`
    );
    // 必须包含的 token(spec §8.2 全部)
    const required = [
      "--color-bg",
      "--color-bg-elevated",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-tertiary",
      "--color-border",
      "--color-brand",
      "--color-brand-hover",
      "--color-error",
      "--color-success",
      "--color-warning",
      "--font-sans",
      "--font-mono",
      "--space-1",
      "--space-2",
      "--space-3",
      "--space-4",
      "--space-5",
      "--space-6",
      "--space-7",
      "--space-8",
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--shadow-sm",
      "--shadow-md",
      "--z-modal",
      "--z-toast",
      "--z-tooltip",
    ];
    for (const r of required) {
      expect(varNames, `missing CSS var ${r}`).toContain(r);
    }
  });
});