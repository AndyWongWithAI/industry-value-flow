"""GraphRepo — 知识图谱节点/边的 SQLite 持久化适配器.

T3 spec:
- 每生成一个 node/edge 立即写库(支持 partial failure 持久化)
- 同步操作即可(本地单人 FastAPI + SQLite)
- 简单表结构:graph_nodes / graph_edges
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from schema.graph import (
    GraphEdge,
    GraphNode,
    KnowledgeGraph,
    NodeStatus,
)


class GraphRepo:
    """节点/边 SQLite 仓库 — 同步 API."""

    def __init__(self, db_path: str):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS graph_nodes (
                    id TEXT PRIMARY KEY,
                    label TEXT NOT NULL,
                    category TEXT NOT NULL,
                    description TEXT NOT NULL,
                    status TEXT NOT NULL,
                    failed_reason TEXT,
                    last_attempt_at TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS graph_edges (
                    source TEXT NOT NULL,
                    target TEXT NOT NULL,
                    relation_type TEXT NOT NULL,
                    weight INTEGER NOT NULL,
                    explanation TEXT NOT NULL,
                    status TEXT NOT NULL,
                    failed_reason TEXT,
                    last_attempt_at TEXT,
                    PRIMARY KEY (source, target, relation_type)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS graph_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            conn.commit()

    # ---------- nodes ----------

    def upsert_node(self, node: GraphNode) -> None:
        """插入或更新节点.partial failure 关键:立即持久化."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO graph_nodes (
                    id, label, category, description, status,
                    failed_reason, last_attempt_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    node.id,
                    node.label,
                    node.category.value,
                    node.description,
                    node.status.value,
                    node.failed_reason,
                    node.last_attempt_at.isoformat() if node.last_attempt_at else None,
                ),
            )
            conn.commit()

    def get_node(self, node_id: str) -> GraphNode | None:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT id, label, category, description, status, "
                "failed_reason, last_attempt_at FROM graph_nodes WHERE id = ?",
                (node_id,),
            ).fetchone()
        if row is None:
            return None
        return _row_to_node(row)

    def list_nodes(self) -> list[GraphNode]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT id, label, category, description, status, "
                "failed_reason, last_attempt_at FROM graph_nodes"
            ).fetchall()
        return [_row_to_node(r) for r in rows]

    def list_failed_nodes(self) -> list[GraphNode]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT id, label, category, description, status, "
                "failed_reason, last_attempt_at FROM graph_nodes "
                "WHERE status = ?",
                (NodeStatus.failed.value,),
            ).fetchall()
        return [_row_to_node(r) for r in rows]

    # ---------- edges ----------

    def upsert_edge(self, edge: GraphEdge) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO graph_edges (
                    source, target, relation_type, weight, explanation,
                    status, failed_reason, last_attempt_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    edge.source,
                    edge.target,
                    edge.relation_type.value,
                    edge.weight,
                    edge.explanation,
                    edge.status.value,
                    edge.failed_reason,
                    edge.last_attempt_at.isoformat() if edge.last_attempt_at else None,
                ),
            )
            conn.commit()

    def get_edge(self, source: str, target: str) -> GraphEdge | None:
        """按 (source, target, relation_type) 主键取一条边.

        T4: reexplain_edge 用 — 实时重解释需要先查到原边.
        返回 list 中第一条匹配的边(理论上同 source+target 只会有一种关系
        类型,主键带 relation_type 是为了支持未来多关系并存)。
        """
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT source, target, relation_type, weight, explanation, "
                "status, failed_reason, last_attempt_at FROM graph_edges "
                "WHERE source = ? AND target = ?",
                (source, target),
            ).fetchone()
        if row is None:
            return None
        return _row_to_edge(row)

    def list_edges(self) -> list[GraphEdge]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT source, target, relation_type, weight, explanation, "
                "status, failed_reason, last_attempt_at FROM graph_edges"
            ).fetchall()
        return [_row_to_edge(r) for r in rows]

    def list_failed_edges(self) -> list[GraphEdge]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT source, target, relation_type, weight, explanation, "
                "status, failed_reason, last_attempt_at FROM graph_edges "
                "WHERE status = ?",
                (NodeStatus.failed.value,),
            ).fetchall()
        return [_row_to_edge(r) for r in rows]

    # ---------- meta ----------

    def set_meta(self, key: str, value: str) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO graph_meta (key, value) VALUES (?, ?)",
                (key, value),
            )
            conn.commit()

    def get_meta(self, key: str) -> str | None:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT value FROM graph_meta WHERE key = ?", (key,)
            ).fetchone()
        return row[0] if row else None

    # ---------- composite ----------

    def load_graph(self, llm_config_hash: str) -> KnowledgeGraph | None:
        """从 DB 加载完整图.若 nodes 表为空,返回 None.

        llm_config_hash 用于标记本次生成的 LLM 配置;若表为空,返回 None.
        """
        nodes = self.list_nodes()
        if not nodes:
            return None
        edges = self.list_edges()
        generated_at = datetime.now(timezone.utc)
        return KnowledgeGraph(
            nodes=nodes,
            edges=edges,
            generated_at=generated_at,
            llm_config_hash=llm_config_hash,
        )

    def clear(self) -> None:
        """清空所有图数据(测试用 + 切 provider 时可能用到)."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM graph_nodes")
            conn.execute("DELETE FROM graph_edges")
            conn.execute("DELETE FROM graph_meta")
            conn.commit()

    def replace_full(self, graph: KnowledgeGraph) -> None:
        """全量替换图数据(LLM 整体重生成时使用)."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM graph_nodes")
            conn.execute("DELETE FROM graph_edges")
            for n in graph.nodes:
                conn.execute(
                    "INSERT OR REPLACE INTO graph_nodes "
                    "(id, label, category, description, status, "
                    "failed_reason, last_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        n.id,
                        n.label,
                        n.category.value,
                        n.description,
                        n.status.value,
                        n.failed_reason,
                        n.last_attempt_at.isoformat() if n.last_attempt_at else None,
                    ),
                )
            for e in graph.edges:
                conn.execute(
                    "INSERT OR REPLACE INTO graph_edges "
                    "(source, target, relation_type, weight, explanation, "
                    "status, failed_reason, last_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        e.source,
                        e.target,
                        e.relation_type.value,
                        e.weight,
                        e.explanation,
                        e.status.value,
                        e.failed_reason,
                        e.last_attempt_at.isoformat() if e.last_attempt_at else None,
                    ),
                )
            conn.execute(
                "INSERT OR REPLACE INTO graph_meta (key, value) VALUES (?, ?)",
                ("generated_at", graph.generated_at.isoformat()),
            )
            conn.execute(
                "INSERT OR REPLACE INTO graph_meta (key, value) VALUES (?, ?)",
                ("llm_config_hash", graph.llm_config_hash),
            )
            conn.commit()


# ---------- helpers ----------


def _row_to_node(row: tuple) -> GraphNode:
    node_id, label, category, description, status, failed_reason, last_attempt_at = row
    return GraphNode(
        id=node_id,
        label=label,
        category=category,
        description=description,
        status=NodeStatus(status),
        failed_reason=failed_reason,
        last_attempt_at=(
            datetime.fromisoformat(last_attempt_at) if last_attempt_at else None
        ),
    )


def _row_to_edge(row: tuple) -> GraphEdge:
    source, target, relation_type, weight, explanation, status, failed_reason, last_attempt_at = row
    return GraphEdge(
        source=source,
        target=target,
        relation_type=relation_type,
        weight=weight,
        explanation=explanation,
        status=NodeStatus(status),
        failed_reason=failed_reason,
        last_attempt_at=(
            datetime.fromisoformat(last_attempt_at) if last_attempt_at else None
        ),
    )
