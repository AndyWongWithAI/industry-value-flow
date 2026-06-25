"""T3: GraphService 测试.

TDD 顺序:
  1. cache hit (init_or_load_graph 不调 LLM)
  2. cache miss (init_or_load_graph 调 LLM,生成完整图)
  3. LLM 不可用 -> 抛 LLMUnavailableError
  4. partial failure (5 个节点中第 5 个失败 -> 持久化前 4 + failed 1)
  5. regenerate_failed(scope="all")
  6. regenerate_failed(scope="nodes")
  7. 节点 code 不在白名单 -> 拒收
  8. llm_config_hash 变化 -> 缓存失效
  9. 边 source/target 引用不存在的节点 -> 拒收
 10. 重复调 init_or_load_graph 不会重复生成
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

# 让测试能 import backend.* (conftest 已经设了 path)
from domain.graph.graph_service import (
    DEFAULT_NODE_CODES,
    LLMUnavailableError,
    GraphService,
)
from domain.storage.cache import Cache
from domain.storage.graph_repo import GraphRepo
from schema.gbt4754 import GBT4754_MIDDLE_CATEGORIES
from schema.graph import (
    Category,
    GraphEdge,
    GraphNode,
    GraphStats,
    KnowledgeGraph,
    NodeStatus,
    RelationType,
)


# ---------- fixtures ----------


@pytest.fixture
def llm_client() -> MagicMock:
    """Mock LLM client(name=claude, model, api_key 都设置好)."""
    client = MagicMock()
    client.name = "claude"
    client.default_model = "claude-test-1"
    client.api_key = "sk-ant-test-12345678"
    # 默认 generate 抛 LLMUnavailableError(各测试按需 override)
    client.generate = AsyncMock(side_effect=LLMUnavailableError("not configured"))
    return client


@pytest.fixture
def storage(tmp_path: Path) -> GraphRepo:
    return GraphRepo(str(tmp_path / "graph.db"))


@pytest.fixture
def cache(tmp_path: Path) -> Cache:
    return Cache(str(tmp_path / "cache.db"))


@pytest.fixture
def service(llm_client, storage, cache) -> GraphService:
    return GraphService(llm_client=llm_client, storage=storage, cache=cache)


def _make_node(
    code: str,
    status: NodeStatus = NodeStatus.generated,
    description: str = "test desc",
    failed_reason: str | None = None,
) -> GraphNode:
    """构造一个合法 GraphNode(走白名单)."""
    label_map = {item["code"]: item["label"] for item in GBT4754_MIDDLE_CATEGORIES}
    cat_map = {item["code"]: item["category"] for item in GBT4754_MIDDLE_CATEGORIES}
    return GraphNode(
        id=code,
        label=label_map.get(code, code),
        category=Category(cat_map.get(code, "A")),
        description=description,
        status=status,
        failed_reason=failed_reason,
        last_attempt_at=datetime.now(timezone.utc) if status != NodeStatus.pending else None,
    )


def _make_edge(
    src: str,
    tgt: str,
    status: NodeStatus = NodeStatus.generated,
    weight: int = 3,
    explanation: str = "test edge",
    failed_reason: str | None = None,
) -> GraphEdge:
    return GraphEdge(
        source=src,
        target=tgt,
        relation_type=RelationType.provide,
        weight=weight,
        explanation=explanation,
        status=status,
        failed_reason=failed_reason,
        last_attempt_at=datetime.now(timezone.utc) if status != NodeStatus.pending else None,
    )


# ============================================================
# Step 1: cache hit
# ============================================================


class TestInitCacheHit:
    @pytest.mark.asyncio
    async def test_cache_hit_does_not_call_llm(
        self, service, llm_client, cache
    ):
        """cache 命中:init_or_load_graph 直接返回缓存,LLM 不被调."""
        # 预填 cache
        cached_graph = KnowledgeGraph(
            nodes=[_make_node("A01"), _make_node("B06")],
            edges=[_make_edge("A01", "B06")],
            generated_at=datetime(2026, 6, 25),
            llm_config_hash=service._compute_config_hash(),
        )
        cache_key = f"graph:v1:{service._compute_config_hash()}"
        cache.set(
            cache_key,
            cached_graph.model_dump(mode="json"),
            ttl_seconds=7 * 24 * 3600,
        )

        # LLM 应该不被调
        result = await service.init_or_load_graph()

        assert result.llm_config_hash == cached_graph.llm_config_hash
        assert len(result.nodes) == 2
        llm_client.generate.assert_not_called()


# ============================================================
# Step 2: cache miss -> 调 LLM,生成完整图,写缓存
# ============================================================


class TestInitCacheMiss:
    @pytest.mark.asyncio
    async def test_cache_miss_calls_llm_and_writes_cache(
        self, service, llm_client, cache
    ):
        """cache miss:调 LLM,生成完整图,写缓存,DB 也有数据."""

        # 让 LLM 返回合理结果(节点用纯文本,边用 JSON)
        async def fake_generate(prompt: str) -> str:
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                return json.dumps(
                    {
                        "relation_type": "provide",
                        "weight": 3,
                        "explanation": "x",
                    },
                    ensure_ascii=False,
                )
            # 节点描述 prompt
            return f"mocked description for {prompt.split('行业代码:')[1].split()[0]}"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result = await service.init_or_load_graph()

        # 节点都生成了
        assert all(n.status == NodeStatus.generated for n in result.nodes)
        assert all(e.status == NodeStatus.generated for e in result.edges)
        # LLM 被调了 >= node 数量
        assert llm_client.generate.call_count >= len(service.node_codes)
        # cache 写了
        cache_key = f"graph:v1:{service._compute_config_hash()}"
        assert cache.get(cache_key) is not None


# ============================================================
# Step 3: LLM 不可用 -> 抛 LLMUnavailableError
# ============================================================


class TestInitLLMUnavailable:
    @pytest.mark.asyncio
    async def test_llm_unavailable_raises_and_no_cache(
        self, service, llm_client, cache
    ):
        """LLM 整体不可用 -> 抛 LLMUnavailableError,不写缓存."""

        async def fake_generate(prompt: str) -> str:
            raise LLMUnavailableError("network down")

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        with pytest.raises(LLMUnavailableError):
            await service.init_or_load_graph()

        # cache 没写
        cache_key = f"graph:v1:{service._compute_config_hash()}"
        assert cache.get(cache_key) is None


# ============================================================
# Step 4: partial failure 持久化
# ============================================================


class TestPartialFailure:
    @pytest.mark.asyncio
    async def test_partial_failure_persists_successful_nodes(
        self, service, llm_client
    ):
        """5 个节点中第 5 个失败 -> 前 4 个持久化为 generated,第 5 个 failed,继续生成第 6+."""

        # 选 5 个不同的 GB/T 4754 代码
        codes = ["A01", "B06", "C17", "D44", "F51"]
        service.node_codes = codes

        call_count = {"n": 0}

        async def fake_generate(prompt: str) -> str:
            call_count["n"] += 1
            # 第 5 个 prompt 抛普通异常(模拟 LLM 瞬断)
            if call_count["n"] == 5:
                raise RuntimeError("simulated transient LLM error")
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                return json.dumps(
                    {"relation_type": "provide", "weight": 3, "explanation": "x"},
                    ensure_ascii=False,
                )
            return f"description #{call_count['n']}"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        # 用 5 节点的子集生成
        result = await service.init_or_load_graph()

        # 5 个节点都应在(4 generated + 1 failed)
        assert len(result.nodes) == 5
        failed = [n for n in result.nodes if n.status == NodeStatus.failed]
        generated = [n for n in result.nodes if n.status == NodeStatus.generated]
        assert len(failed) == 1
        assert len(generated) == 4
        # failed 节点有 reason
        assert failed[0].failed_reason is not None
        assert "simulated" in failed[0].failed_reason

        # DB 中前 4 个已持久化为 generated
        for code in codes[:4]:
            node = service.storage.get_node(code)
            assert node is not None
            assert node.status == NodeStatus.generated
        # DB 中第 5 个是 failed
        node5 = service.storage.get_node(codes[4])
        assert node5 is not None
        assert node5.status == NodeStatus.failed


# ============================================================
# Step 5: regenerate_failed(scope="all")
# ============================================================


class TestRegenerateFailed:
    @pytest.mark.asyncio
    async def test_regenerate_failed_all(
        self, service, llm_client, storage
    ):
        """regenerate_failed(scope='all'):重跑所有 failed 节点/边."""

        # 预填:1 generated node,1 failed node
        storage.upsert_node(_make_node("A01", status=NodeStatus.generated))
        storage.upsert_node(
            _make_node("B06", status=NodeStatus.failed, failed_reason="old reason")
        )
        storage.upsert_edge(
            _make_edge("A01", "B06", status=NodeStatus.failed, failed_reason="old edge")
        )

        async def fake_generate(prompt: str) -> str:
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                return json.dumps(
                    {"relation_type": "provide", "weight": 4, "explanation": "regen"},
                    ensure_ascii=False,
                )
            return "regenerated description"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result = await service.regenerate_failed(scope="all")

        # failed 节点 -> generated
        nodes_by_id = {n.id: n for n in result.nodes}
        assert nodes_by_id["B06"].status == NodeStatus.generated
        assert nodes_by_id["B06"].failed_reason is None
        # failed 边 -> generated
        assert result.edges[0].status == NodeStatus.generated
        assert result.edges[0].failed_reason is None
        # 已 generated 的节点没被重跑(可能因为它不在 failed 列表)
        # (检查 LLM 调用数:重跑 1 节点 + 1 边 = 2 次,而不是 3 次)
        # 注意:实际可能因为新生成边也调 LLM 一次,具体数字看实现
        # 我们只验证 failed 那个被重跑了
        assert llm_client.generate.call_count >= 2

    @pytest.mark.asyncio
    async def test_regenerate_failed_nodes_only(self, service, llm_client, storage):
        """regenerate_failed(scope='nodes'):只重跑节点,不动边."""

        # 预填:1 failed node,1 generated node(B06),1 failed edge(合法 endpoints)
        storage.upsert_node(
            _make_node("A01", status=NodeStatus.failed, failed_reason="node fail")
        )
        storage.upsert_node(_make_node("B06", status=NodeStatus.generated))
        storage.upsert_edge(
            _make_edge("A01", "B06", status=NodeStatus.failed, failed_reason="edge fail")
        )

        async def fake_generate(prompt: str) -> str:
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                return json.dumps(
                    {"relation_type": "provide", "weight": 3, "explanation": "x"},
                    ensure_ascii=False,
                )
            return "regen"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result = await service.regenerate_failed(scope="nodes")

        # 节点重跑成功
        node = next(n for n in result.nodes if n.id == "A01")
        assert node.status == NodeStatus.generated
        # 边没动,仍 failed
        edge = next(e for e in result.edges if e.source == "A01")
        assert edge.status == NodeStatus.failed
        assert edge.failed_reason == "edge fail"


# ============================================================
# Step 6: 防御性测试 — 节点 code 不在白名单 / 边端点不存在
# ============================================================


class TestValidation:
    @pytest.mark.asyncio
    async def test_generate_node_rejects_non_whitelist_code(self, service):
        """节点 code 不在 GB/T 4754 白名单 -> 拒收(抛 ValueError)."""
        with pytest.raises(ValueError) as exc_info:
            await service._generate_node("XX99")
        assert "GB/T 4754" in str(exc_info.value) or "whitelist" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_generate_edge_rejects_non_whitelist_source(self, service):
        """边 source 不在白名单 -> 拒收."""
        with pytest.raises(ValueError):
            await service._generate_edge("XX99", "C17")

    @pytest.mark.asyncio
    async def test_generate_edge_rejects_non_whitelist_target(self, service):
        """边 target 不在白名单 -> 拒收."""
        with pytest.raises(ValueError):
            await service._generate_edge("C17", "XX99")

    def test_knowledge_graph_rejects_edge_with_missing_node(self):
        """KnowledgeGraph 校验:边引用不存在的节点 -> 拒收."""
        nodes = [_make_node("A01")]
        edges = [
            GraphEdge(
                source="A01",
                target="B06",  # 合法 GB/T 但不在 nodes
                relation_type=RelationType.provide,
                weight=3,
                explanation="x",
            )
        ]
        with pytest.raises(ValidationError):
            KnowledgeGraph(
                nodes=nodes,
                edges=edges,
                generated_at=datetime.now(timezone.utc),
                llm_config_hash="abc",
            )

    def test_knowledge_graph_rejects_self_loop(self):
        """KnowledgeGraph 校验:自环边 -> 拒收."""
        nodes = [_make_node("A01")]
        edges = [
            GraphEdge(
                source="A01",
                target="A01",
                relation_type=RelationType.provide,
                weight=3,
                explanation="x",
            )
        ]
        with pytest.raises(ValidationError):
            KnowledgeGraph(
                nodes=nodes,
                edges=edges,
                generated_at=datetime.now(timezone.utc),
                llm_config_hash="abc",
            )


# ============================================================
# Step 8: llm_config_hash 变化 -> 缓存失效
# ============================================================


class TestConfigHashInvalidation:
    def test_config_hash_changes_with_api_key(self, storage, cache):
        """api_key 变化 -> config hash 变化."""
        c1 = MagicMock()
        c1.name = "claude"
        c1.default_model = "claude-test-1"
        c1.api_key = "sk-ant-AAAAAAA1"

        c2 = MagicMock()
        c2.name = "claude"
        c2.default_model = "claude-test-1"
        c2.api_key = "sk-ant-BBBBBBB2"  # 不同 key

        s1 = GraphService(llm_client=c1, storage=storage, cache=cache)
        s2 = GraphService(llm_client=c2, storage=storage, cache=cache)

        assert s1._compute_config_hash() != s2._compute_config_hash()

    def test_config_hash_changes_with_model(self, storage, cache):
        """model 变化 -> config hash 变化."""
        c1 = MagicMock()
        c1.name = "claude"
        c1.default_model = "claude-sonnet-1"
        c1.api_key = "sk-ant-same12"

        c2 = MagicMock()
        c2.name = "claude"
        c2.default_model = "claude-opus-2"
        c2.api_key = "sk-ant-same12"

        s1 = GraphService(llm_client=c1, storage=storage, cache=cache)
        s2 = GraphService(llm_client=c2, storage=storage, cache=cache)

        assert s1._compute_config_hash() != s2._compute_config_hash()

    def test_config_hash_changes_with_provider(self, storage, cache):
        """provider 变化 -> config hash 变化."""
        c1 = MagicMock()
        c1.name = "claude"
        c1.default_model = "x"
        c1.api_key = "k12345678"

        c2 = MagicMock()
        c2.name = "openai"
        c2.default_model = "x"
        c2.api_key = "k12345678"

        s1 = GraphService(llm_client=c1, storage=storage, cache=cache)
        s2 = GraphService(llm_client=c2, storage=storage, cache=cache)

        assert s1._compute_config_hash() != s2._compute_config_hash()

    def test_config_hash_stable_for_same_config(self, storage, cache):
        """相同配置 -> 相同 hash."""
        c1 = MagicMock()
        c1.name = "claude"
        c1.default_model = "claude-test-1"
        c1.api_key = "sk-ant-stable1"

        s1 = GraphService(llm_client=c1, storage=storage, cache=cache)
        s2 = GraphService(llm_client=c1, storage=storage, cache=cache)

        assert s1._compute_config_hash() == s2._compute_config_hash()


# ============================================================
# Step 10: 重复调 init_or_load_graph 不会重复生成(cache 命中)
# ============================================================


class TestInitIdempotent:
    @pytest.mark.asyncio
    async def test_repeated_init_does_not_regenerate(
        self, service, llm_client
    ):
        """重复调 init_or_load_graph:第二次应走 cache,不调 LLM."""

        async def fake_generate(prompt: str) -> str:
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                return json.dumps(
                    {"relation_type": "provide", "weight": 3, "explanation": "x"},
                    ensure_ascii=False,
                )
            return "desc"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result1 = await service.init_or_load_graph()
        calls_after_first = llm_client.generate.call_count
        assert calls_after_first > 0  # 第一次确实调了

        result2 = await service.init_or_load_graph()
        # 第二次 LLM 没被再调
        assert llm_client.generate.call_count == calls_after_first

        # 两次结果一致
        assert result1.llm_config_hash == result2.llm_config_hash
        assert len(result1.nodes) == len(result2.nodes)


# ============================================================
# Step 11: compute_stats
# ============================================================


class TestComputeStats:
    def test_compute_stats_counts_status(self, service):
        graph = KnowledgeGraph(
            nodes=[
                _make_node("A01", status=NodeStatus.generated),
                _make_node("B06", status=NodeStatus.generated),
                _make_node("C17", status=NodeStatus.failed),
            ],
            edges=[
                _make_edge("A01", "B06", status=NodeStatus.generated),
                _make_edge("B06", "C17", status=NodeStatus.failed),
            ],
            generated_at=datetime.now(timezone.utc),
            llm_config_hash="abc",
        )
        stats = service.compute_stats(graph)
        assert stats.generated == 3  # 2 nodes + 1 edge
        assert stats.failed == 2  # 1 node + 1 edge
        assert stats.total == 5

    def test_compute_stats_empty_graph(self, service):
        graph = KnowledgeGraph(
            nodes=[],
            edges=[],
            generated_at=datetime.now(timezone.utc),
            llm_config_hash="abc",
        )
        stats = service.compute_stats(graph)
        assert stats.generated == 0
        assert stats.failed == 0
        assert stats.total == 0


# ============================================================
# Step 12: 边缘情况 — corrupted cache / JSON 解析 / 重跑再失败
# ============================================================


class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_corrupted_cache_falls_through_to_regenerate(
        self, service, llm_client, cache
    ):
        """缓存内容损坏(不是合法 KnowledgeGraph) -> 重新生成,不抛异常."""

        cache_key = f"graph:v1:{service._compute_config_hash()}"
        cache.set(cache_key, {"garbage": "data"}, ttl_seconds=7 * 24 * 3600)

        async def fake_generate(prompt: str) -> str:
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                return json.dumps(
                    {"relation_type": "provide", "weight": 3, "explanation": "x"},
                    ensure_ascii=False,
                )
            return "ok"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        # 不应抛异常,应降级到调 LLM 重新生成
        result = await service.init_or_load_graph()
        assert len(result.nodes) > 0
        assert llm_client.generate.call_count > 0

    @pytest.mark.asyncio
    async def test_json_parse_retry_then_fail(
        self, service, llm_client
    ):
        """LLM 边 JSON 2 次都返回垃圾 -> 边标 failed,继续生成下一个."""

        service.node_codes = ["A01", "B06", "C17"]  # 3 节点

        # 节点:返回 OK
        # 边:所有 3 对都返回非 JSON
        async def fake_generate(prompt: str) -> str:
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                return "not valid json {{"
            return "node desc"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result = await service.init_or_load_graph()

        # 节点都生成了
        assert all(n.status == NodeStatus.generated for n in result.nodes)
        # 边都 failed(因为 JSON 重试 2 次仍失败)
        assert all(e.status == NodeStatus.failed for e in result.edges)
        assert all(e.failed_reason is not None for e in result.edges)

    @pytest.mark.asyncio
    async def test_json_parse_retry_succeeds_on_second_attempt(
        self, service, llm_client
    ):
        """第一次 JSON 错,第二次返回合法 JSON -> 边标 generated."""

        # 限制到 2 节点(只有 1 对边)
        service.node_codes = ["A01", "B06"]

        call_count = {"n": 0}

        async def fake_generate(prompt: str) -> str:
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                call_count["n"] += 1
                if call_count["n"] == 1:
                    return "not json"
                return json.dumps(
                    {"relation_type": "provide", "weight": 3, "explanation": "ok"},
                    ensure_ascii=False,
                )
            return "node desc"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result = await service.init_or_load_graph()

        # 边生成成功
        assert all(e.status == NodeStatus.generated for e in result.edges)
        # JSON 调用了 2 次(1 失败 + 1 成功)
        assert call_count["n"] == 2

    @pytest.mark.asyncio
    async def test_regenerate_failed_node_still_fails(
        self, service, llm_client, storage
    ):
        """regenerate_failed:LLM 仍失败 -> 节点保持 failed + 更新 failed_reason."""

        storage.upsert_node(
            _make_node("A01", status=NodeStatus.failed, failed_reason="old")
        )
        storage.upsert_node(_make_node("B06", status=NodeStatus.generated))

        # LLM 仍抛错
        async def fake_generate(prompt: str) -> str:
            raise RuntimeError("still down")

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result = await service.regenerate_failed(scope="nodes")

        # A01 仍 failed,但 failed_reason 已更新
        a01 = next(n for n in result.nodes if n.id == "A01")
        assert a01.status == NodeStatus.failed
        assert a01.failed_reason != "old"
        assert "still down" in a01.failed_reason

    @pytest.mark.asyncio
    async def test_regenerate_failed_with_empty_storage(
        self, service, llm_client
    ):
        """regenerate_failed 在 storage 空时(异常情况)抛 LLMUnavailableError."""

        # storage 没有任何节点 — 这种状态不应该出现,但代码要处理
        with pytest.raises(LLMUnavailableError):
            await service.regenerate_failed(scope="all")

    @pytest.mark.asyncio
    async def test_llm_unavailable_breaks_full_generation(
        self, service, llm_client
    ):
        """LLM 第一次调用就挂 -> 整体不可用,抛 LLMUnavailableError,不写 cache."""
        llm_client.generate = AsyncMock(
            side_effect=RuntimeError("auth failed")
        )

        with pytest.raises(LLMUnavailableError):
            await service.init_or_load_graph()

        # cache 没写
        cache_key = f"graph:v1:{service._compute_config_hash()}"
        assert service.cache.get(cache_key) is None

    def test_parse_json_strip_markdown_fence(self):
        """辅助函数:_parse_json_strict 能剥 markdown 围栏."""
        from domain.graph.graph_service import _parse_json_strict

        wrapped = "```json\n{\"a\": 1}\n```"
        result = _parse_json_strict(wrapped)
        assert result == {"a": 1}

        plain = '{"b": 2}'
        result = _parse_json_strict(plain)
        assert result == {"b": 2}

    def test_parse_json_rejects_garbage(self):
        """_parse_json_strict 对垃圾输入抛 JSONDecodeError."""
        from domain.graph.graph_service import _parse_json_strict

        with pytest.raises(json.JSONDecodeError):
            _parse_json_strict("not json at all")

    def test_build_default_edge_pairs_no_self_loops(self):
        """_build_default_edge_pairs 不产生自环."""
        from domain.graph.graph_service import _build_default_edge_pairs

        pairs = _build_default_edge_pairs(["A01", "B06", "C17", "D44"])
        for src, tgt in pairs:
            assert src != tgt

    def test_make_failed_node(self):
        """_make_failed_node 创建 NodeStatus=failed 的节点."""
        from domain.graph.graph_service import _make_failed_node

        node = _make_failed_node("A01", "boom")
        assert node.id == "A01"
        assert node.status == NodeStatus.failed
        assert node.failed_reason == "boom"
        assert node.last_attempt_at is not None

    def test_make_failed_edge(self):
        """_make_failed_edge 创建 NodeStatus=failed 的边."""
        from domain.graph.graph_service import _make_failed_edge

        edge = _make_failed_edge("A01", "B06", "boom")
        assert edge.source == "A01"
        assert edge.target == "B06"
        assert edge.status == NodeStatus.failed
        assert edge.failed_reason == "boom"

    @pytest.mark.asyncio
    async def test_cache_write_failure_does_not_break(
        self, service, llm_client, cache, monkeypatch
    ):
        """cache.set 抛异常 -> service 不抛,继续返回 graph."""

        # 让 cache.set 抛错
        def broken_set(*args, **kwargs):
            raise RuntimeError("disk full")

        monkeypatch.setattr(cache, "set", broken_set)

        async def fake_generate(prompt: str) -> str:
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                return json.dumps(
                    {"relation_type": "provide", "weight": 3, "explanation": "x"},
                    ensure_ascii=False,
                )
            return "ok"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        # 不应抛
        result = await service.init_or_load_graph()
        assert len(result.nodes) > 0

    @pytest.mark.asyncio
    async def test_init_reuses_storage_when_present(
        self, service, llm_client, storage
    ):
        """init_or_load_graph:cache miss 但 storage 有数据 -> 不调 LLM,直接返回."""
        # 预填 storage
        storage.upsert_node(_make_node("A01"))
        storage.upsert_node(_make_node("B06"))
        storage.upsert_edge(_make_edge("A01", "B06"))

        llm_client.generate = AsyncMock(
            side_effect=AssertionError("LLM should not be called")
        )

        result = await service.init_or_load_graph()
        assert len(result.nodes) == 2
        assert len(result.edges) == 1
        llm_client.generate.assert_not_called()

    @pytest.mark.asyncio
    async def test_regenerate_failed_edge_still_fails(
        self, service, llm_client, storage
    ):
        """regenerate_failed:边重跑仍失败 -> 边保持 failed + 更新 failed_reason."""
        storage.upsert_node(_make_node("A01", status=NodeStatus.generated))
        storage.upsert_node(_make_node("B06", status=NodeStatus.generated))
        storage.upsert_edge(
            _make_edge("A01", "B06", status=NodeStatus.failed, failed_reason="old")
        )

        async def fake_generate(prompt: str) -> str:
            if "严格 JSON" in prompt or '"relation_type"' in prompt:
                return "not json"
            return "node desc"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result = await service.regenerate_failed(scope="edges")

        edge = result.edges[0]
        assert edge.status == NodeStatus.failed
        assert edge.failed_reason != "old"
        assert "JSON" in edge.failed_reason or "json" in edge.failed_reason

    @pytest.mark.asyncio
    async def test_node_generation_validation_error_caught(
        self, service, llm_client
    ):
        """节点生成中 Pydantic ValidationError -> 标 failed,继续."""
        # 让节点描述里含非法字符(没影响;Pydantic 不严格)
        # 我们用 mock 让 _generate_node 自己抛 ValidationError
        from pydantic import ValidationError

        original = service._generate_node
        call_count = {"n": 0}

        async def fake_gen_node(code: str):
            call_count["n"] += 1
            if call_count["n"] == 2:
                raise ValidationError.from_exception_data(
                    "GraphNode",
                    [
                        {
                            "type": "value_error",
                            "loc": ("id",),
                            "input": code,
                            "ctx": {"error": "mock"},
                        }
                    ],
                )
            return await original(code)

        service._generate_node = fake_gen_node
        service.node_codes = ["A01", "B06", "C17"]

        async def fake_generate(prompt: str) -> str:
            return "ok"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result = await service.init_or_load_graph()
        # 第 2 个节点 failed
        nodes_by_id = {n.id: n for n in result.nodes}
        assert nodes_by_id["B06"].status == NodeStatus.failed
        # 其他节点 generated
        assert nodes_by_id["A01"].status == NodeStatus.generated
        assert nodes_by_id["C17"].status == NodeStatus.generated

    @pytest.mark.asyncio
    async def test_edge_generation_transient_failure(
        self, service, llm_client
    ):
        """边生成中 transient failure -> 边标 failed,继续."""
        # 强制 _generate_edge 抛 TransientLLMError
        from domain.graph.graph_service import TransientLLMError

        original = service._generate_edge
        call_count = {"n": 0}

        async def fake_gen_edge(src, tgt):
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise TransientLLMError("simulated transient")
            return await original(src, tgt)

        service._generate_edge = fake_gen_edge
        service.node_codes = ["A01", "B06", "C17"]

        # 节点生成 OK
        async def fake_generate(prompt: str) -> str:
            return "ok"

        llm_client.generate = AsyncMock(side_effect=fake_generate)

        result = await service.init_or_load_graph()
        # 第一条边 failed
        failed_edges = [e for e in result.edges if e.status == NodeStatus.failed]
        assert len(failed_edges) >= 1
        # 节点全 generated
        assert all(n.status == NodeStatus.generated for n in result.nodes)

    @pytest.mark.asyncio
    async def test_full_generation_raises_llm_unavailable_from_edge(
        self, service, llm_client
    ):
        """全图生成中边生成抛 LLMUnavailableError -> 整体抛 LLMUnavailableError.

        触发 _generate_full_graph 内的 'except LLMUnavailableError: raise'.
        """
        # 让 LLM 在第二次调用时(边)抛非 LLMUnavailableError
        # 但 _llm_ever_succeeded 仍是 False(因为 _generate_node 在前也会调 LLM)
        # 调整思路:用 mock 让 _generate_node 不调 LLM(直接 return),
        # 然后让 _generate_edge 调 LLM,且那次调用是首次 -> 抛 LLMUnavailableError

        async def fake_generate_node(code: str):
            # 不调 LLM,直接返回
            from schema.gbt4754 import get_category_for_code, get_label_for_code
            from schema.graph import Category, GraphNode, NodeStatus
            return GraphNode(
                id=code,
                label=get_label_for_code(code) or code,
                category=Category(get_category_for_code(code) or "A"),
                description="x",
                status=NodeStatus.generated,
                last_attempt_at=datetime.now(timezone.utc),
            )

        async def fake_generate_edge(src, tgt):
            # 首次调 LLM 失败 -> LLMUnavailableError
            raise LLMUnavailableError("auth fail")

        service._generate_node = fake_generate_node
        service._generate_edge = fake_generate_edge
        service.node_codes = ["A01", "B06"]

        with pytest.raises(LLMUnavailableError):
            await service.init_or_load_graph()


# ---------- T4 新增: reexplain_edge ----------


@pytest.mark.asyncio
async def test_reexplain_edge_success(service, storage, llm_client):
    """T4: reexplain_edge 正常返回 {edge_id, explanation, generated_at},
    并把新 explanation 写回 storage.upsert_edge。"""
    # seed 一条边
    edge = GraphEdge(
        source="B06",
        target="C17",
        relation_type=RelationType.provide,
        weight=3,
        explanation="OLD explanation",
        status=NodeStatus.generated,
        last_attempt_at=datetime.now(timezone.utc),
    )
    storage.upsert_edge(edge)

    # mock LLM 返回新 explanation
    llm_client.generate = AsyncMock(
        return_value='{"relation_type": "provide", "weight": 3, '
        '"explanation": "矿业为制造业提供原材料"}'
    )

    result = await service.reexplain_edge("B06-C17")
    assert result["edge_id"] == "B06-C17"
    assert result["explanation"] == "矿业为制造业提供原材料"
    assert "generated_at" in result
    llm_client.generate.assert_awaited_once()

    # 持久化的边被更新(新 explanation + relation_type/weight 不变)
    updated = storage.get_edge("B06", "C17")
    assert updated is not None
    assert updated.explanation == "矿业为制造业提供原材料"
    assert updated.relation_type == RelationType.provide
    assert updated.weight == 3


@pytest.mark.asyncio
async def test_reexplain_edge_not_found(service, storage):
    """T4: 边不存在 -> KeyError。"""
    # storage 空
    with pytest.raises(KeyError):
        await service.reexplain_edge("B06-MISS")


@pytest.mark.asyncio
async def test_reexplain_edge_invalid_id(service, storage):
    """T4: edge_id 格式错(没有 -) -> KeyError。"""
    with pytest.raises(KeyError):
        await service.reexplain_edge("invalid")


@pytest.mark.asyncio
async def test_reexplain_edge_llm_unavailable(service, storage, llm_client):
    """T4: LLM 不可用 -> LLMUnavailableError(首次失败,标记整体挂)。"""
    edge = GraphEdge(
        source="B06",
        target="C17",
        relation_type=RelationType.provide,
        weight=3,
        explanation="OLD",
        status=NodeStatus.generated,
        last_attempt_at=datetime.now(timezone.utc),
    )
    storage.upsert_edge(edge)
    llm_client.generate = AsyncMock(
        side_effect=RuntimeError("network down")
    )

    with pytest.raises(LLMUnavailableError):
        await service.reexplain_edge("B06-C17")


# ---------- T4 新增: GraphRepo.get_edge ----------


def test_graph_repo_get_edge_returns_row(tmp_path):
    """T4: GraphRepo.get_edge 返回已存的边。"""
    repo = GraphRepo(str(tmp_path / "graph.db"))
    edge = GraphEdge(
        source="B06",
        target="C17",
        relation_type=RelationType.provide,
        weight=4,
        explanation="x",
        status=NodeStatus.generated,
        last_attempt_at=datetime.now(timezone.utc),
    )
    repo.upsert_edge(edge)
    got = repo.get_edge("B06", "C17")
    assert got is not None
    assert got.source == "B06"
    assert got.target == "C17"
    assert got.weight == 4


def test_graph_repo_get_edge_missing(tmp_path):
    """T4: GraphRepo.get_edge 不存在 -> None."""
    repo = GraphRepo(str(tmp_path / "graph.db"))
    assert repo.get_edge("NOPE", "NOPE2") is None
