import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from "d3-sankey";
import type { SankeyData, Industry } from "../types/api";

type Node = SankeyNode<{ id: string; label: string; color?: string }, { value: number }>;
type Link = SankeyLink<{ id: string; label: string; color?: string }, { value: number }>;

interface Props {
  data: SankeyData;
  width?: number;
  height?: number;
  onIndustryClick?: (id: string) => void;
}

// T6:子色阶(5 行业 × 5 色阶 = 25 色),每个行业一个深浅渐变调色板
const SUB_PALETTE: Record<string, string[]> = {
  agriculture: ["#4a90e2", "#5fa3e8", "#75b6ee", "#8bc9f4", "#a1dcfa"],
  manufacturing: ["#e94560", "#ed5e76", "#f1778c", "#f590a2", "#f9a9b8"],
  finance: ["#50c878", "#6ad28a", "#84dc9c", "#9ee6ae", "#b8f0c0"],
  education: ["#ffd700", "#ffe14d", "#ffeb7a", "#fff5a7", "#ffffd4"],
  healthcare: ["#9b59b6", "#a96dc1", "#b781cc", "#c595d7", "#d3a9e2"],
};

// node id 前缀 → 行业 id(后端 id 命名约定:agri/mfg/fin/edu/med)
const PREFIX_TO_INDUSTRY: Record<string, string> = {
  agri: "agriculture",
  mfg: "manufacturing",
  fin: "finance",
  edu: "education",
  med: "healthcare",
};

function colorFor(nodeId: string): string {
  const prefix = nodeId.split("_")[0];
  const industryId = PREFIX_TO_INDUSTRY[prefix];
  if (!industryId) return "#888";
  const palette = SUB_PALETTE[industryId];
  if (!palette) return "#888";
  // 用 "前缀之后的段数" 索引调色板(agri_planting → idx=1;agri_x_y → idx=2)
  const idx = Math.min(nodeId.split("_").length - 1, palette.length - 1);
  return palette[idx];
}

function industryOfNode(nodeId: string): string {
  const prefix = nodeId.split("_")[0];
  return PREFIX_TO_INDUSTRY[prefix] ?? prefix;
}

export function Sankey({ data, width = 960, height = 600, onIndustryClick }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // 构造 (nodeId → value) 用于 tooltip
    const valueLookup: Record<string, number> = {};
    data.edges.forEach((e) => {
      valueLookup[e.target] = (valueLookup[e.target] ?? 0) + e.value;
    });
    // 节点配色:子色阶优先,行业基础色 fallback(向后兼容旧 _root/_mid/_out)
    const colorMap: Record<string, string> = Object.fromEntries(
      data.industries.map((i: Industry) => [i.id, i.color])
    );
    const nodes = data.nodes.map((n) => ({
      ...n,
      color: colorFor(n.id) ?? colorMap[industryOfNode(n.id)] ?? "#888",
    }));
    // 过滤 value=0 的 edge(spec §4.2 + R3)
    const links = data.edges
      .filter((e) => e.value > 0)
      .map((e) => ({ ...e }));

    const generator = sankey<{ id: string; label: string; color?: string }, { value: number }>()
      .nodeId((d) => d.id)
      .nodeWidth(20)
      .nodePadding(10)
      .extent([[10, 10], [width - 10, height - 10]]);

    const graph = generator({ nodes, links });

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    svg.append("g")
      .attr("fill", "none")
      .attr("stroke-opacity", 0.4)
      .selectAll("path")
      .data(graph.links as Link[])
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", (d) => ((d.source as any).color ?? "#888"))
      .attr("stroke-width", (d) => Math.max(1, d.width ?? 1));

    svg.append("g")
      .selectAll("rect")
      .data(graph.nodes as Node[])
      .join("rect")
      .attr("x", (d) => d.x0 ?? 0)
      .attr("y", (d) => d.y0 ?? 0)
      .attr("width", (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
      .attr("height", (d) => Math.max(1, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr("fill", (d) => d.color ?? "#888")
      .style("cursor", "pointer")
      .on("click", (_, d: any) => {
        const id = industryOfNode(d.id as string);
        onIndustryClick?.(id);
      })
      // hover tooltip(SVG 原生 <title>,无需新库)
      .append("title")
      .text(
        (d: any) =>
          `${d.label}: ${(valueLookup[d.id] ?? 0).toLocaleString("zh-CN")} ${data.unit}`
      );

    svg.append("g")
      .style("font", "12px sans-serif")
      .selectAll("text")
      .data(graph.nodes as Node[])
      .join("text")
      .attr("x", (d) => ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2)
      .attr("y", (d) => (d.y0 ?? 0) - 4)
      .attr("text-anchor", "middle")
      .text((d) => d.label);
  }, [data, width, height, onIndustryClick]);

  return <svg ref={ref} role="img" data-testid="sankey-svg" />;
}