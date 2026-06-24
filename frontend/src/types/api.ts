export type Industry = { id: string; name: string; color: string };
export type ValueFlowNode = { id: string; label: string; layer: number };
export type ValueFlowEdge = { source: string; target: string; value: number };
export type SankeyData = {
  industries: Industry[];
  nodes: ValueFlowNode[];
  edges: ValueFlowEdge[];
  source?: string | null;       // 新增:数据来源说明
  source_url?: string | null;   // 新增:原始数据链接
  year?: number | null;         // 新增:数据年度
  unit?: string;                // 新增:单位,默认 "亿元"
};
export type PainPoint = { title: string; description: string; severity: "low" | "medium" | "high" };
export type AIHelp = { use_case: string; capability: string; example: string; roi_estimate: string };
export type LLMGenerateResponse = {
  pain_points: PainPoint[];
  ai_helps: AIHelp[];
  status: "ok" | "degraded";
  provider: string;
};
export type LLMProviderConfig = {
  provider: "claude" | "openai" | "deepseek" | "minimax" | "ollama";
  api_key: string;
  base_url: string | null;
  model: string;
  extra: Record<string, unknown>;
};
export type Settings = {
  active_provider: string;
  providers: Record<string, LLMProviderConfig>;
  daily_token_budget: number;
};
