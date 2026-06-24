from typing import Protocol


class LLMProviderProtocol(Protocol):
    name: str

    async def generate(self, prompt: str, model: str | None = None) -> str: ...