import pytest
from httpx import AsyncClient
from domain.scraper.industry_association import IndustryAssociationScraper
from schema.sankey import SankeyData


@pytest.mark.asyncio
async def test_fetch_all_returns_sankey():
    async with AsyncClient() as client:
        scraper = IndustryAssociationScraper(client)
        data = await scraper.fetch_all()
        assert isinstance(data, SankeyData)
        assert len(data.industries) == 5