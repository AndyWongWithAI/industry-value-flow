import pytest
import respx
from httpx import AsyncClient, Response
from domain.scraper.stats_gov import StatsGovScraper
from schema.sankey import SankeyData


@pytest.mark.asyncio
@respx.mock
async def test_fetch_all_returns_sankey_data():
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html><body>mock</body></html>")
    )
    async with AsyncClient() as client:
        scraper = StatsGovScraper(client)
        # mock 应该被使用,虽然不解析实际 HTML
        # 重点:返回 SankeyData 类型
        result = await scraper.fetch("agriculture")
        assert isinstance(result, SankeyData)


@pytest.mark.asyncio
@respx.mock
async def test_fetch_all_includes_5_industries():
    respx.get("https://data.stats.gov.cn/").mock(
        return_value=Response(200, text="<html></html>")
    )
    async with AsyncClient() as client:
        scraper = StatsGovScraper(client)
        data = await scraper.fetch_all()
        assert len(data.industries) == 5
        ids = {i.id for i in data.industries}
        assert ids == {"agriculture", "manufacturing", "finance", "education", "healthcare"}