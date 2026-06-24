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

def test_sankey_data_assembly():
    inds = [Industry(id="agriculture", name="农业", color="#4a90e2")]
    nodes = [ValueFlowNode(id="a", label="种植", layer=0)]
    edges = [ValueFlowEdge(source="a", target="b", value=100.0)]
    data = SankeyData(industries=inds, nodes=nodes, edges=edges)
    assert len(data.industries) == 1
