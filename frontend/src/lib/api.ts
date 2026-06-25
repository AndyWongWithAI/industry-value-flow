import type { GraphStats, KnowledgeGraph } from "../types/api";

/**
 * T6 阶段:API stub(等 T4 接入真实后端)。
 *
 * 设计决策:
 *  - 单一 fetch 封装,后端未就绪时全部抛 LLMUnavailableError 或返回 mock
 *  - 全部函数 async(对齐真实 fetch 形态)
 *  - 不在本文件做缓存/重试(spec 没要求,后续由 GraphPage 决定)
 *  - 错误类型:LLMUnavailableError(LLM 没配置/服务不可用) + 通用 Error
 *
 * 切到真实后端时:
 *  - 把 `useMock` 改成 `false` 即可
 *  - 或在 GraphPage 启动时拉 /api/health 判断
 */

const BASE = "/api";

/** T4 完成前默认 true;T4 完成时改为 false */
const useMock = true;

/** LLM 不可用错误 — 用于 EmptyState 触发 */
export class LLMUnavailableError extends Error {
  readonly code = "LLM_UNAVAILABLE";
  constructor(message = "LLM 服务不可用,请先在设置中配置 LLM") {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (resp.status === 503 || resp.status === 502) {
    throw new LLMUnavailableError();
  }
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API ${path} failed: ${resp.status} ${err}`);
  }
  return resp.json();
}

// ----------------------------------------------------------------
// Mock 数据(等 T4 接入,移除整段)
// ----------------------------------------------------------------

const MOCK_GRAPH: KnowledgeGraph = {
  nodes: [
    {
      id: "B06",
      label: "煤炭开采和洗选业",
      category: "B",
      description: "煤炭的开采、洗选与初步加工",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      id: "D44",
      label: "电力、热力生产和供应业",
      category: "D",
      description: "电力与热力的生产、输送与供应",
      status: "failed",
      failed_reason: "LLM API 503(限流)",
      last_attempt_at: null,
    },
    {
      id: "C17",
      label: "纺织业",
      category: "C",
      description: "纺织纤维的加工与织造",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      id: "C26",
      label: "化学原料和化学制品制造业",
      category: "C",
      description: "基础化学原料和化学制品的生产",
      status: "pending",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  edges: [
    {
      source: "B06",
      target: "D44",
      relation_type: "provide",
      weight: 4,
      explanation: "煤炭是火力发电的主要燃料",
      status: "generated",
      failed_reason: null,
      last_attempt_at: null,
    },
    {
      source: "D44",
      target: "C17",
      relation_type: "service",
      weight: 3,
      explanation: "纺织业生产高度依赖电力供应",
      status: "failed",
      failed_reason: "模型超时 30s",
      last_attempt_at: null,
    },
    {
      source: "C26",
      target: "C17",
      relation_type: "provide",
      weight: 5,
      explanation: "化学制品为纺织业提供染料、助剂",
      status: "pending",
      failed_reason: null,
      last_attempt_at: null,
    },
  ],
  generated_at: "2026-06-25T00:00:00Z",
  llm_config_hash: "mock",
  schema_version: "v1",
};

const MOCK_STATS: GraphStats = {
  total: 4,
  generated: 2,
  failed: 1,
  pending: 1,
};

// ----------------------------------------------------------------
// 导出 API(签名对齐 T4 即将实现的真实端点)
// ----------------------------------------------------------------

/** 拉取完整知识图谱(T4: GET /api/graph) */
export function getGraph(): Promise<KnowledgeGraph> {
  if (useMock) {
    return new Promise((resolve) =>
      setTimeout(() => resolve(MOCK_GRAPH), 50)
    );
  }
  return request<KnowledgeGraph>("/graph");
}

/** 拉取单节点详情(T4: GET /api/node/{id})— 当前用 getGraph() 内查 */
export function getNode(id: string): Promise<KnowledgeGraph["nodes"][number] | null> {
  if (useMock) {
    return new Promise((resolve) =>
      setTimeout(
        () => resolve(MOCK_GRAPH.nodes.find((n) => n.id === id) ?? null),
        30
      )
    );
  }
  return request<KnowledgeGraph["nodes"][number]>(`/node/${encodeURIComponent(id)}`);
}

/** 拉取单边详情 — 当前用 getGraph() 内查 */
export function getEdge(
  edgeId: string
): Promise<KnowledgeGraph["edges"][number] | null> {
  if (useMock) {
    return new Promise((resolve) =>
      setTimeout(
        () =>
          resolve(
            MOCK_GRAPH.edges.find(
              (e) =>
                (e as { id?: string }).id === edgeId ||
                `${e.source}-${e.target}` === edgeId
            ) ?? null
          ),
        30
      )
    );
  }
  return request<KnowledgeGraph["edges"][number]>(
    `/edge/${encodeURIComponent(edgeId)}`
  );
}

/** 拉取图谱统计 — spec §4.4 partial failure 状态条用(T4: GET /api/graph/stats) */
export function getGraphStats(): Promise<GraphStats> {
  if (useMock) {
    return new Promise((resolve) =>
      setTimeout(() => resolve(MOCK_STATS), 30)
    );
  }
  return request<GraphStats>("/graph/stats");
}

/** 重跑失败节点/边(T4: POST /api/graph/regenerate-failed) */
export function regenerateFailed(_scope: "all" | "nodes" | "edges" = "all"): Promise<{ job_id: string }> {
  if (useMock) {
    return new Promise((resolve) =>
      setTimeout(() => resolve({ job_id: "mock-job-001" }), 30)
    );
  }
  return request<{ job_id: string }>("/graph/regenerate-failed", {
    method: "POST",
    body: JSON.stringify({ scope: _scope }),
  });
}

/** 重新解释单边(T4: GET /api/edge/{edgeId}/explain,edgeId 形如 "B06-C17"). */
export function explainEdge(
  edgeId: string
): Promise<{ explanation: string }> {
  if (useMock) {
    return new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            explanation: `[重新生成] ${edgeId} 的关系解释...`,
          }),
        30
      )
    );
  }
  return request<{ explanation: string }>(
    `/edge/${encodeURIComponent(edgeId)}/explain`
  );
}
