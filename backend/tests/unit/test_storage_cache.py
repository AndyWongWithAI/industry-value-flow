import json
import time
from pathlib import Path
from domain.storage.cache import Cache


def test_set_and_get(tmp_path: Path):
    c = Cache(str(tmp_path / "test.db"))
    c.set("k1", {"v": 1})
    assert c.get("k1") == {"v": 1}


def test_get_missing_returns_none(tmp_path: Path):
    c = Cache(str(tmp_path / "test.db"))
    assert c.get("missing") is None


def test_ttl_expiry(tmp_path: Path):
    c = Cache(str(tmp_path / "test.db"))
    c.set("k2", {"v": 2}, ttl_seconds=1)
    time.sleep(1.1)
    assert c.get("k2") is None


def test_delete(tmp_path: Path):
    c = Cache(str(tmp_path / "test.db"))
    c.set("k3", {"v": 3})
    assert c.delete("k3") is True
    assert c.get("k3") is None
    assert c.delete("k3") is False
