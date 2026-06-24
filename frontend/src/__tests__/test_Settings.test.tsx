// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";
import { Settings } from "../pages/Settings";

expect.extend(matchers);

describe("Settings", () => {
  it("loads and shows provider tabs", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        active_provider: "claude",
        providers: { claude: { provider: "claude", api_key: "k", base_url: null, model: "m", extra: {} } },
        daily_token_budget: 100000,
      }),
    });
    // Nav uses useLocation → must be inside a Router.
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Claude")).toBeInTheDocument());
  });
});
