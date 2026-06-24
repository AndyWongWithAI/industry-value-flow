import { Sankey } from "./Sankey";
import type { SankeyData } from "../types/api";

export function MiniSankey({ data }: { data: SankeyData }) {
  return <Sankey data={data} width={600} height={400} />;
}