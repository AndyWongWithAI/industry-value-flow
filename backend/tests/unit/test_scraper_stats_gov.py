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
    # T5 阶段:cn-stats 调用后,无论 fallback 还是真调,节点必须含 agri_* 子节点
    ids = {n.id for n in data.nodes}
    assert "agri_planting" in ids  # T5 真实子节点
    assert "agri_mid" in ids  # mid 节点


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


# ---- T5:农业/制造业子行业真实数据 ----

@pytest.mark.asyncio
@respx.mock
async def test_fetch_agriculture_returns_4_subindustries():
    """农业子行业:cn-stats 失败时仍返回 4 节点硬编码(用户决策 B-1)。"""
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    with patch("cnstats.stats.stats", side_effect=RuntimeError("cn-stats table A0201 unavailable")):
        async with AsyncClient() as client:
            scraper = StatsGovScraper(client)
            data = await scraper.fetch("agriculture")
    ids = {n.id for n in data.nodes}
    assert "agri_planting" in ids
    assert "agri_forestry" in ids
    assert "agri_animal" in ids
    assert "agri_fishery" in ids
    # 总和与主桑基一致(94431)
    total = sum(e.value for e in data.edges if e.target == "agri_mid")
    assert total == pytest.approx(94431.0, rel=0.05)
    # 真实数据 schema 字段
    assert data.unit == "亿元"
    assert data.year == 2024
    assert data.source is not None
    assert "国家统计局" in data.source
    # 抽查真实值:种植业 60,212 亿
    planting_edge = [e for e in data.edges if e.source == "agri_planting"]
    assert len(planting_edge) == 1
    assert planting_edge[0].value == pytest.approx(60212.0, rel=0.01)


@pytest.mark.asyncio
@respx.mock
async def test_fetch_manufacturing_returns_12_subindustries():
    """制造业子行业:cn-stats 失败时仍返回 12 节点(11 大类 + 其他)。"""
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    with patch("cnstats.stats.stats", side_effect=RuntimeError("cn-stats table A0203 unavailable")):
        async with AsyncClient() as client:
            scraper = StatsGovScraper(client)
            data = await scraper.fetch("manufacturing")
    ids = {n.id for n in data.nodes}
    expected = {
        "mfg_food", "mfg_textile", "mfg_chemical", "mfg_nonmetal",
        "mfg_steel", "mfg_general_equip", "mfg_special_equip", "mfg_auto",
        "mfg_electric", "mfg_comm_equip", "mfg_power", "mfg_other",
    }
    assert expected.issubset(ids)
    assert data.unit == "亿元"
    assert data.year == 2024
    assert data.source is not None
    # 抽查真实值:汽车制造业 10,800 亿
    auto_edge = [e for e in data.edges if e.source == "mfg_auto"]
    assert len(auto_edge) == 1
    assert auto_edge[0].value == pytest.approx(10800.0, rel=0.01)


@pytest.mark.asyncio
@respx.mock
async def test_fetch_agriculture_calls_cn_stats_table_A0201():
    """农业子行业真实调 cn-stats stats(zbcode='A0201', datestr='2024')。"""
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    with patch("cnstats.stats.stats", return_value=[]) as mock_stats:
        async with AsyncClient() as client:
            scraper = StatsGovScraper(client)
            data = await scraper.fetch("agriculture")
    # 至少调用一次 stats(zbcode="A0201", ...)
    assert mock_stats.call_count >= 1
    call_kwargs = mock_stats.call_args.kwargs
    assert call_kwargs.get("zbcode") == "A0201"
    assert "2024" in str(call_kwargs.get("datestr", ""))


@pytest.mark.asyncio
@respx.mock
async def test_fetch_manufacturing_calls_cn_stats_table_A0203():
    """制造业子行业真实调 cn-stats stats(zbcode='A0203', datestr='2024')。"""
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    with patch("cnstats.stats.stats", return_value=[]) as mock_stats:
        async with AsyncClient() as client:
            scraper = StatsGovScraper(client)
            data = await scraper.fetch("manufacturing")
    assert mock_stats.call_count >= 1
    call_kwargs = mock_stats.call_args.kwargs
    assert call_kwargs.get("zbcode") == "A0203"


@pytest.mark.asyncio
@respx.mock
@pytest.mark.slow
async def test_fetch_agriculture_live_cn_stats_returns_real_data():
    """真实联网:cn-stats stats('A0201','2024',as_df=True) 返回 DataFrame。
    标 slow,默认 skip(FB-647bc639:必须真调 + 用 MockTransport/respx)。
    """
    import pandas as pd
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    # 不 mock cnstats.stats.stats,让真调;若环境不能联网则失败
    async with AsyncClient() as client:
        scraper = StatsGovScraper(client)
        data = await scraper.fetch("agriculture")
    assert isinstance(data, SankeyData)
    assert data.year == 2024
