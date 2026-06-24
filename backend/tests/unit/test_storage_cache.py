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


def test_delete_prefix(tmp_path: Path):
    c = Cache(str(tmp_path / "test.db"))
    c.set("industries:all:v1", {"v": 1})
    c.set("industry:agriculture:v1", {"v": 2})
    c.set("stats_gov:industries:2024:v2", {"v": 3})
    deleted = c.delete_prefix(":v1")
    assert deleted == 2
    assert c.get("industries:all:v1") is None
    assert c.get("industry:agriculture:v1") is None
    assert c.get("stats_gov:industries:2024:v2") == {"v": 3}


def test_delete_prefix_no_match(tmp_path: Path):
    c = Cache(str(tmp_path / "test.db"))
    c.set("k:v2", {"v": 1})
    assert c.delete_prefix(":v1") == 0
    assert c.get("k:v2") == {"v": 1}


def test_iter_keys_v2_format(tmp_path: Path):
    c = Cache(str(tmp_path / "test.db"))
    c.set("stats_gov:industries:2024:v2", {"v": 1})
    keys = [k for k, _ in c.iter_keys()]
    assert "stats_gov:industries:2024:v2" in keys
