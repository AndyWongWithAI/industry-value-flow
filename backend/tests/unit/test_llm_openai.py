import pytest
import respx
from httpx import Response

from domain.llm.openai import OpenAIProvider


@pytest.mark.asyncio
@respx.mock
async def test_generate():
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": "openai reply"}}]})
    )
    p = OpenAIProvider(api_key="sk-test", default_model="gpt-4o")
    try:
        result = await p.generate("hi")
        assert result == "openai reply"
    finally:
        await p.aclose()
