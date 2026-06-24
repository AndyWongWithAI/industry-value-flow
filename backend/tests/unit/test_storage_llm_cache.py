from pathlib import Path
from domain.storage.llm_cache import LLMCache


def test_set_and_get(tmp_path: Path):
    c = LLMCache(str(tmp_path / "llm.db"))
    c.set("k1", prompt="hello", response={"text": "world"})
    result = c.get("k1")
    assert result is not None
    assert result["prompt"] == "hello"
    assert result["response"] == {"text": "world"}