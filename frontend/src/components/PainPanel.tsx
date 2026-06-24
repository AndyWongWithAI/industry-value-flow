import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { LLMGenerateResponse } from "../types/api";

export function PainPanel({ industryId }: { industryId: string }) {
  const [data, setData] = useState<LLMGenerateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.generateLLM(industryId).then(setData).finally(() => setLoading(false));
  }, [industryId]);

  if (loading) return <div data-testid="pain-panel">加载痛点中...</div>;
  if (!data) return <div data-testid="pain-panel">暂无数据</div>;
  if (data.status === "degraded") {
    return <div data-testid="pain-panel" style={{ color: "#888" }}>AI 分析暂不可用,Sankey 数据正常</div>;
  }
  return (
    <div data-testid="pain-panel">
      <h3>痛点</h3>
      <ul>
        {data.pain_points.map((p, i) => (
          <li key={i}>
            <strong>[{p.severity}] {p.title}</strong> — {p.description}
          </li>
        ))}
      </ul>
      <h3>AI 帮助</h3>
      <ul>
        {data.ai_helps.map((h, i) => (
          <li key={i}>
            <strong>{h.use_case}</strong>({h.capability}):{h.example} — ROI {h.roi_estimate}
          </li>
        ))}
      </ul>
      <small>by {data.provider}</small>
    </div>
  );
}