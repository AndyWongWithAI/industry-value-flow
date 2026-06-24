import type { SankeyData, LLMGenerateResponse, Settings } from "../types/api";

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

export const apiClient = {
  getIndustries: () => request<SankeyData>("/industries"),
  getIndustry: (id: string) => request<SankeyData>(`/industry/${id}`),
  generateLLM: (industry_id: string, force_refresh = false) =>
    request<LLMGenerateResponse>("/llm/generate", {
      method: "POST",
      body: JSON.stringify({ industry_id, force_refresh }),
    }),
  getSettings: () => request<Settings>("/settings/llm"),
  postSettings: (s: Settings) =>
    request<{ ok: boolean }>("/settings/llm", {
      method: "POST",
      body: JSON.stringify(s),
    }),
};