// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getGraph,
  getNode,
  getEdge,
  getGraphStats,
  regenerateFailed,
  explainEdge,
  LLMUnavailableError,
} from "../lib/api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lib/api (mock mode)", () => {
  it("getGraph returns a KnowledgeGraph with nodes and edges", async () => {
    const g = await getGraph();
    expect(g.nodes.length).toBeGreaterThan(0);
    expect(g.edges.length).toBeGreaterThan(0);
    expect(g.schema_version).toBe("v1");
  });

  it("getNode returns the matching node or null", async () => {
    const n = await getNode("B06");
    expect(n).not.toBeNull();
    expect(n!.id).toBe("B06");

    const missing = await getNode("DOES_NOT_EXIST");
    expect(missing).toBeNull();
  });

  it("getEdge returns the matching edge by edgeId (source-target) or null", async () => {
    const e = await getEdge("B06-D44");
    expect(e).not.toBeNull();
    expect(e!.source).toBe("B06");
    expect(e!.target).toBe("D44");

    const missing = await getEdge("B06-C99");
    expect(missing).toBeNull();
  });

  it("getGraphStats returns the partial-failure counts", async () => {
    const s = await getGraphStats();
    expect(s.total).toBe(s.generated + s.failed + s.pending);
  });

  it("regenerateFailed returns a job id", async () => {
    const r = await regenerateFailed("all");
    expect(r.job_id).toBeTruthy();
  });

  it("explainEdge returns an explanation string", async () => {
    const r = await explainEdge("B06-D44");
    expect(typeof r.explanation).toBe("string");
  });

  it("LLMUnavailableError has code=LLM_UNAVAILABLE", () => {
    const err = new LLMUnavailableError();
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("LLM_UNAVAILABLE");
    expect(err.name).toBe("LLMUnavailableError");
  });
});
