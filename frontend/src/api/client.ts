import type { Settings } from "../types/api";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API ${path} failed: ${resp.status} ${err}`);
  }
  return resp.json();
}

// T1 阶段:旧 endpoint (getIndustries/getIndustry/generateLLM) 已删除,
// 等待 T4 替换为 /api/graph + /api/node/{id} + /api/edge/{sid}/{tid}/explain.
// 保留 LLM 设置相关 endpoint,因为 Settings 页仍需调用.
export const apiClient = {
  getSettings: () => request<Settings>("/settings/llm"),
  postSettings: (s: Settings) =>
    request<{ ok: boolean }>("/settings/llm", {
      method: "POST",
      body: JSON.stringify(s),
    }),
};