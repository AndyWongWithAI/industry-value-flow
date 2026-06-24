import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { ProviderTabs, PROVIDERS } from "../components/ProviderTabs";
import type { Settings as SettingsType, LLMProviderConfig } from "../types/api";

export function Settings() {
  const [s, setS] = useState<SettingsType | null>(null);
  const [activeKey, setActiveKey] = useState("claude");

  useEffect(() => {
    apiClient.getSettings().then((loaded) => {
      setS(loaded);
      setActiveKey(loaded.active_provider);
    });
  }, []);

  if (!s) return <div>加载中...</div>;

  const ensureConfig = (key: string): LLMProviderConfig => {
    if (s.providers[key]) return s.providers[key];
    const def = PROVIDERS.find((p) => p.key === key)!;
    return {
      provider: key as any,
      api_key: "",
      base_url: def.defaultBaseUrl ?? null,
      model: def.defaultModel,
      extra: {},
    };
  };

  const activeConfig = ensureConfig(activeKey);

  return (
    <div style={{ padding: 24 }}>
      <h1>LLM 设置</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActiveKey(p.key)}
            style={{ fontWeight: activeKey === p.key ? "bold" : "normal" }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <ProviderTabs
        current={activeConfig}
        onChange={(c) => setS({ ...s, providers: { ...s.providers, [activeKey]: c } })}
      />
      <button
        onClick={async () => {
          const next = { ...s, active_provider: activeKey };
          await apiClient.postSettings(next);
          setS(next);
        }}
        style={{ marginTop: 16 }}
      >
        保存
      </button>
    </div>
  );
}