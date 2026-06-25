import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { Nav } from "../components/Nav";
import type {
  Settings as SettingsType,
  LLMProviderConfig,
} from "../types/api";

// T1 后:ProviderTabs.tsx 已删除,此处 inline provider 配置列表.
// T6 会重写为更友好的 UI.
type ProviderKey = LLMProviderConfig["provider"];

const PROVIDERS: Array<{
  key: ProviderKey;
  label: string;
  defaultModel: string;
  defaultBaseUrl?: string;
}> = [
  { key: "claude", label: "Claude", defaultModel: "claude-sonnet-4-5" },
  { key: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { key: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { key: "minimax", label: "MiniMax", defaultModel: "MiniMax-M3" },
  { key: "ollama", label: "Ollama(本地)", defaultModel: "llama3", defaultBaseUrl: "http://localhost:11434/v1" },
];

export function Settings() {
  const [s, setS] = useState<SettingsType | null>(null);
  const [activeKey, setActiveKey] = useState("claude");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient.getSettings().then((loaded) => {
      setS(loaded);
      setActiveKey(loaded.active_provider);
    });
  }, []);

  if (!s) return <div style={{ padding: 24 }}>加载中...</div>;

  const ensureConfig = (key: string): LLMProviderConfig => {
    if (s.providers[key]) return s.providers[key];
    const def = PROVIDERS.find((p) => p.key === key);
    if (!def) throw new Error(`unknown provider: ${key}`);
    return {
      provider: def.key,
      api_key: "",
      base_url: def.defaultBaseUrl ?? null,
      model: def.defaultModel,
      extra: {},
    };
  };

  const activeConfig = ensureConfig(activeKey);

  return (
    <div>
      <Nav />
      <div style={{ padding: 24, maxWidth: 720 }}>
        <h1>LLM 设置</h1>
        <p style={{ color: "#666" }}>
          配置你想用的 LLM 提供商。 点保存后生效。 知识图谱初始化会使用新配置重新生成。
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setActiveKey(p.key);
                setSaved(false);
              }}
              style={{
                fontWeight: activeKey === p.key ? "bold" : "normal",
                padding: "8px 16px",
                border: activeKey === p.key ? "2px solid #4a90e2" : "1px solid #ccc",
                borderRadius: 6,
                background: activeKey === p.key ? "#eaf3fc" : "white",
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* T1 inline ProviderTabs 功能(T6 会重写) */}
        <div>
          <label>
            API Key:
            <input
              value={activeConfig.api_key}
              onChange={(e) => {
                const c = { ...activeConfig, api_key: e.target.value };
                setS({ ...s, providers: { ...s.providers, [activeKey]: c } });
                setSaved(false);
              }}
            />
          </label>
          <label>
            Base URL(可选):
            <input
              value={activeConfig.base_url ?? ""}
              onChange={(e) => {
                const c = { ...activeConfig, base_url: e.target.value || null };
                setS({ ...s, providers: { ...s.providers, [activeKey]: c } });
                setSaved(false);
              }}
            />
          </label>
          <label>
            Model:
            <input
              value={activeConfig.model}
              onChange={(e) => {
                const c = { ...activeConfig, model: e.target.value };
                setS({ ...s, providers: { ...s.providers, [activeKey]: c } });
                setSaved(false);
              }}
            />
          </label>
        </div>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={async () => {
              const next = { ...s, active_provider: activeKey };
              await apiClient.postSettings(next);
              setS(next);
              setSaved(true);
            }}
            style={{
              padding: "8px 20px",
              background: "#4a90e2",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            保存
          </button>
          {saved && <span style={{ color: "#50c878" }}>✓ 已保存</span>}
        </div>
      </div>
    </div>
  );
}