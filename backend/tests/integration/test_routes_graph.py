"""T4: /api/graph + /api/node + /api/edge 路由层集成测试.

测试策略:
- 用 TestClient 触发 FastAPI app
- Mock 掉 GraphService (不真调 LLM,不走 SQLite)
- 覆盖 spec §4.5 列出的 10 个核心 case
"""
from __future__ import annotations

import importlib
import sys
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from domain.graph.graph_service import LLMUnavailableError
from schema.graph import (
    Category,
    GraphEdge,
    GraphNode,
    GraphStats,
    KnowledgeGraph,
    NodeStatus,
    RelationType,
)


# ---------- helpers ----------


def _make_node(
    code: str,
    status: NodeStatus = NodeStatus.generated,
    failed_reason: str | None = None,
) -> GraphNode:
    return GraphNode(
        id=code,
        label=f"label-{code}",
        category=Category.B,
        description=f"desc for {code}",
        status=status,
        failed_reason=failed_reason,
        last_attempt_at=datetime(2026, 6, 25, 10, 30, 0, tzinfo=timezone.utc),
    )


def _make_edge(
    source: str,
    target: str,
    status: NodeStatus = NodeStatus.generated,
) -> GraphEdge:
    return GraphEdge(
        source=source,
        target=target,
        relation_type=RelationType.supports,
        weight=3,
        explanation=f"edge {source}->{target}",
        status=status,
        failed_reason=None,
        last_attempt_at=datetime(2026, 6, 25, 10, 30, 0, tzinfo=timezone.utc),
    )


def _make_graph(
    node_codes: list[str],
    edge_pairs: list[tuple[str, str]],
) -> KnowledgeGraph:
    return KnowledgeGraph(
        nodes=[_make_node(c) for c in node_codes],
        edges=[_make_edge(s, t) for s, t in edge_pairs],
        generated_at=datetime(2026, 6, 25, 10, 30, 0, tzinfo=timezone.utc),
        llm_config_hash="hash-abc",
    )


# ---------- fixture: 注入 mock GraphService ----------


@pytest.fixture
def mock_service() -> MagicMock:
    """Mock GraphService — 默认全部成功,各测试按需 override."""
    svc = MagicMock()
    svc.init_or_load_graph = AsyncMock()
    svc.regenerate_failed = AsyncMock()
    svc.compute_stats = MagicMock()
    return svc


@pytest.fixture
def client(mock_service: MagicMock, monkeypatch, tmp_path):
    """isolated FastAPI client + mock GraphService 注入到 app.state.

    注意:TestClient __enter__ 会跑 lifespan,可能覆盖 app.state。
    所以注入放在 lifespan 之后(inside `with` block)。
    """
    monkeypatch.setenv("IVF_CONFIG_DIR", str(tmp_path))
    # 重新加载 config 让 get_db_path() 走 tmp_path
    if "config" in sys.modules:
        importlib.reload(sys.modules["config"])
    if "main" in sys.modules:
        importlib.reload(sys.modules["main"])
    from main import app  # noqa: F401

    with TestClient(app) as c:
        # 在 lifespan 跑完后注入 mock
        c.app.state.graph_service = mock_service
        yield c


# ---------- Step 1: GET /api/graph 正常 ----------


def test_get_graph_success(client, mock_service):
    """GET /api/graph 正常返回 nodes/edges/stats."""
    graph = _make_graph(
        node_codes=["B06", "C17"],
        edge_pairs=[("B06", "C17")],
    )
    mock_service.init_or_load_graph.return_value = graph
    mock_service.compute_stats.return_value = GraphStats(
        generated=2, failed=0, total=3, pending=1
    )

    resp = client.get("/api/graph")
    assert resp.status_code == 200
    body = resp.json()
    assert "nodes" in body
    assert "edges" in body
    assert "stats" in body
    assert len(body["nodes"]) == 2
    assert len(body["edges"]) == 1
    assert body["stats"]["total"] == 3
    assert body["stats"]["generated"] == 2
    mock_service.init_or_load_graph.assert_awaited_once()
    mock_service.compute_stats.assert_called_once_with(graph)


# ---------- Step 2: GET /api/graph LLM 不可用 ----------


def test_get_graph_llm_unavailable(client, mock_service):
    """LLM 不可用 -> 503 + llm_unavailable."""
    mock_service.init_or_load_graph.side_effect = LLMUnavailableError(
        "no key"
    )

    resp = client.get("/api/graph")
    assert resp.status_code == 503
    body = resp.json()
    assert body["error"] == "llm_unavailable"
    assert "message" in body


# ---------- Step 3: GET /api/node/{id} ----------


def test_get_node_found(client, mock_service):
    """GET /api/node/{id} 存在 -> 200 + 节点数据."""
    graph = _make_graph(node_codes=["B06"], edge_pairs=[])
    mock_service.init_or_load_graph.return_value = graph

    resp = client.get("/api/node/B06")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "B06"
    assert body["label"] == "label-B06"
    assert body["category"] == "B"
    assert body["status"] == "generated"


def test_get_node_not_found(client, mock_service):
    """GET /api/node/{id} 不存在 -> 404 + node_not_found."""
    graph = _make_graph(node_codes=["B06"], edge_pairs=[])
    mock_service.init_or_load_graph.return_value = graph

    resp = client.get("/api/node/NOPE")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"] == "node_not_found"
    assert body["id"] == "NOPE"


# ---------- Step 4: GET /api/edge/{id} ----------


def test_get_edge_found(client, mock_service):
    """GET /api/edge/{id} 存在 -> 200 + 边数据(id 格式 source-target)."""
    graph = _make_graph(
        node_codes=["B06", "C17"], edge_pairs=[("B06", "C17")]
    )
    mock_service.init_or_load_graph.return_value = graph

    resp = client.get("/api/edge/B06-C17")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "B06"
    assert body["target"] == "C17"
    assert body["relation_type"] == "supports"
    assert body["weight"] == 3


def test_get_edge_not_found(client, mock_service):
    """GET /api/edge/{id} 不存在 -> 404 + edge_not_found."""
    graph = _make_graph(
        node_codes=["B06", "C17"], edge_pairs=[("B06", "C17")]
    )
    mock_service.init_or_load_graph.return_value = graph

    resp = client.get("/api/edge/B06-MISS")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"] == "edge_not_found"
    assert body["id"] == "B06-MISS"


# ---------- Step 5: GET /api/edge/{id}/explain ----------


def test_get_edge_explain_success(client, mock_service):
    """GET /api/edge/{id}/explain 正常 -> 200 + 解释文本."""
    explain_payload = {
        "edge_id": "B06-C17",
        "explanation": "矿业为制造业提供原材料,构成产业链上游支撑。",
        "generated_at": "2026-06-25T10:30:00Z",
    }
    # 加 reexplain_edge 方法到 mock
    mock_service.reexplain_edge = AsyncMock(return_value=explain_payload)

    resp = client.get("/api/edge/B06-C17/explain")
    assert resp.status_code == 200
    body = resp.json()
    assert body["edge_id"] == "B06-C17"
    assert "矿业" in body["explanation"]
    assert "generated_at" in body
    mock_service.reexplain_edge.assert_awaited_once_with("B06-C17")


def test_get_edge_explain_edge_not_found(client, mock_service):
    """GET /api/edge/{id}/explain 边不存在 -> 404."""
    mock_service.reexplain_edge = AsyncMock(
        side_effect=KeyError("edge not found: B06-MISS")
    )

    resp = client.get("/api/edge/B06-MISS/explain")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"] == "edge_not_found"
    assert body["id"] == "B06-MISS"


def test_get_edge_explain_llm_unavailable(client, mock_service):
    """GET /api/edge/{id}/explain LLM 不可用 -> 503."""
    mock_service.reexplain_edge = AsyncMock(
        side_effect=LLMUnavailableError("provider dead")
    )

    resp = client.get("/api/edge/B06-C17/explain")
    assert resp.status_code == 503
    body = resp.json()
    assert body["error"] == "llm_unavailable"


# ---------- Step 6: POST /api/graph/regenerate-failed ----------


def test_regenerate_failed_all(client, mock_service):
    """POST /api/graph/regenerate-failed scope=all -> 200 + 更新图."""
    new_graph = _make_graph(
        node_codes=["B06", "C17"], edge_pairs=[("B06", "C17")]
    )
    mock_service.regenerate_failed.return_value = new_graph
    mock_service.compute_stats.return_value = GraphStats(
        generated=3, failed=0, total=3, pending=0
    )

    resp = client.post(
        "/api/graph/regenerate-failed", json={"scope": "all"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "nodes" in body
    assert "edges" in body
    assert "stats" in body
    assert body["stats"]["generated"] == 3
    mock_service.regenerate_failed.assert_awaited_once_with(scope="all")


def test_regenerate_failed_nodes(client, mock_service):
    """POST /api/graph/regenerate-failed scope=nodes -> 200."""
    new_graph = _make_graph(node_codes=["B06"], edge_pairs=[])
    mock_service.regenerate_failed.return_value = new_graph
    mock_service.compute_stats.return_value = GraphStats(
        generated=1, failed=0, total=1, pending=0
    )

    resp = client.post(
        "/api/graph/regenerate-failed", json={"scope": "nodes"}
    )
    assert resp.status_code == 200
    mock_service.regenerate_failed.assert_awaited_once_with(scope="nodes")


def test_regenerate_failed_invalid_scope(client, mock_service):
    """POST /api/graph/regenerate-failed scope=invalid -> 400."""
    resp = client.post(
        "/api/graph/regenerate-failed", json={"scope": "bogus"}
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["error"] == "invalid_scope"
    assert body["scope"] == "bogus"
    mock_service.regenerate_failed.assert_not_awaited()


def test_regenerate_failed_llm_unavailable(client, mock_service):
    """POST /api/graph/regenerate-failed LLM 不可用 -> 503."""
    mock_service.regenerate_failed.side_effect = LLMUnavailableError(
        "no key"
    )

    resp = client.post(
        "/api/graph/regenerate-failed", json={"scope": "all"}
    )
    assert resp.status_code == 503
    body = resp.json()
    assert body["error"] == "llm_unavailable"
