import pytest
import respx
from httpx import Response

from domain.llm.ollama import OllamaProvider


@pytest.mark.asyncio
@respx.mock
async def test_ollama_uses_localhost():
    respx.post("http://localhost:11434/v1/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": "ol"}}]})
    )
    p = OllamaProvider()
    try:
        result = await p.generate("hi")
        assert result == "ol"
    finally:
        await p.aclose()