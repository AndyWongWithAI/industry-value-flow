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


@pytest.mark.asyncio
async def test_get_education_route():
    """T3:教育子行业路由集成测试,断言 8 学段 + 单位万人 + source 教育部。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/industry/education")
    assert resp.status_code == 200
    data = resp.json()
    ids = {n["id"] for n in data["nodes"]}
    expected = {
        "edu_preschool", "edu_primary", "edu_junior", "edu_senior",
        "edu_voc_junior", "edu_voc_senior", "edu_undergrad", "edu_grad",
    }
    assert expected.issubset(ids)
    assert data["unit"] == "万人"
    assert data["year"] == 2024
    assert "教育部" in data["source"]
