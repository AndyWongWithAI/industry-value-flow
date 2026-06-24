"""启动钩子:清旧 v1 cache。"""
from pathlib import Path
from domain.storage.cache import Cache
from main import app  # 触发 import,验证 lifespan 不抛


def test_app_import_does_not_clear_v1_in_unit_tests(tmp_path: Path, monkeypatch):
    """unit 测试不应触发真实 DB 清扫;通过 monkeypatch IVF_CONFIG_DIR 隔离。
    lifespan 在 FastAPI startup 触发,unit test 不走 lifespan,这里只断言 import 干净。
    """
    import sys
    # 隔离 config 路径,避免污染真实 ~/.config
    monkeypatch.setenv("IVF_CONFIG_DIR", str(tmp_path))
    # 重新 import config 拿到新路径
    import importlib
    import config
    importlib.reload(config)
    db_path = config.get_db_path()
    cache = Cache(db_path)
    cache.set("industries:all:v1", {"old": True})
    cache.set("stats_gov:industries:2024:v2", {"new": True})

    # 启动主应用(走 lifespan)
    from fastapi.testclient import TestClient
    with TestClient(app) as _client:
        # lifespan 已清 v1
        assert cache.get("industries:all:v1") is None
        assert cache.get("stats_gov:industries:2024:v2") == {"new": True}
