import pytest
from pydantic import ValidationError
from schema.settings import LLMProviderConfig, Settings

def test_provider_config_creation():
    c = LLMProviderConfig(provider="claude", api_key="sk-x", base_url=None, model="claude-sonnet-4-5", extra={})
    assert c.provider == "claude"

def test_invalid_provider_rejected():
    with pytest.raises(ValidationError):
        LLMProviderConfig(provider="gpt-x", api_key="x", base_url=None, model="x", extra={})

def test_settings_serialization_roundtrip():
    s = Settings(active_provider="claude", providers={"claude": LLMProviderConfig(provider="claude", api_key="k", base_url=None, model="claude-sonnet-4-5", extra={})}, daily_token_budget=50000)
    j = s.model_dump_json()
    s2 = Settings.model_validate_json(j)
    assert s2.active_provider == "claude"
