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

// ====================================================================
// 知识图谱(行业价值流转)— T5 引入,T1 完成后旧类型可删
// ====================================================================

/** GB/T 4754 大类(单字母),共 20 个门类 A-T */
export type Category =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
  | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T";

/** 边关系类型(4 种,语义见 spec §3.3) */
export type RelationType = "provide" | "rely_on" | "service" | "consume";

/** 节点/边生成状态(partial failure 机制,见 spec §4.4) */
export type NodeStatus = "pending" | "generated" | "failed";

/** GB/T 4754 中类(节点) */
export interface GraphNode {
  id: string;                          // GB/T 4754 中类代码,例 "C17"
  label: string;                       // 中文名,例 "纺织业"
  category: Category;                  // 大类(单字母)
  description: string;                 // LLM 生成的一句话描述
  status: NodeStatus;                  // 生成状态
  failed_reason?: string | null;       // 失败原因(若 status=failed)
  last_attempt_at?: string | null;     // ISO datetime
}

/** 行业间关系(边) */
export interface GraphEdge {
  source: string;                      // 起点节点 id
  target: string;                      // 终点节点 id
  relation_type: RelationType;         // 关系类型
  weight: number;                      // 强度 1-5
  explanation: string;                 // LLM 生成的一句话解释
  status: NodeStatus;
  failed_reason?: string | null;
  last_attempt_at?: string | null;
}

/** 整体知识图谱 */
export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  generated_at: string;                // ISO datetime
  llm_config_hash: string;             // 生成时 LLM config hash
  schema_version: "v1";
}
