// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { GraphView } from "../components/GraphView";
import { GraphNode } from "../components/GraphNode";
import { Tooltip } from "../components/Tooltip";
import type { KnowledgeGraph } from "../types/api";
import { readTokensCss } from "../styles/tokens-content";

expect.extend(matchers);

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;
if (!Element.prototype.getBoundingClientRect) {
  Element.prototype.getBoundingClientRect = function () {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
}

afterEach(() => cleanup());

describe("failed node hover tooltip(T6 §6.8 #7)", () => {
  it("失败节点 GraphNode 在原生 title 里包含 failed_reason", () => {
    // 验证 T5 的现有实现(GraphNode 自身有 title 属性作为最简 tooltip)
    const graph: KnowledgeGraph = {
      nodes: [
        {
          id: "B06",
          label: "煤炭",
          category: "B",
          description: "煤炭",
          status: "failed",
          failed_reason: "模型返回 502",
          last_attempt_at: null,
        },
      ],
      edges: [],
      generated_at: "",
      llm_config_hash: "",
      schema_version: "v1",
    };
    render(<GraphView graph={graph} />);
    const node = screen.getByTestId("graph-node-煤炭");
    const title = node.getAttribute("title") || "";
    expect(title).toContain("生成失败");
    expect(title).toContain("模型返回 502");
  });

  it("未失败节点 title 不含 '生成失败' 前缀", () => {
    const graph: KnowledgeGraph = {
      nodes: [
        {
          id: "B06",
          label: "煤炭",
          category: "B",
          description: "煤炭的开采",
          status: "generated",
          failed_reason: null,
          last_attempt_at: null,
        },
      ],
      edges: [],
      generated_at: "",
      llm_config_hash: "",
      schema_version: "v1",
    };
    render(<GraphView graph={graph} />);
    const node = screen.getByTestId("graph-node-煤炭");
    const title = node.getAttribute("title") || "";
    expect(title).not.toContain("生成失败");
  });
});

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
