import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../api/client";

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getIndustries fetches /api/industries", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ industries: [], nodes: [], edges: [] }),
    });
    global.fetch = mock;
    const data = await apiClient.getIndustries();
    expect(mock.mock.calls[0][0]).toBe("/api/industries");
    expect(data.industries).toEqual([]);
  });

  it("generateLLM posts body with industry_id", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pain_points: [], ai_helps: [], status: "ok", provider: "claude" }),
    });
    global.fetch = mock;
    await apiClient.generateLLM("agriculture");
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe("/api/llm/generate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ industry_id: "agriculture", force_refresh: false });
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    await expect(apiClient.getIndustries()).rejects.toThrow(/failed: 500/);
  });

  it("getIndustries includes source/year/unit/source_url fields", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        industries: [],
        nodes: [],
        edges: [],
        source: "国家统计局 2024",
        source_url: "https://x",
        year: 2024,
        unit: "亿元",
      }),
    });
    global.fetch = mock;
    const data = await apiClient.getIndustries();
    expect(data.year).toBe(2024);
    expect(data.unit).toBe("亿元");
    expect(data.source).toContain("国家统计局");
  });
});