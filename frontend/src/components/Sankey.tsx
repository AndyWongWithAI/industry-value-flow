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

export function Sankey({ data, width = 960, height = 600, onIndustryClick }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const colorMap: Record<string, string> = Object.fromEntries(
      data.industries.map((i: Industry) => [i.id, i.color])
    );
    const nodes = data.nodes.map((n) => ({ ...n, color: colorMap[n.id.split("_")[0]] ?? "#888" }));
    const links = data.edges.map((e) => ({ ...e }));

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
      .attr("stroke", (d) => (d as any).source.color ?? "#888")
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
        const id = (d.id as string).split("_")[0];
        onIndustryClick?.(id);
      });

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