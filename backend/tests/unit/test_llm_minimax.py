import json

import pytest
import respx
from httpx import Response

from domain.llm.minimax import MiniMaxProvider


@pytest.mark.asyncio
@respx.mock
async def test_minimax_uses_anthropic_endpoint():
    respx.post("https://api.minimaxi.com/anthropic/v1/messages").mock(
        return_value=Response(
            200,
            json={"content": [{"type": "text", "text": "minimax-reply"}]},
        )
    )
    p = MiniMaxProvider(api_key="k", default_model="MiniMax-M3")
    try:
        result = await p.generate("hi")
        assert result == "minimax-reply"
        request = respx.calls[0].request
        # Verify x-api-key auth header (Anthropic-style)
        assert "x-api-key" in request.headers
        assert request.headers["x-api-key"] == "k"
        # Verify anthropic-version
        assert "anthropic-version" in request.headers
        # Verify body
        body = json.loads(request.content)
        assert body["model"] == "MiniMax-M3"
        assert body["messages"] == [{"role": "user", "content": "hi"}]
        # No thinking param by default
        assert "thinking" not in body
    finally:
        await p.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_minimax_enable_thinking_true():
    respx.post("https://api.minimaxi.com/anthropic/v1/messages").mock(
        return_value=Response(
            200,
            json={
                "content": [
                    {"type": "thinking", "thinking": "let me think..."},
                    {"type": "text", "text": "answer"},
                ]
            },
        )
    )
    p = MiniMaxProvider(api_key="k", default_model="MiniMax-M3", enable_thinking=True)
    try:
        result = await p.generate("hi")
        # Should extract text blocks, ignore thinking blocks
        assert result == "answer"
        body = json.loads(respx.calls[0].request.content)
        assert body["thinking"] == {"type": "adaptive"}
    finally:
        await p.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_minimax_default_model():
    respx.post("https://api.minimaxi.com/anthropic/v1/messages").mock(
        return_value=Response(200, json={"content": [{"type": "text", "text": "ok"}]})
    )
    p = MiniMaxProvider(api_key="k")
    try:
        await p.generate("hi")
        body = json.loads(respx.calls[0].request.content)
        # Default model should be MiniMax-M3 (not the old MiniMax-Text-01)
        assert body["model"] == "MiniMax-M3"
    finally:
        await p.aclose()
