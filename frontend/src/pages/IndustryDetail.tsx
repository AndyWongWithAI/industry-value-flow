import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { MiniSankey } from "../components/MiniSankey";
import { PainPanel } from "../components/PainPanel";
import type { SankeyData } from "../types/api";

export function IndustryDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SankeyData | null>(null);

  useEffect(() => {
    if (id) apiClient.getIndustry(id).then(setData);
  }, [id]);

  if (!data || !id) return <div>加载中...</div>;
  return (
    <div style={{ padding: 24, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
      <div>
        <h1>{data.industries[0].name}</h1>
        <MiniSankey data={data} />
      </div>
      <div>
        <PainPanel industryId={id} />
      </div>
    </div>
  );
}