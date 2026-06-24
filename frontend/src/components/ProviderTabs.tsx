import type { LLMProviderConfig } from "../types/api";

const PROVIDERS: Array<{ key: string; label: string; defaultModel: string; defaultBaseUrl?: string }> = [
  { key: "claude", label: "Claude", defaultModel: "claude-sonnet-4-5" },
  { key: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { key: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { key: "minimax", label: "MiniMax", defaultModel: "MiniMax-Text-01" },
  { key: "ollama", label: "Ollama(本地)", defaultModel: "llama3", defaultBaseUrl: "http://localhost:11434/v1" },
];

interface Props {
  current: LLMProviderConfig;
  onChange: (next: LLMProviderConfig) => void;
}

export function ProviderTabs({ current, onChange }: Props) {
  return (
    <div>
      <label>API Key:<input value={current.api_key} onChange={(e) => onChange({ ...current, api_key: e.target.value })} /></label>
      <label>Base URL(可选):<input value={current.base_url ?? ""} onChange={(e) => onChange({ ...current, base_url: e.target.value || null })} /></label>
      <label>Model:<input value={current.model} onChange={(e) => onChange({ ...current, model: e.target.value })} /></label>
    </div>
  );
}

export { PROVIDERS };