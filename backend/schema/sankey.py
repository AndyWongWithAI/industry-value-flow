from pydantic import BaseModel, Field
from schema.industry import Industry


class ValueFlowNode(BaseModel):
    id: str
    label: str
    layer: int = Field(ge=0)


class ValueFlowEdge(BaseModel):
    source: str
    target: str
    # 2024 真实数据会出现 0 值(如某小类未单列),放宽为 ge=0.0
    value: float = Field(ge=0.0)


class SankeyData(BaseModel):
    industries: list[Industry]
    nodes: list[ValueFlowNode]
    edges: list[ValueFlowEdge]
    source: str | None = None          # 数据来源说明,例 "国家统计局 2024 年公报"
    source_url: str | None = None      # 原始数据链接
    year: int | None = None            # 数据年度,默认 2024
    unit: str = "亿元"                  # 单位,例 "亿元" / "万人" / "万亿元"
