import pytest
from domain.llm.registry import LLMProviderRegistry
from domain.llm.claude import ClaudeProvider
from schema.settings import LLMProviderConfig


def test_register_and_get():
    reg = LLMProviderRegistry()
    p = ClaudeProvider(api_key="k")
    reg.register("claude", p)
    assert reg.get("claude") is p


def test_get_missing_returns_none():
    reg = LLMProviderRegistry()
    assert reg.get("nonexistent") is None


def test_create_from_config():
    reg = LLMProviderRegistry()
    cfg = LLMProviderConfig(provider="claude", api_key="k", base_url=None, model="claude-sonnet-4-5", extra={})
    p = reg.create("claude", cfg)
    assert isinstance(p, ClaudeProvider)


def test_create_minimax_passes_enable_thinking():
    reg = LLMProviderRegistry()
    cfg = LLMProviderConfig(provider="minimax", api_key="k", base_url=None, model="MiniMax-Text-01", extra={"enable_thinking": True})
    p = reg.create("minimax", cfg)
    assert p.enable_thinking is True
