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


@pytest.mark.asyncio
async def test_get_industry_by_id():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/industry/agriculture")
    assert resp.status_code == 200
    data = resp.json()
    assert data["industries"][0]["id"] == "agriculture"