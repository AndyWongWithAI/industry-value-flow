import httpx
from domain.llm.claude import ClaudeProvider, ANTHROPIC_VERSION


class MiniMaxProvider(ClaudeProvider):
    """MiniMax models accessed via Anthropic-compatible API.

    Per MiniMax docs (2026): https://api.minimaxi.com/anthropic
    Uses Anthropic Messages API format with x-api-key auth.
    Models: MiniMax-M3, MiniMax-M2.7, MiniMax-M2.7-highspeed, MiniMax-M2.5, etc.
    """

    name = "minimax"

    def __init__(
        self,
        api_key: str,
        default_model: str = "MiniMax-M3",
        timeout: float = 300.0,
        enable_thinking: bool = False,
    ):
        # Skip ClaudeProvider.__init__ — we need a different base_url.
        # Call grandparent's pattern manually.
        self.api_key = api_key
        self.default_model = default_model
        self.timeout = timeout
        self.enable_thinking = enable_thinking
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url="https://api.minimaxi.com",
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
        # MiniMax-M3 supports thinking via "thinking" param (Anthropic-style).
        # Per docs: "thinking" with type=adaptive enables, type=disabled keeps off.
        # We send it only when explicitly enabled (M2.x has thinking always on).
        payload: dict = {
            "model": model or self.default_model,
            "max_tokens": 16384,
            "messages": [{"role": "user", "content": prompt}],
        }
        if self.enable_thinking:
            payload["thinking"] = {"type": "adaptive"}
        resp = await client.post("/anthropic/v1/messages", json=payload)
        resp.raise_for_status()
        data = resp.json()
        # Response may have thinking blocks first, then text blocks.
        # Concatenate all text-type content blocks.
        text_parts = [
            block["text"]
            for block in data.get("content", [])
            if block.get("type") == "text"
        ]
        if not text_parts:
            # Fallback: if no text blocks (unexpected), dump content
            return str(data.get("content", ""))
        return "".join(text_parts)
