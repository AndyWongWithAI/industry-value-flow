import json

import pytest
import respx
from httpx import Response

from domain.llm.minimax import MiniMaxProvider


@pytest.mark.asyncio
@respx.mock
async def test_minimax_sends_enable_thinking_false():
    respx.post("https://api.minimax.io/v1/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": "mm"}}]})
    )
    p = MiniMaxProvider(api_key="k", enable_thinking=False)
    try:
        await p.generate("hi")
        body = json.loads(respx.calls[0].request.content)
        assert body["chat_template_kwargs"] == {"enable_thinking": False}
    finally:
        await p.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_minimax_thinking_true():
    respx.post("https://api.minimax.io/v1/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": "x"}}]})
    )
    p = MiniMaxProvider(api_key="k", enable_thinking=True)
    try:
        await p.generate("hi")
        body = json.loads(respx.calls[0].request.content)
        assert body["chat_template_kwargs"]["enable_thinking"] is True
    finally:
        await p.aclose()