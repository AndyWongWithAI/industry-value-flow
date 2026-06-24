import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from schema.settings import Settings, LLMProviderConfig


@pytest.mark.asyncio
async def test_get_settings_default(tmp_path, monkeypatch):
    """GET /api/settings/llm returns default settings when no file exists."""
    monkeypatch.setenv("IVF_CONFIG_DIR", str(tmp_path))
    # Reload config module so it picks up the new IVF_CONFIG_DIR
    import importlib
    import config
    importlib.reload(config)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/settings/llm")
    assert resp.status_code == 200
    body = resp.json()
    assert "active_provider" in body


@pytest.mark.asyncio
async def test_post_settings_roundtrip(tmp_path, monkeypatch):
    """POST saves settings; subsequent GET returns the saved value."""
    monkeypatch.setenv("IVF_CONFIG_DIR", str(tmp_path))
    import importlib
    import config
    importlib.reload(config)

    transport = ASGITransport(app=app)
    s = Settings(
        active_provider="deepseek",
        providers={"deepseek": LLMProviderConfig(provider="deepseek", api_key="k1", base_url=None, model="deepseek-chat", extra={})},
        daily_token_budget=50000,
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/settings/llm", json=s.model_dump())
        assert resp.status_code == 200
        resp2 = await client.get("/api/settings/llm")
    assert resp2.json()["active_provider"] == "deepseek"