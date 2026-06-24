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
async def test_fetch_education_returns_8_real_subindustries():
    """教育子行业:8 学段硬编码真实 2024 在校生数(万人),单位不同。"""
    async with AsyncClient() as client:
        scraper = IndustryAssociationScraper(client)
        data = await scraper.fetch("education")
    assert isinstance(data, SankeyData)
    ids = {n.id for n in data.nodes}
    # 8 个语义化 id
    expected = {
        "edu_preschool", "edu_primary", "edu_junior", "edu_senior",
        "edu_voc_junior", "edu_voc_senior", "edu_undergrad", "edu_grad",
        "edu_total", "workforce",
    }
    assert expected.issubset(ids)
    assert data.unit == "万人"
    assert data.year == 2024
    assert data.source is not None
    assert "教育部" in data.source
    # 抽查真实值:小学在校生 10,584 万
    primary_to_total = [e for e in data.edges if e.source == "edu_primary"]
    assert len(primary_to_total) == 1
    assert primary_to_total[0].value == pytest.approx(10584.0, rel=0.01)


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


# ---- T6:金融业新叙事(资金来源 → 金融机构 → 资金运用) ----

@pytest.mark.asyncio
async def test_fetch_finance_returns_3layer_9plus_nodes():
    """金融业新叙事:资金来源 → 金融机构 → 资金运用,9 节点,单位万亿元。"""
    async with AsyncClient() as client:
        scraper = IndustryAssociationScraper(client)
        data = await scraper.fetch("finance")
    ids = {n.id for n in data.nodes}
    expected = {
        # layer 0: 资金来源
        "fin_src_household_dep", "fin_src_corp_dep",
        # layer 1: 金融机构
        "fin_inst_bank", "fin_inst_sec", "fin_inst_ins",
        # layer 2: 资金运用
        "fin_use_loan", "fin_use_premium", "fin_use_raised",
    }
    assert expected.issubset(ids)
    assert data.unit == "万亿元"
    assert data.year == 2024
    assert data.source is not None
    assert "央行" in data.source or "人民银行" in data.source
    # 3 层都至少有节点
    layers = {n.layer for n in data.nodes}
    assert {0, 1, 2}.issubset(layers)


@pytest.mark.asyncio
async def test_fetch_finance_uses_correct_unit_and_source_url():
    """金融业 footer 应有央行/银保监会/证监会 链接。"""
    async with AsyncClient() as client:
        scraper = IndustryAssociationScraper(client)
        data = await scraper.fetch("finance")
    assert data.unit == "万亿元"
    assert data.source_url is not None
    # 抽查:住户存款 → 银行机构(应有 edge)
    edges_into_bank = [e for e in data.edges if e.target == "fin_inst_bank"]
    assert len(edges_into_bank) >= 1
    # 抽查:银行机构 → 各项贷款(应有 edge)
    edges_from_bank = [e for e in data.edges if e.source == "fin_inst_bank"]
    assert len(edges_from_bank) >= 1