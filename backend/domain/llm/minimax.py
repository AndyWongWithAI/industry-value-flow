from typing import Any

from domain.llm.openai_compatible import OpenAICompatibleProvider


class MiniMaxProvider(OpenAICompatibleProvider):
    name = "minimax"

    def __init__(
        self,
        api_key: str,
        default_model: str = "MiniMax-Text-01",
        enable_thinking: bool = False,
        timeout: float = 60.0,
    ):
        super().__init__(
            base_url="https://api.minimax.io/v1",
            api_key=api_key,
            default_model=default_model,
            timeout=timeout,
        )
        self.enable_thinking = enable_thinking

    async def generate(self, prompt: str, model: str | None = None) -> str:
        client = await self._get_client()
        payload: dict[str, Any] = {
            "model": model or self.default_model,
            "messages": [{"role": "user", "content": prompt}],
            "chat_template_kwargs": {"enable_thinking": self.enable_thinking},
        }
        resp = await client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]