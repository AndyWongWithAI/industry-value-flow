import pytest
import respx
from httpx import Response

from domain.llm.deepseek import DeepSeekProvider


@pytest.mark.asyncio
@respx.mock
async def test_deepseek_uses_correct_base_url():
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": "ds"}}]})
    )
    p = DeepSeekProvider(api_key="k")
    try:
        result = await p.generate("hi")
        assert result == "ds"
    finally:
        await p.aclose()