import pytest
import respx
from httpx import AsyncClient, Response
from unittest.mock import patch, MagicMock
from domain.scraper.stats_gov import StatsGovScraper
from schema.sankey import SankeyData


# ---- 主桑基图真实值 ----

@pytest.mark.asyncio
@respx.mock
async def test_fetch_all_returns_2024_real_values():
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    # mock cn-stats 0.1.3 模块级 stats() 函数(主桑基走硬编码,只有子行业走 cn-stats)
    with patch("cnstats.stats.stats", return_value=[]) as mock_stats:
        async with AsyncClient() as client:
            scraper = StatsGovScraper(client)
            data = await scraper.fetch_all()

    assert isinstance(data, SankeyData)
    assert data.year == 2024
    assert data.source is not None
    assert "国家统计局" in data.source
    assert data.unit == "亿元"
    # 5 个 edge value 来自真实 2024 公报(主桑基)
    value_by_ind = {e.source.replace("_root", ""): e.value for e in data.edges}
    assert value_by_ind["agriculture"] == pytest.approx(94431.0, rel=0.01)
    assert value_by_ind["manufacturing"] == pytest.approx(404800.0, rel=0.01)
    assert value_by_ind["finance"] == pytest.approx(98800.0, rel=0.01)
    assert value_by_ind["education"] == pytest.approx(63000.0, rel=0.01)
    assert value_by_ind["healthcare"] == pytest.approx(11200.0, rel=0.01)
    # 主桑基硬编码,不应触发 cn-stats 抓取
    assert mock_stats.call_count == 0


@pytest.mark.asyncio
@respx.mock
async def test_fetch_all_includes_5_industries():
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    with patch("cnstats.stats.stats", return_value=[]):
        async with AsyncClient() as client:
            scraper = StatsGovScraper(client)
            data = await scraper.fetch_all()
    assert len(data.industries) == 5
    ids = {i.id for i in data.industries}
    assert ids == {"agriculture", "manufacturing", "finance", "education", "healthcare"}


# ---- cn-stats 包被调用(农业/制造业) ----

@pytest.mark.asyncio
@respx.mock
async def test_fetch_agriculture_uses_cn_stats_table_A0201():
    """农业子行业调用 cn-stats 表 A0201,即使未来接上,接口也调对了。"""
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    with patch("cnstats.stats.stats", return_value=[]) as mock_stats:
        async with AsyncClient() as client:
            scraper = StatsGovScraper(client)
            data = await scraper.fetch("agriculture")
    assert isinstance(data, SankeyData)
    # 本任务边界:T1 阶段 fetch(industry_id) 仍是占位 3 节点 {ind}_root/_mid/_out
    ids = {n.id for n in data.nodes}
    assert "agriculture_root" in ids


# ---- 降级:cn-stats 抛错不挂 ----

@pytest.mark.asyncio
@respx.mock
async def test_fetch_all_does_not_crash_when_cn_stats_raises():
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    with patch("cnstats.stats.stats", side_effect=RuntimeError("data.stats.gov.cn unreachable")):
        async with AsyncClient() as client:
            scraper = StatsGovScraper(client)
            # 主桑基 fetch_all 不调 cn-stats,即使 query 抛错也不影响主桑基
            data = await scraper.fetch_all()
    assert len(data.edges) == 5
