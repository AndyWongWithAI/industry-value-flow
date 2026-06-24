import asyncio
import pytest
from domain.llm_coalescer import LLMCoalescer

@pytest.mark.asyncio
async def test_concurrent_same_key_runs_once():
    counter = {"n": 0}
    async def factory():
        counter["n"] += 1
        await asyncio.sleep(0.05)
        return "result"
    c = LLMCoalescer()
    results = await asyncio.gather(
        c.get_or_create("k1", factory),
        c.get_or_create("k1", factory),
        c.get_or_create("k1", factory),
    )
    assert counter["n"] == 1
    assert all(r == "result" for r in results)

@pytest.mark.asyncio
async def test_different_keys_run_independently():
    calls: list[str] = []
    async def factory_a():
        calls.append("a")
        await asyncio.sleep(0.01)
        return "A"
    async def factory_b():
        calls.append("b")
        await asyncio.sleep(0.01)
        return "B"
    c = LLMCoalescer()
    r1, r2 = await asyncio.gather(
        c.get_or_create("a", factory_a),
        c.get_or_create("b", factory_b),
    )
    assert r1 == "A"
    assert r2 == "B"
    assert sorted(calls) == ["a", "b"]
