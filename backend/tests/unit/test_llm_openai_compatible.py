import json

import pytest
import respx
from httpx import Response

from domain.llm.openai_compatible import OpenAICompatibleProvider


@pytest.mark.asyncio
@respx.mock
async def test_generate_calls_chat_completions():
    respx.post("https://api.example.com/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{"message": {"content": "hello back"}}]
        })
    )
    p = OpenAICompatibleProvider(
        base_url="https://api.example.com/v1",
        api_key="sk-test",
        default_model="test-model",
    )
    try:
        result = await p.generate("hi")
        assert result == "hello back"
    finally:
        await p.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_generate_custom_model():
    respx.post("https://api.example.com/v1/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": "x"}}]})
    )
    p = OpenAICompatibleProvider(
        base_url="https://api.example.com/v1",
        api_key="k",
        default_model="m1",
    )
    try:
        await p.generate("hi", model="m2")
        request = respx.calls[0].request
        body = json.loads(request.content)
        assert body["model"] == "m2"
    finally:
        await p.aclose()