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
  ],
  nodes: [
    { id: "a", label: "种植", layer: 0 },
    { id: "b", label: "消费", layer: 1 },
  ],
  edges: [{ source: "a", target: "b", value: 100 }],
};

describe("Sankey", () => {
  it("renders svg with data", () => {
    render(<Sankey data={mockData} />);
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
  });
});