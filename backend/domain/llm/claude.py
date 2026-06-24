import httpx
from domain.llm.base import LLMProviderProtocol

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class ClaudeProvider:
    name = "claude"

    def __init__(self, api_key: str, default_model: str = "claude-sonnet-4-5", timeout: float = 60.0):
        self.api_key = api_key
        self.default_model = default_model
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": ANTHROPIC_VERSION,
                    "Content-Type": "application/json",
                },
                timeout=self.timeout,
            )
        return self._client

    async def generate(self, prompt: str, model: str | None = None) -> str:
        client = await self._get_client()
        payload = {
            "model": model or self.default_model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }
        resp = await client.post(ANTHROPIC_API_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]

    async def aclose(self):
        if self._client is not None:
            await self._client.aclose()
            self._client = None
