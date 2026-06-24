from typing import Literal
from pydantic import BaseModel, Field, field_validator

VALID_PROVIDERS = ("claude", "openai", "deepseek", "minimax", "ollama")

class LLMProviderConfig(BaseModel):
    provider: Literal["claude", "openai", "deepseek", "minimax", "ollama"]
    api_key: str = Field(min_length=1)
    base_url: str | None = None
    model: str = Field(min_length=1)
    extra: dict = Field(default_factory=dict)

class Settings(BaseModel):
    active_provider: str
    providers: dict[str, LLMProviderConfig]
    daily_token_budget: int = Field(default=100_000, gt=0)

    @field_validator("active_provider")
    @classmethod
    def validate_active(cls, v: str) -> str:
        if v not in VALID_PROVIDERS:
            raise ValueError(f"active_provider must be one of {VALID_PROVIDERS}")
        return v
