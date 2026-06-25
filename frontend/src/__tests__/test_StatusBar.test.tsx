// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { StatusBar } from "../components/StatusBar";
import type { GraphStats } from "../types/api";

expect.extend(matchers);
afterEach(() => cleanup());

const baseStats: GraphStats = { total: 96, generated: 87, failed: 9, pending: 0 };

describe("StatusBar", () => {
  it("renders title and statistics", () => {
    render(<StatusBar stats={baseStats} onRerun={() => {}} rerunning={false} />);
    expect(screen.getByText("行业知识图谱")).toBeInTheDocument();
    // 已生成 87 / 96
    expect(screen.getByTestId("status-bar-stats")).toHaveTextContent("已生成");
    expect(screen.getByTestId("status-bar-stats")).toHaveTextContent("87");
    expect(screen.getByTestId("status-bar-stats")).toHaveTextContent("96");
    // 失败 9
    expect(screen.getByTestId("status-bar-stats")).toHaveTextContent("失败");
    expect(screen.getByTestId("status-bar-stats")).toHaveTextContent("9");
  });

  it("shows rerun button only when failed > 0", () => {
    const { rerender } = render(
      <StatusBar
        stats={{ total: 10, generated: 10, failed: 0, pending: 0 }}
        onRerun={() => {}}
        rerunning={false}
      />
    );
    expect(screen.queryByTestId("status-bar-rerun")).not.toBeInTheDocument();

    rerender(
      <StatusBar
        stats={{ total: 10, generated: 7, failed: 3, pending: 0 }}
        onRerun={() => {}}
        rerunning={false}
      />
    );
    expect(screen.getByTestId("status-bar-rerun")).toBeInTheDocument();
    expect(screen.getByTestId("status-bar-rerun")).toHaveTextContent("重跑失败部分");
  });

  it("invokes onRerun when button clicked", () => {
    const onRerun = vi.fn();
    render(
      <StatusBar stats={baseStats} onRerun={onRerun} rerunning={false} />
    );
    fireEvent.click(screen.getByTestId("status-bar-rerun"));
    expect(onRerun).toHaveBeenCalledTimes(1);
  });

  it("disables button and shows rerunning state", () => {
    render(
      <StatusBar stats={baseStats} onRerun={() => {}} rerunning={true} />
    );
    const btn = screen.getByTestId("status-bar-rerun");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("重跑中...");
  });

  it("shows pending count when pending > 0", () => {
    render(
      <StatusBar
        stats={{ total: 10, generated: 5, failed: 0, pending: 5 }}
        onRerun={() => {}}
        rerunning={false}
      />
    );
    expect(screen.getByTestId("status-bar-stats")).toHaveTextContent("待生成");
    expect(screen.getByTestId("status-bar-stats")).toHaveTextContent("5");
  });

  it("does not show rerun button when rerunning but failed = 0", () => {
    render(
      <StatusBar
        stats={{ total: 10, generated: 10, failed: 0, pending: 0 }}
        onRerun={() => {}}
        rerunning={true}
      />
    );
    expect(screen.queryByTestId("status-bar-rerun")).not.toBeInTheDocument();
  });
});
