import pytest
from pydantic import ValidationError
from schema.sankey import ValueFlowNode, ValueFlowEdge, SankeyData
from schema.industry import Industry


def test_node_creation():
    n = ValueFlowNode(id="n1", label="种植", layer=0)
    assert n.layer == 0


def test_edge_negative_value_rejected():
    with pytest.raises(ValidationError):
        ValueFlowEdge(source="n1", target="n2", value=-1.0)


def test_edge_zero_value_allowed():
    """2024 真实数据会出现 0 值(如某小类未单列),必须允许。"""
    e = ValueFlowEdge(source="n1", target="n2", value=0.0)
    assert e.value == 0.0


def test_sankey_data_assembly():
    inds = [Industry(id="agriculture", name="农业", color="#4a90e2")]
    nodes = [ValueFlowNode(id="a", label="种植", layer=0)]
    edges = [ValueFlowEdge(source="a", target="b", value=100.0)]
    data = SankeyData(industries=inds, nodes=nodes, edges=edges)
    assert len(data.industries) == 1


# ---- 新字段 ----

def test_sankey_data_with_source_year_unit_source_url():
    data = SankeyData(
        industries=[Industry(id="agriculture", name="农业", color="#4a90e2")],
        nodes=[ValueFlowNode(id="a", label="种植", layer=0)],
        edges=[ValueFlowEdge(source="a", target="b", value=100.0)],
        source="国家统计局 2024 年公报",
        year=2024,
        unit="亿元",
        source_url="https://data.stats.gov.cn/",
    )
    j = data.model_dump()
    assert j["source"] == "国家统计局 2024 年公报"
    assert j["year"] == 2024
    assert j["unit"] == "亿元"
    assert j["source_url"] == "https://data.stats.gov.cn/"


def test_sankey_data_source_optional():
    """source=None 必须通过(向后兼容旧调用点)。"""
    data = SankeyData(
        industries=[Industry(id="agriculture", name="农业", color="#4a90e2")],
        nodes=[],
        edges=[],
    )
    assert data.source is None
    assert data.year is None
    assert data.unit == "亿元"  # 默认
    assert data.source_url is None
