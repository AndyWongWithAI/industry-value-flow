"""T4: 知识图谱 HTTP 路由层.

5 个端点:
- GET    /api/graph                    拉完整图
- GET    /api/node/{id}                单节点详情
- GET    /api/edge/{id}                单边详情
- GET    /api/edge/{id}/explain        实时重解释
- POST   /api/graph/regenerate-failed  重跑 failed nodes/edges

设计:
- edge_id 格式: "{source}-{target}" (e.g. "B06-C17")
- 不使用全局单例,GraphService 由 main.py lifespan 构造,通过 Depends 注入
- 错误统一为 4 个 HTTP code: 400(参数) / 404(资源) / 503(LLM) / 500(其他)
- 错误 body 用 JSONResponse 直接返回,避免 FastAPI 的 {"detail": ...} 包装
  (spec §4.4 明确要求 body = {"error": ..., "message": ...} 或 {"error": ..., "id": ...})
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from domain.graph.graph_service import GraphService, LLMUnavailableError
from schemas.api import ExplainResponse, RegenerateRequest


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["graph"])


# ---------- error helpers ----------


def _err(status: int, **payload: Any) -> JSONResponse:
    """统一错误响应(直出 JSON,不被 FastAPI 包 detail)."""
    return JSONResponse(status_code=status, content=payload)


# ---------- DI ----------


def get_graph_service(request: Request) -> GraphService | None:
    """从 app.state 取 GraphService(lifespan 在 main.py 启动时构造)."""
    return getattr(request.app.state, "graph_service", None)


def get_startup_error(request: Request) -> str | None:
    """从 app.state 取 startup_error(T7 加).

    用途:路由返回 503 时,如果 lifespan 记录了 startup_error,
    就用它的文案作为 message,让前端的 EmptyState 能展示具体原因
    (LLM 未配置 / client 创建失败 / GraphService 构造失败 等)。
    """
    return getattr(request.app.state, "startup_error", None)


def _unavailable_message(startup_error: str | None, fallback: str) -> str:
    """拼装 503 message:优先用 startup_error,缺省走 fallback."""
    return startup_error or fallback


# ---------- GET /api/graph ----------


@router.get("/graph")
async def get_graph(
    svc: GraphService | None = Depends(get_graph_service),
    startup_error: str | None = Depends(get_startup_error),
) -> Any:
    """拉完整知识图谱(react-flow 启动渲染用)."""
    if svc is None:
        msg = _unavailable_message(startup_error, "请配置 LLM")
        return _err(503, error="llm_unavailable", message=msg)
    try:
        graph = await svc.init_or_load_graph()
    except LLMUnavailableError as e:
        logger.warning("GET /api/graph LLM unavailable: %s", e)
        return _err(
            503,
            error="llm_unavailable",
            message=_unavailable_message(str(e) or None, "请配置 LLM"),
        )
    stats = svc.compute_stats(graph)
    return {
        **graph.model_dump(mode="json"),
        "stats": stats.model_dump(mode="json"),
    }


# ---------- GET /api/node/{id} ----------


@router.get("/node/{node_id}")
async def get_node(
    node_id: str,
    svc: GraphService | None = Depends(get_graph_service),
    startup_error: str | None = Depends(get_startup_error),
) -> Any:
    """单节点详情(NodePanel 用)."""
    if svc is None:
        msg = _unavailable_message(startup_error, "请配置 LLM")
        return _err(503, error="llm_unavailable", message=msg)
    try:
        graph = await svc.init_or_load_graph()
    except LLMUnavailableError as e:
        logger.warning("GET /api/node/%s LLM unavailable: %s", node_id, e)
        return _err(
            503,
            error="llm_unavailable",
            message=_unavailable_message(str(e) or None, "请配置 LLM"),
        )

    for node in graph.nodes:
        if node.id == node_id:
            return node.model_dump(mode="json")
    return _err(404, error="node_not_found", id=node_id)


# ---------- GET /api/edge/{id} ----------


@router.get("/edge/{edge_id}")
async def get_edge(
    edge_id: str,
    svc: GraphService | None = Depends(get_graph_service),
) -> Any:
    """单边详情(EdgePanel 用). edge_id 格式: {source}-{target}."""
    if svc is None:
        return _err(503, error="llm_unavailable", message="请配置 LLM")
    try:
        graph = await svc.init_or_load_graph()
    except LLMUnavailableError as e:
        logger.warning("GET /api/edge/%s LLM unavailable: %s", edge_id, e)
        return _err(503, error="llm_unavailable", message="请配置 LLM")

    parsed = _parse_edge_id(edge_id)
    if parsed is None:
        return _err(404, error="edge_not_found", id=edge_id)
    source, target = parsed
    for edge in graph.edges:
        if edge.source == source and edge.target == target:
            return edge.model_dump(mode="json")
    return _err(404, error="edge_not_found", id=edge_id)


# ---------- GET /api/edge/{id}/explain ----------


@router.get("/edge/{edge_id}/explain", response_model=ExplainResponse)
async def get_edge_explain(
    edge_id: str,
    svc: GraphService | None = Depends(get_graph_service),
) -> Any:
    """实时 LLM 重新解释这条边(EdgePanel "重新解释" 按钮)."""
    if svc is None:
        return _err(503, error="llm_unavailable", message="请配置 LLM")
    try:
        result = await svc.reexplain_edge(edge_id)
    except LLMUnavailableError as e:
        logger.warning("GET /api/edge/%s/explain LLM unavailable: %s", edge_id, e)
        return _err(503, error="llm_unavailable", message="请配置 LLM")
    except KeyError:
        # 边不存在 / edge_id 格式错
        return _err(404, error="edge_not_found", id=edge_id)
    return result


# ---------- POST /api/graph/regenerate-failed ----------


@router.post("/graph/regenerate-failed")
async def regenerate_failed(
    body: RegenerateRequest,
    svc: GraphService | None = Depends(get_graph_service),
) -> Any:
    """重跑 failed 节点/边.返回最新 KnowledgeGraph + stats."""
    if svc is None:
        return _err(503, error="llm_unavailable", message="请配置 LLM")
    # RegenerateRequest 已经用 Literal 校验(spec 422 默认),
    # 但 spec §4.4 要求 400,所以这里再手工校验一次
    if body.scope not in ("nodes", "edges", "all"):
        return _err(400, error="invalid_scope", scope=body.scope)

    try:
        graph = await svc.regenerate_failed(scope=body.scope)
    except LLMUnavailableError as e:
        logger.warning("POST regenerate-failed LLM unavailable: %s", e)
        return _err(503, error="llm_unavailable", message="请配置 LLM")
    stats = svc.compute_stats(graph)
    return {
        **graph.model_dump(mode="json"),
        "stats": stats.model_dump(mode="json"),
    }


# ---------- helpers ----------


def _parse_edge_id(edge_id: str) -> tuple[str, str] | None:
    """解析 'B06-C17' → ('B06', 'C17'). 失败 → None."""
    if "-" not in edge_id:
        return None
    parts = edge_id.split("-", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0], parts[1]
