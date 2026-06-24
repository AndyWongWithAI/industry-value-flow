import pytest
import respx
from httpx import Response
from domain.llm.claude import ClaudeProvider

@pytest.mark.asyncio
@respx.mock
async def test_generate_calls_anthropic_api():
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=Response(200, json={
            "content": [{"type": "text", "text": "claude reply"}]
        })
    )
    p = ClaudeProvider(api_key="sk-ant-test", default_model="claude-sonnet-4-5")
    result = await p.generate("hi")
    assert result == "claude reply"

@pytest.mark.asyncio
@respx.mock
async def test_request_includes_anthropic_version():
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=Response(200, json={"content": [{"type": "text", "text": "x"}]})
    )
    p = ClaudeProvider(api_key="k", default_model="m")
    await p.generate("hi")
    headers = respx.calls[0].request.headers
    assert "x-api-key" in headers
    assert "anthropic-version" in headers
