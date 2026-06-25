"""Bug fix: settings POST 必须同步更新内存中 GraphService.llm.

bug 现象: 用户在 Settings 页切 provider,POST /api/settings/llm 保存到磁盘,
但 GraphService.llm 还是 lifespan 启动时创建的那个旧 client。
后果: 后续 LLM 调用仍打旧 provider,新 provider 永不生效。

本测试在写死配置目录(IVF_CONFIG_DIR → tmp_path)的前提下:
1. 启动时用 claude
2. POST minimax
3. 断言 app.state.graph_service.llm 变成 minimax

注意: registry.create() 不会真发 HTTP(只构造 httpx client),无需 mock LLM。
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from config import save_settings
from schema.settings import LLMProviderConfig, Settings


@pytest.fixture
def fresh_config_dir(tmp_path, monkeypatch):
    """每测试用独立配置目录,避免污染 ~/.config/industry-value-flow/。"""
    monkeypatch.setenv("IVF_CONFIG_DIR", str(tmp_path))
    # 由于 config 模块在 import 时缓存 CONFIG_DIR,需 reload
    if "config" in sys.modules:
        importlib.reload(sys.modules["config"])
    yield tmp_path


@pytest.fixture
def reload_main():
    """每次新 lifespan,避免 GraphService 跨测试污染。"""
    if "main" in sys.modules:
        importlib.reload(sys.modules["main"])
    yield
    if "main" in sys.modules:
        importlib.reload(sys.modules["main"])


def test_post_settings_updates_inmemory_llm_to_new_provider(
    fresh_config_dir, reload_main
):
    # 1. 初始: claude active
    initial = Settings(
        active_provider="claude",
        providers={
            "claude": LLMProviderConfig(
                provider="claude", api_key="sk-test-claude", model="claude-sonnet-4-5"
            ),
        },
    )
    save_settings(initial)

    from main import create_app  # noqa: E402

    app = create_app()
    with TestClient(app) as client:
        # 启动时:内存里是 claude
        assert app.state.graph_service is not None
        assert app.state.graph_service.llm.name == "claude"

        # 2. POST: 切到 minimax
        new = Settings(
            active_provider="minimax",
            providers={
                "claude": LLMProviderConfig(
                    provider="claude", api_key="sk-test-claude", model="claude-sonnet-4-5"
                ),
                "minimax": LLMProviderConfig(
                    provider="minimax",
                    api_key="sk-cp-fake-test-key",
                    model="MiniMax-M3",
                ),
            },
        )
        resp = client.post("/api/settings/llm", json=new.model_dump(mode="json"))
        assert resp.status_code == 200, resp.text

        # 3. 关键断言:内存里的 LLM 应该变成 minimax
        assert app.state.graph_service.llm.name == "minimax", (
            f"POST 后内存 LLM 仍是 {app.state.graph_service.llm.name},"
            f"应是 minimax — bug 复发"
        )


def test_post_settings_lazy_inits_graph_service_when_lifespan_had_no_llm(
    fresh_config_dir, reload_main
):
    """2026-06-26 bug fix: prod 场景 lifespan 时 LLM 未配置 → graph_service 整个
    是 None(不是 llm=None)。POST 应该 lazy init,而不是返"restart"。

    模拟:启动时无 LLM → app.state.graph_service = None。
    然后 POST 一个有效 settings。
    期望:app.state.graph_service 被创建 + .llm 指向新 provider。
    """
    # 1. 启动时无 LLM(active_provider 有但 providers 空 → active_cfg.api_key 空)
    initial = Settings(active_provider="claude", providers={})
    save_settings(initial)

    from main import create_app  # noqa: E402

    app = create_app()
    with TestClient(app) as client:
        # 启动时:graph_service 是 None(没 LLM)
        assert app.state.graph_service is None, (
            "lifespan 在 LLM 未配置时把 graph_service 设成 None"
        )

        # 2. POST: 配 LLM(模拟用户在 Web UI 填表保存)
        new = Settings(
            active_provider="minimax",
            providers={
                "minimax": LLMProviderConfig(
                    provider="minimax",
                    api_key="sk-cp-fake-test-key",
                    model="MiniMax-M3",
                ),
            },
        )
        resp = client.post("/api/settings/llm", json=new.model_dump(mode="json"))
        assert resp.status_code == 200, resp.text

        # 3. 关键断言:graph_service 被 lazy init 了
        assert app.state.graph_service is not None, (
            "POST 后 graph_service 仍是 None — lazy init 没生效"
        )
        assert app.state.graph_service.llm is not None, (
            "POST 后 graph_service.llm 仍是 None"
        )
        assert app.state.graph_service.llm.name == "minimax", (
            f"POST 后 LLM 是 {app.state.graph_service.llm.name},"
            f"应是 minimax"
        )

        # 4. startup_error 也清掉了
        assert app.state.startup_error is None, (
            f"startup_error 应清空,实是 {app.state.startup_error!r}"
        )


def test_post_settings_no_op_when_no_llm_configured(
    fresh_config_dir, reload_main
):
    """graph_service=None + POST 还是没 LLM → 不应 crash,只 settings 保存到盘。"""
    initial = Settings(active_provider="claude", providers={})
    save_settings(initial)

    from main import create_app  # noqa: E402

    app = create_app()
    with TestClient(app) as client:
        assert app.state.graph_service is None
        new = Settings(active_provider="claude", providers={})
        resp = client.post("/api/settings/llm", json=new.model_dump(mode="json"))
        assert resp.status_code == 200, resp.text
        # graph_service 仍 None(没 LLM 就不建)
        assert app.state.graph_service is None
