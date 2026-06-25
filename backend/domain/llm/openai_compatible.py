import httpx

from domain.llm.base import LLMProviderProtocol


class OpenAICompatibleProvider:
    """OpenAI 兼容协议的 LLM provider 基类。 子类可设置 base_url / model / extra_headers。"""

    name: str = "openai_compatible"

    def __init__(
        self,
        base_url: str,
        api_key: str,
        default_model: str,
        extra_headers: dict | None = None,
        timeout: float = 300.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.default_model = default_model
        self.extra_headers = extra_headers or {}
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    **self.extra_headers,
                },
                timeout=self.timeout,
            )
        return self._client

    async def generate(self, prompt: str, model: str | None = None) -> str:
        client = await self._get_client()
        payload = {
            "model": model or self.default_model,
            "max_tokens": 16384,  # v2:从默认(~4k)提到 16k,支持 96 节点生成
            "messages": [{"role": "user", "content": prompt}],
        }
        resp = await client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    async def aclose(self):
        if self._client is not None:
            await self._client.aclose()
            self._client = None


# Make it satisfy the protocol shape (Protocol is structural — no need to inherit).
_ = LLMProviderProtocol  # keep import live; structure checked by typeguard at runtime