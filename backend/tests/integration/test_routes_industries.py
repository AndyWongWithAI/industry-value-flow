import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_get_industries():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/industries")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["industries"]) == 5
    assert data["year"] == 2024
    assert data["unit"] == "亿元"
    assert data["source"] is not None
    assert data["source_url"] is not None


@pytest.mark.asyncio
async def test_get_industry_by_id():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/industry/agriculture")
    assert resp.status_code == 200
    data = resp.json()
    assert data["industries"][0]["id"] == "agriculture"
    assert data["year"] == 2024
