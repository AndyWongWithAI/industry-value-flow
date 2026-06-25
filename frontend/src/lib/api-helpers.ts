// Re-export types from lib/api.ts for convenience.
// Avoids circular imports and lets test files import pure types.
export {
  getGraph,
  getNode,
  getEdge,
  getGraphStats,
  regenerateFailed,
  reExplainEdge,
  LLMUnavailableError,
} from "./api";
import type { KnowledgeGraph } from "../types/api";

export type ApiRegenerateFailedFn = (
  scope?: "all" | "nodes" | "edges"
) => Promise<{ job_id: string }>;

export type ApiReExplainEdgeFn = (
  source: string,
  target: string
) => Promise<{ explanation: string }>;

export type ApiGetGraphFn = () => Promise<KnowledgeGraph>;
