// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";

expect.extend(matchers);
afterEach(() => cleanup());

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter initialEntries={["/"]}>{ui}</MemoryRouter>);
}

describe("EmptyState", () => {
  it("renders title and subtitle", () => {
    renderWithRouter(
      <EmptyState
        title="请先配置 LLM"
        subtitle="本平台依赖 LLM 生成行业关系图,未配置无法展示"
      />
    );
    expect(screen.getByText("请先配置 LLM")).toBeInTheDocument();
    expect(
      screen.getByText("本平台依赖 LLM 生成行业关系图,未配置无法展示")
    ).toBeInTheDocument();
  });

  it("renders a '前往设置' link pointing to /settings", () => {
    renderWithRouter(<EmptyState title="t" subtitle="s" />);
    const link = screen.getByTestId("empty-state-action");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/settings");
    expect(link).toHaveTextContent("前往设置");
  });

  it("accepts custom actionTo and actionLabel", () => {
    renderWithRouter(
      <EmptyState
        title="t"
        actionTo="/api-docs"
        actionLabel="查看文档"
      />
    );
    const link = screen.getByTestId("empty-state-action");
    expect(link).toHaveAttribute("href", "/api-docs");
    expect(link).toHaveTextContent("查看文档");
  });

  it("shows reason section when reason prop is provided", () => {
    renderWithRouter(
      <EmptyState
        title="生成失败"
        subtitle="请稍后重试"
        reason="LLM 服务返回 503"
      />
    );
    expect(screen.getByTestId("empty-state-reason")).toHaveTextContent("503");
  });

  it("does not render reason section when reason is omitted", () => {
    renderWithRouter(<EmptyState title="t" />);
    expect(screen.queryByTestId("empty-state-reason")).not.toBeInTheDocument();
  });
});
