"""KnowledgeGraph Pydantic v2 数据模型.

Spec: docs/superpowers/specs/2026-06-25-行业知识图谱重塑-design.md §3
"""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from .gbt4754 import is_valid_middle_category_code


class Category(str, Enum):
    """GB/T 4754 大类(A-T 共 20 类)."""

    A = "A"  # 农、林、牧、渔业
    B = "B"  # 采矿业
    C = "C"  # 制造业
    D = "D"  # 电力、热力、燃气及水生产和供应业
    E = "E"  # 建筑业
    F = "F"  # 批发和零售业
    G = "G"  # 交通运输、仓储和邮政业
    H = "H"  # 住宿和餐饮业
    I = "I"  # 信息传输、软件和信息技术服务业
    J = "J"  # 金融业
    K = "K"  # 房地产业
    L = "L"  # 租赁和商务服务业
    M = "M"  # 科学研究和技术服务业
    N = "N"  # 水利、环境和公共设施管理业
    O = "O"  # 居民服务、修理和其他服务业
    P = "P"  # 教育
    Q = "Q"  # 卫生和社会工作
    R = "R"  # 文化、体育和娱乐业
    S = "S"  # 公共管理、社会保障和社会组织
    T = "T"  # 国际组织


class RelationType(str, Enum):
    """行业间关系类型(单向 supports).

    v2 收敛(2026-06-25):原本 4 种(provide / rely_on / service / consume)统一为
    单一 `supports`,因为 LLM 同时生成这 4 类边时,`provide` 和 `rely_on` 实际是
    同一条边从两端看,导致重复 + 混乱。

    语义:A → B = A 支撑 B
        - A 是 B 的上游
        - 资源 / 服务 / 技术从 A 流向 B
        - B 的运营 / 生产 / 服务依赖 A
        - 单向边;**禁止生成反向 B → A**(即使语义看似对称)
    """

    supports = "supports"  # 支撑(单向,A 支撑 B)


class NodeStatus(str, Enum):
    """节点 / 边的生成状态(支持 partial failure 重跑)."""

    pending = "pending"  # 待生成
    generated = "generated"  # 成功生成
    failed = "failed"  # 生成失败


class GraphNode(BaseModel):
    """行业节点."""

    id: str  # GB/T 4754 中类代码
    label: str  # 中文名
    category: Category  # GB/T 4754 大类
    description: str  # LLM 生成的一句话描述
    status: NodeStatus = NodeStatus.pending
    failed_reason: str | None = None
    last_attempt_at: datetime | None = None

    @field_validator("id")
    @classmethod
    def _validate_id(cls, v: str) -> str:
        if not is_valid_middle_category_code(v):
            raise ValueError(
                f"id must be a valid GB/T 4754 middle category code, got {v!r}"
            )
        return v


class GraphEdge(BaseModel):
    """行业间边."""

    source: str  # 起点节点 id
    target: str  # 终点节点 id
    relation_type: RelationType
    weight: int = Field(ge=1, le=5)  # 关系强度 1-5
    explanation: str  # LLM 生成的一句话解释
    status: NodeStatus = NodeStatus.pending
    failed_reason: str | None = None
    last_attempt_at: datetime | None = None

    @field_validator("source", "target")
    @classmethod
    def _validate_endpoint(cls, v: str) -> str:
        if not is_valid_middle_category_code(v):
            raise ValueError(
                f"endpoint must be a valid GB/T 4754 middle category code, got {v!r}"
            )
        return v


class GraphStats(BaseModel):
    """图的生成统计(用于 partial failure 重跑)."""

    generated: int = 0
    failed: int = 0
    total: int = 0
    pending: int = 0


class KnowledgeGraph(BaseModel):
    """完整知识图谱."""

    nodes: list[GraphNode]
    edges: list[GraphEdge]
    generated_at: datetime
    llm_config_hash: str

    @field_validator("edges")
    @classmethod
    def _validate_edges_references(
        cls, v: list[GraphEdge], info
    ) -> list[GraphEdge]:
        """校验所有边的 source / target 都引用已存在的节点, 且禁止自环."""
        nodes = info.data.get("nodes", [])
        node_ids = {n.id for n in nodes}
        for edge in v:
            if edge.source not in node_ids:
                raise ValueError(
                    f"edge source {edge.source!r} not in nodes"
                )
            if edge.target not in node_ids:
                raise ValueError(
                    f"edge target {edge.target!r} not in nodes"
                )
            if edge.source == edge.target:
                raise ValueError(
                    f"edge self-loop: {edge.source}"
                )
        return v
