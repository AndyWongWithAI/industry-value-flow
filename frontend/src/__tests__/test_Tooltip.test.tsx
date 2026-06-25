// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { Tooltip } from "../components/Tooltip";

expect.extend(matchers);

// jsdom 不实现 getBoundingClientRect,提供兜底以便 Tooltip 拿到坐标
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

describe("Tooltip", () => {
  it("renders children and does not show content initially", () => {
    render(
      <Tooltip content="hello">
        <button>触发器</button>
      </Tooltip>
    );
    expect(screen.getByText("触发器")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });

  it("shows content on mouse enter, hides on mouse leave", () => {
    render(
      <Tooltip content="失败原因: LLM 超时">
        <button>hover me</button>
      </Tooltip>
    );
    const trigger = screen.getByTestId("tooltip-trigger");
    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent("失败原因");
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });

  it("shows content on focus (键盘可达)", () => {
    render(
      <Tooltip content="键盘可访问">
        <button>focus me</button>
      </Tooltip>
    );
    const trigger = screen.getByTestId("tooltip-trigger");
    fireEvent.focus(trigger);
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });

  it("accepts position=bottom prop without crashing", () => {
    render(
      <Tooltip content="下方" position="bottom">
        <span>x</span>
      </Tooltip>
    );
    const trigger = screen.getByTestId("tooltip-trigger");
    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
  });

  it("renders nothing inside content slot when content is empty (or falsy)", () => {
    // Tooltip 仍然渲染 children,但 visible=true 时 content 为空就不该有可见气泡
    render(
      <Tooltip content="">
        <span>x</span>
      </Tooltip>
    );
    const trigger = screen.getByTestId("tooltip-trigger");
    fireEvent.mouseEnter(trigger);
    // content === "" 是 falsy,我们内部用 truthy 守卫,所以不显示气泡
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });
});
