import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../api/client";

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getSettings fetches /api/settings/llm", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active_provider: "claude",
        providers: {},
        daily_token_budget: 100000,
      }),
    });
    global.fetch = mock;
    await apiClient.getSettings();
    expect(mock.mock.calls[0][0]).toBe("/api/settings/llm");
  });

  it("postSettings posts JSON to /api/settings/llm", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    global.fetch = mock;
    await apiClient.postSettings({
      active_provider: "claude",
      providers: {},
      daily_token_budget: 100000,
    });
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe("/api/settings/llm");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      active_provider: "claude",
      providers: {},
      daily_token_budget: 100000,
    });
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    await expect(apiClient.getSettings()).rejects.toThrow(/failed: 500/);
  });
});