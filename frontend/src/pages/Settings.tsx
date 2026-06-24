import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { ProviderTabs, PROVIDERS } from "../components/ProviderTabs";
import { Nav } from "../components/Nav";
import type { Settings as SettingsType, LLMProviderConfig } from "../types/api";

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
          配置你想用的 LLM 提供商。 点保存后生效。 痛点面板会立即用新配置重新生成。
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
        <ProviderTabs
          current={activeConfig}
          onChange={(c) => {
            setS({ ...s, providers: { ...s.providers, [activeKey]: c } });
            setSaved(false);
          }}
        />
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