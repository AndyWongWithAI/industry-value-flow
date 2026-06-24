// @vitest-environment jsdom
import { expect, describe, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { Sankey } from "../components/Sankey";
import type { SankeyData } from "../types/api";

expect.extend(matchers);

const mockData: SankeyData = {
  industries: [
    { id: "agriculture", name: "农业", color: "#4a90e2" },
    { id: "manufacturing", name: "制造业", color: "#e94560" },
  ],
  nodes: [
    { id: "agri_planting", label: "种植业", layer: 0 },
    { id: "agri_forestry", label: "林业", layer: 0 },
    { id: "mfg_auto", label: "汽车制造业", layer: 0 },
    { id: "consumer", label: "消费端", layer: 2 },
  ],
  edges: [
    { source: "agri_planting", target: "consumer", value: 60000 },
    { source: "agri_forestry", target: "consumer", value: 6000 },
    { source: "mfg_auto", target: "consumer", value: 10800 },
  ],
  source: "国家统计局 2024",
  source_url: "https://data.stats.gov.cn/",
  year: 2024,
  unit: "亿元",
};

describe("Sankey", () => {
  it("renders svg with data", () => {
    render(<Sankey data={mockData} />);
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
  });

  it("uses sub-palette for sub-industry node ids", () => {
    // 节点 id 前缀 agri_* → 农业子色阶(蓝色阶),不再是单色 #4a90e2
    const { container } = render(<Sankey data={mockData} />);
    const rects = container.querySelectorAll("rect");
    const fills = Array.from(rects).map((r) => r.getAttribute("fill"));
    // 至少有一种蓝色(#4a90e2 / #5fa3e8 / #75b6ee...),不能全是 #888
    expect(
      fills.some(
        (f) =>
          f?.startsWith("#4") || f?.startsWith("#5") || f?.startsWith("#7")
      )
    ).toBe(true);
  });

  it("renders hover tooltip with value + unit", () => {
    const { container } = render(<Sankey data={mockData} />);
    const titles = container.querySelectorAll("title");
    // 至少有 1 个 title 节点带 value + 单位
    const texts = Array.from(titles).map((t) => t.textContent ?? "");
    expect(texts.some((t) => t.includes("种植业") && t.includes("亿元"))).toBe(
      true
    );
  });
});