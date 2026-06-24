from domain.llm.base import LLMProviderProtocol
from domain.llm.claude import ClaudeProvider
from domain.llm.openai import OpenAIProvider
from domain.llm.deepseek import DeepSeekProvider
from domain.llm.minimax import MiniMaxProvider
from domain.llm.ollama import OllamaProvider
from schema.settings import LLMProviderConfig


class LLMProviderRegistry:
    def __init__(self):
        self._providers: dict[str, LLMProviderProtocol] = {}

    def register(self, name: str, provider: LLMProviderProtocol):
        self._providers[name] = provider

    def get(self, name: str) -> LLMProviderProtocol | None:
        return self._providers.get(name)

    def create(self, name: str, config: LLMProviderConfig) -> LLMProviderProtocol:
        if name == "claude":
            return ClaudeProvider(api_key=config.api_key, default_model=config.model)
        if name == "openai":
            return OpenAIProvider(api_key=config.api_key, default_model=config.model)
        if name == "deepseek":
            return DeepSeekProvider(api_key=config.api_key, default_model=config.model)
        if name == "minimax":
            return MiniMaxProvider(
                api_key=config.api_key,
                default_model=config.model,
                enable_thinking=config.extra.get("enable_thinking", False),
            )
        if name == "ollama":
            base_url = config.base_url or "http://localhost:11434/v1"
            return OllamaProvider(base_url=base_url, default_model=config.model)
        raise ValueError(f"unknown provider: {name}")
