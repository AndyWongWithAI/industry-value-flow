import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { Sankey } from "../components/Sankey";
import type { SankeyData } from "../types/api";

export function HomePage() {
  const [data, setData] = useState<SankeyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.getIndustries().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!data) return <div>加载中...</div>;
  return (
    <div style={{ padding: 24 }}>
      <h1>行业价值流转</h1>
      <Sankey data={data} onIndustryClick={(id) => navigate(`/industry/${id}`)} />
    </div>
  );
}