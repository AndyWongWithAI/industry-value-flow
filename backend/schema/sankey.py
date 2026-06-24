from pydantic import BaseModel, Field
from schema.industry import Industry

class ValueFlowNode(BaseModel):
    id: str
    label: str
    layer: int = Field(ge=0)

class ValueFlowEdge(BaseModel):
    source: str
    target: str
    value: float = Field(gt=0.0)

class SankeyData(BaseModel):
    industries: list[Industry]
    nodes: list[ValueFlowNode]
    edges: list[ValueFlowEdge]
