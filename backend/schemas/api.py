"""API 层 Pydantic 模型 — request / response shapes.

与 schema.graph (核心数据模型) 分开:
- schema.graph = 领域核心(GraphNode/GraphEdge/KnowledgeGraph)
- schemas.api = HTTP wire format (RegenerateRequest / ExplainResponse)

注意:避免和 backend.schema 命名冲突 → 用单数 schemas (FastAPI 不会 import 它).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RegenerateRequest(BaseModel):
    """POST /api/graph/regenerate-failed request body.

    注意:scope 不在 schema 上做 Literal 校验(否则 Pydantic 422),
    而是在 route 层手工校验,让 spec §4.4 要求的 400 而不是 422。
    """

    scope: Optional[str] = "all"


class ExplainResponse(BaseModel):
    """GET /api/edge/{id}/explain response."""

    edge_id: str
    explanation: str
    generated_at: datetime
