// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { PainPanel } from "../components/PainPanel";

expect.extend(matchers);
beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("PainPanel", () => {
  it("shows loading then pain points", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pain_points: [{ title: "X", description: "Y", severity: "high" }],
        ai_helps: [],
        status: "ok",
        provider: "claude",
      }),
    });
    render(<PainPanel industryId="agriculture" />);
    expect(screen.getByText(/加载/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/\[high\] X/)).toBeInTheDocument());
  });

  it("shows degraded message on failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pain_points: [], ai_helps: [], status: "degraded", provider: "claude" }),
    });
    render(<PainPanel industryId="agriculture" />);
    await waitFor(() => expect(screen.getByText(/暂不可用/)).toBeInTheDocument());
  });
});