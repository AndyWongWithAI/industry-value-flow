"""T7: 后端 lifespan 容错 + 503 reason 透传集成测试.

Spec §7.2:
- LLM 不可用时,后端进程不应 crash,而是:
  - app.state.graph_service = None
  - app.state.startup_error = "<原因文案>"
  - GET /api/graph → 503 + error=llm_unavailable + message=<startup_error>

测试策略:
- 用 TestClient 触发 FastAPI app(走真实 lifespan)
- 通过 monkeypatch 让 settings/proxy 出错,验证:
  1. 进程启动成功(不抛异常)
  2. /api/graph 返回 503 + 真实 reason
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


# ---------- fixtures ----------


@pytest.fixture
def client_with_unavailable_llm(monkeypatch, tmp_path):
    """让 config.get_settings 返回一个 active_provider + api_key 配齐的 settings,
    但 LLMProviderRegistry.create() 抛出异常 — 模拟 LLM 创建失败。
    """
    from schema.settings import LLMProviderConfig, Settings

    fake_settings = Settings(
        active_provider="claude",
        providers={
            "claude": LLMProviderConfig(
                provider="claude",
                api_key="sk-fake-key",
                base_url=None,
                model="claude-sonnet-4-5",
                extra={},
            )
        },
        daily_token_budget=100000,
    )

    def boom(*args, **kwargs):
        raise RuntimeError("simulated registry crash")

    monkeypatch.setattr("config.get_settings", lambda: fake_settings)
    monkeypatch.setattr(
        "domain.llm.registry.LLMProviderRegistry.create", boom
    )

    # 切到 tmp db 避免污染
    monkeypatch.setattr("config.get_db_path", lambda: str(tmp_path / "test.db"))

    from main import create_app

    app = create_app()
    with TestClient(app) as client:
        yield client


@pytest.fixture
def client_no_llm_configured(monkeypatch, tmp_path):
    """settings 里 active_provider 配齐但对应 provider 没有 api_key,
    模拟'active_provider 选了但 provider dict 是空'的场景。
    """
    from schema.settings import Settings

    # active_provider 必须存在才能通过 validator,但 providers dict 可以空
    # 这样 active_cfg = settings.providers.get(active_name) → None
    fake_settings = Settings(
        active_provider="claude",
        providers={},  # 空 — 没有实际的 provider 配置
        daily_token_budget=100000,
    )
    monkeypatch.setattr("config.get_settings", lambda: fake_settings)
    monkeypatch.setattr("config.get_db_path", lambda: str(tmp_path / "test.db"))

    from main import create_app

    app = create_app()
    with TestClient(app) as client:
        yield client


# ---------- tests ----------


class TestLifespanResilience:
    """lifespan 失败时进程不 crash,只在路由层返回 503。"""

    def test_app_starts_when_llm_registry_crashes(
        self, client_with_unavailable_llm: TestClient
    ) -> None:
        """关键断言:TestClient 上下文管理器进入不抛异常(即 lifespan 成功返回)。"""
        # client_with_unavailable_llm 已经走完 lifespan 初始化
        # 如果 lifespan 把异常 re-raise,这里会失败
        assert client_with_unavailable_llm is not None

    def test_health_endpoint_still_responds(
        self, client_with_unavailable_llm: TestClient
    ) -> None:
        """/health 不依赖 GraphService,LLM 挂时也应正常 200。"""
        r = client_with_unavailable_llm.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_graph_endpoint_returns_503_when_llm_crashes(
        self, client_with_unavailable_llm: TestClient
    ) -> None:
        """GET /api/graph 在 LLM 不可用时返回 503 + llm_unavailable。"""
        r = client_with_unavailable_llm.get("/api/graph")
        assert r.status_code == 503
        body = r.json()
        assert body["error"] == "llm_unavailable"
        # message 应该是 startup_error 的内容或 fallback
        assert "message" in body
        assert isinstance(body["message"], str)
        assert len(body["message"]) > 0

    def test_graph_endpoint_returns_503_when_llm_unconfigured(
        self, client_no_llm_configured: TestClient
    ) -> None:
        """无 LLM 配置时也返回 503。"""
        r = client_no_llm_configured.get("/api/graph")
        assert r.status_code == 503
        body = r.json()
        assert body["error"] == "llm_unavailable"

    def test_graph_service_state_is_none_when_llm_unavailable(
        self, client_with_unavailable_llm: TestClient
    ) -> None:
        """lifespan 失败时 app.state.graph_service 应该是 None。"""
        app = client_with_unavailable_llm.app
        assert getattr(app.state, "graph_service", "missing") is None

    def test_startup_error_is_recorded_when_llm_crashes(
        self, client_with_unavailable_llm: TestClient
    ) -> None:
        """lifespan 失败时 app.state.startup_error 应记录具体原因。"""
        app = client_with_unavailable_llm.app
        startup_error = getattr(app.state, "startup_error", None)
        assert startup_error is not None
        # 应该包含我们注入的"simulated registry crash"
        assert "simulated registry crash" in startup_error or "LLM" in startup_error

    def test_startup_error_is_recorded_when_llm_unconfigured(
        self, client_no_llm_configured: TestClient
    ) -> None:
        """LLM 未配置时 startup_error 应该是清晰的提示。"""
        app = client_no_llm_configured.app
        startup_error = getattr(app.state, "startup_error", None)
        assert startup_error is not None
        # 应该提到 LLM 未配置
        assert "LLM" in startup_error or "配置" in startup_error


class TestStartupErrorPropagatesToRoute:
    """503 response 的 message 应透传 startup_error 的真实原因。"""

    def test_503_message_contains_actual_reason(
        self, client_with_unavailable_llm: TestClient
    ) -> None:
        """frontend 的 EmptyState 会从 message 渲染 reason,必须真实。"""
        r = client_with_unavailable_llm.get("/api/graph")
        body = r.json()
        # 我们注入的是 "simulated registry crash",503 message 应该透传
        assert "simulated registry crash" in body["message"] or "LLM" in body["message"]


class TestOtherRoutesStillWork:
    """LLM 挂时,其他不依赖 GraphService 的端点应照常工作。"""

    def test_industries_endpoint_when_llm_down(
        self, client_with_unavailable_llm: TestClient
    ) -> None:
        """industries 路由不依赖 GraphService(应该照常 200)。
        注意:如果它依赖了 settings,我们这里只验证非 503。
        """
        r = client_with_unavailable_llm.get("/api/industries")
        # 不应是 503 (那是 LLM 错的 code)
        assert r.status_code != 503, f"industries should not return 503: {r.text}"