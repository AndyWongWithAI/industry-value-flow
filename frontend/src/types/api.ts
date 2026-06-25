// ====================================================================
// 知识图谱(行业价值流转)— spec §3
// T1 后:SankeyData / ValueFlowNode / ValueFlowEdge / Industry /
//         PainPoint / AIHelp / LLMGenerateResponse 全部删除.
// ====================================================================

/** GB/T 4754 大类(单字母),共 20 个门类 A-T */
export type Category =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
  | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T";

/** 边关系类型(v2 收敛为单一 supports,见 spec §3.3)
 *  语义:A → B = A 支撑 B(单向;禁止反向)
 */
export type RelationType = "supports";

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
  id?: string;                         // 后端合成的边 id(形如 "B06-C17");fallback 用 source-target
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

/** 图生成统计(用于 partial failure 状态条,见 spec §4.4) */
export interface GraphStats {
  generated: number;
  failed: number;
  total: number;
  pending: number;
}

// ====================================================================
// LLM 设置(spec §6.3 保留,沿用旧 spec 设定)
// ====================================================================

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