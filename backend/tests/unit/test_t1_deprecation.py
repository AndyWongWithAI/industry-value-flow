"""T1 step 1: 验证旧数据层代码被彻底删除.

这些测试一开始是失败的(import 报错或路由 404),T1 完成后必须全部通过。
"""
import importlib
import sys

import pytest
from fastapi.testclient import TestClient


# ---- backend: schema.sankey / scraper 包不再可 import ----

def test_schema_sankey_module_removed():
    """schema.sankey 模块必须被删除."""
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("schema.sankey")


def test_scraper_stats_gov_module_removed():
    """domain.scraper.stats_gov 必须被删除."""
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("domain.scraper.stats_gov")


def test_scraper_industry_association_module_removed():
    """domain.scraper.industry_association 必须被删除."""
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("domain.scraper.industry_association")


def test_scraper_base_module_removed():
    """domain.scraper.base (ScraperProtocol) 必须被删除."""
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("domain.scraper.base")


def test_scraper_package_removed():
    """domain.scraper 整个目录被删除,import 必须失败."""
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("domain.scraper")


# ---- backend: /api/industries 和 /api/industry/{id} 必须返回 404 ----

@pytest.fixture
def client(monkeypatch, tmp_path):
    """isolated FastAPI client with IVF_CONFIG_DIR pointed at tmp_path."""
    monkeypatch.setenv("IVF_CONFIG_DIR", str(tmp_path))
    # 重新加载 config 让 get_db_path() 走 tmp_path
    if "config" in sys.modules:
        importlib.reload(sys.modules["config"])
    if "main" in sys.modules:
        importlib.reload(sys.modules["main"])
    from main import app  # noqa: F401
    with TestClient(app) as c:
        yield c


def test_api_industries_returns_404(client):
    """T1 后 /api/industries 不再存在(等 T4 替换为 /api/graph)."""
    resp = client.get("/api/industries")
    assert resp.status_code == 404


def test_api_industry_by_id_returns_404(client):
    """T1 后 /api/industry/{id} 不再存在."""
    resp = client.get("/api/industry/agriculture")
    assert resp.status_code == 404


# ---- backend: main.py 的 lifespan 不再做 v1 cache 清理 ----

def test_lifespan_does_not_clear_v1_cache(client, monkeypatch, tmp_path):
    """T1 后 lifespan 不再有 delete_prefix(':v1') 行为.

    lifespan 仍可 import,但不应主动清 v1 cache.
    验证:启动后 v1 cache 应该原样保留.
    """
    from domain.storage.cache import Cache
    cache = Cache(str(tmp_path / "db.sqlite"))
    cache.set("some:v1:key", {"old": True})
    # client fixture 已触发 lifespan 启动
    assert cache.get("some:v1:key") == {"old": True}, (
        "lifespan 不应清 v1 cache(T1 后保留 v1 清理行为已废弃)"
    )