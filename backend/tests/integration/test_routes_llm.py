import pytest
import respx
from httpx import AsyncClient, ASGITransport, Response
from main import app

from config import save_settings, get_db_path
from schema.settings import Settings, LLMProviderConfig
from domain.storage.llm_cache import LLMCache


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path, monkeypatch):
    """Use an isolated DB for each test to avoid cross-test pollution."""
    db_path = tmp_path / "cache.db"
    monkeypatch.setattr("config.get_db_path", lambda: str(db_path))
    # Also reset module-level cache/locals that bind at import time
    yield
    # Best-effort: also clear global instances
    from routes import llm as llm_mod
    llm_mod._llm_cache = LLMCache(str(db_path))


@pytest.mark.asyncio
@respx.mock
async def test_generate_returns_pain_points():
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=Response(
            200,
            json={
                "content": [
                    {
                        "type": "text",
                        "text": '{"pain_points":[{"title":"X","description":"Y","severity":"high"}],"ai_helps":[{"use_case":"u","capability":"c","example":"e","roi_estimate":"r"}]}',
                    }
                ]
            },
        )
    )
    save_settings(
        Settings(
            active_provider="claude",
            providers={
                "claude": LLMProviderConfig(
                    provider="claude",
                    api_key="sk-test",
                    base_url=None,
                    model="claude-sonnet-4-5",
                    extra={},
                )
            },
        )
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/llm/generate", json={"industry_id": "agriculture"}
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert len(body["pain_points"]) >= 1
    assert body["provider"] == "claude"
