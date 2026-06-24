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


@pytest.mark.asyncio
async def test_fetch_healthcare_returns_4_real_subindustries():
    """医疗子行业:4 类机构数(2024 万个),口径是机构数而非增加值。"""
    async with AsyncClient() as client:
        scraper = IndustryAssociationScraper(client)
        data = await scraper.fetch("healthcare")
    assert isinstance(data, SankeyData)
    ids = {n.id for n in data.nodes}
    expected = {"med_hospital", "med_grassroot", "med_public_health", "med_other", "med_total", "patients"}
    assert expected.issubset(ids)
    assert data.unit == "万个"
    assert data.year == 2024
    assert data.source is not None
    assert "卫健委" in data.source or "卫生" in data.source
    hospital_edge = [e for e in data.edges if e.source == "med_hospital"]
    assert len(hospital_edge) == 1
    assert hospital_edge[0].value == pytest.approx(38.5, rel=0.01)