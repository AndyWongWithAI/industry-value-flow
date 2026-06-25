"""Tests for KnowledgeGraph Pydantic v2 data models."""
import pytest
from datetime import datetime
from pydantic import ValidationError

from backend.schema.graph import (
    Category,
    GraphEdge,
    GraphNode,
    GraphStats,
    KnowledgeGraph,
    NodeStatus,
    RelationType,
)


class TestCategoryEnum:
    def test_20_个大类(self):
        # A-T (共 20 大类)
        assert len(list(Category)) == 20

    def test_包含所有GBT4754大类(self):
        expected = set("ABCDEFGHIJKLMNOPQRST")
        actual = {c.value for c in Category}
        assert actual == expected


class TestRelationTypeEnum:
    def test_4_种关系(self):
        assert len(list(RelationType)) == 4

    def test_枚举值(self):
        values = {r.value for r in RelationType}
        assert values == {"provide", "rely_on", "service", "consume"}


class TestNodeStatusEnum:
    def test_3_种状态(self):
        assert len(list(NodeStatus)) == 3

    def test_枚举值(self):
        values = {s.value for s in NodeStatus}
        assert values == {"pending", "generated", "failed"}


class TestGraphNode:
    def test_合法节点_C17_纺织业_创建成功(self):
        node = GraphNode(
            id="C17",
            label="纺织业",
            category=Category.C,
            description="将纺织纤维加工成纱、线、织物的行业",
        )
        assert node.id == "C17"
        assert node.label == "纺织业"
        assert node.category == Category.C
        assert node.status == NodeStatus.pending  # 默认值
        assert node.failed_reason is None  # 默认值
        assert node.last_attempt_at is None  # 默认值

    def test_非法_id_XX99_抛_ValidationError(self):
        with pytest.raises(ValidationError) as exc_info:
            GraphNode(
                id="XX99",
                label="x",
                category=Category.C,
                description="y",
            )
        assert "GB/T 4754" in str(exc_info.value) or "middle category" in str(exc_info.value)

    def test_id_小写_抛_ValidationError(self):
        with pytest.raises(ValidationError):
            GraphNode(
                id="c17",
                label="x",
                category=Category.C,
                description="y",
            )

    def test_category_非法_Z_抛_ValidationError(self):
        with pytest.raises(ValidationError):
            GraphNode(
                id="C17",
                label="x",
                category="Z",  # type: ignore[arg-type]
                description="y",
            )

    def test_status_可显式设置为_generated(self):
        node = GraphNode(
            id="C17",
            label="纺织业",
            category=Category.C,
            description="x",
            status=NodeStatus.generated,
        )
        assert node.status == NodeStatus.generated

    def test_failed_reason_和_last_attempt_at_可设置(self):
        node = GraphNode(
            id="C17",
            label="纺织业",
            category=Category.C,
            description="x",
            status=NodeStatus.failed,
            failed_reason="LLM timeout",
            last_attempt_at=datetime(2026, 6, 25, 12, 0, 0),
        )
        assert node.failed_reason == "LLM timeout"
        assert node.last_attempt_at == datetime(2026, 6, 25, 12, 0, 0)


class TestGraphEdge:
    def test_合法边_创建成功(self):
        edge = GraphEdge(
            source="B06",
            target="C17",
            relation_type=RelationType.provide,
            weight=4,
            explanation="煤炭为纺织印染提供热能与动力",
        )
        assert edge.source == "B06"
        assert edge.target == "C17"
        assert edge.relation_type == RelationType.provide
        assert edge.weight == 4
        assert edge.status == NodeStatus.pending

    def test_非法_source_抛_ValidationError(self):
        with pytest.raises(ValidationError):
            GraphEdge(
                source="XX99",
                target="C17",
                relation_type=RelationType.provide,
                weight=3,
                explanation="x",
            )

    def test_非法_target_抛_ValidationError(self):
        with pytest.raises(ValidationError):
            GraphEdge(
                source="B06",
                target="XX99",
                relation_type=RelationType.provide,
                weight=3,
                explanation="x",
            )

    def test_weight_0_抛_ValidationError(self):
        with pytest.raises(ValidationError):
            GraphEdge(
                source="B06",
                target="C17",
                relation_type=RelationType.provide,
                weight=0,
                explanation="x",
            )

    def test_weight_6_抛_ValidationError(self):
        with pytest.raises(ValidationError):
            GraphEdge(
                source="B06",
                target="C17",
                relation_type=RelationType.provide,
                weight=6,
                explanation="x",
            )

    def test_weight_1_合法(self):
        edge = GraphEdge(
            source="B06",
            target="C17",
            relation_type=RelationType.provide,
            weight=1,
            explanation="x",
        )
        assert edge.weight == 1

    def test_weight_5_合法(self):
        edge = GraphEdge(
            source="B06",
            target="C17",
            relation_type=RelationType.provide,
            weight=5,
            explanation="x",
        )
        assert edge.weight == 5

    def test_relation_type_非法_抛_ValidationError(self):
        with pytest.raises(ValidationError):
            GraphEdge(
                source="B06",
                target="C17",
                relation_type="unknown",  # type: ignore[arg-type]
                weight=3,
                explanation="x",
            )


class TestGraphStats:
    def test_默认全_0(self):
        stats = GraphStats()
        assert stats.generated == 0
        assert stats.failed == 0
        assert stats.total == 0
        assert stats.pending == 0

    def test_可显式设置(self):
        stats = GraphStats(generated=87, failed=13, total=100, pending=0)
        assert stats.generated == 87
        assert stats.failed == 13
        assert stats.total == 100
        assert stats.pending == 0


class TestKnowledgeGraph:
    def _make_node(self, code: str) -> GraphNode:
        return GraphNode(
            id=code,
            label=f"label_{code}",
            category=Category.C,
            description="desc",
        )

    def test_空图_合法(self):
        graph = KnowledgeGraph(
            nodes=[],
            edges=[],
            generated_at=datetime(2026, 6, 25),
            llm_config_hash="abc123",
        )
        assert graph.nodes == []
        assert graph.edges == []

    def test_正常图_合法(self):
        nodes = [self._make_node("C17"), self._make_node("C18")]
        edges = [
            GraphEdge(
                source="C17",
                target="C18",
                relation_type=RelationType.provide,
                weight=4,
                explanation="x",
            )
        ]
        graph = KnowledgeGraph(
            nodes=nodes,
            edges=edges,
            generated_at=datetime(2026, 6, 25),
            llm_config_hash="abc123",
        )
        assert len(graph.nodes) == 2
        assert len(graph.edges) == 1

    def test_边引用不存在的source_抛_ValidationError(self):
        # source 是合法 GB/T 代码(否则 GraphEdge 自己就报错了),但不在 nodes 列表
        nodes = [self._make_node("C17")]
        edges = [
            GraphEdge(
                source="B06",  # 合法 GB/T 代码,但不在 nodes 列表
                target="C17",
                relation_type=RelationType.provide,
                weight=3,
                explanation="x",
            )
        ]
        with pytest.raises(ValidationError) as exc_info:
            KnowledgeGraph(
                nodes=nodes,
                edges=edges,
                generated_at=datetime(2026, 6, 25),
                llm_config_hash="abc",
            )
        assert "source" in str(exc_info.value) or "B06" in str(exc_info.value)

    def test_边引用不存在的target_抛_ValidationError(self):
        nodes = [self._make_node("C17")]
        edges = [
            GraphEdge(
                source="C17",
                target="C18",  # 合法 GB/T 代码,但不在 nodes 列表
                relation_type=RelationType.provide,
                weight=3,
                explanation="x",
            )
        ]
        with pytest.raises(ValidationError) as exc_info:
            KnowledgeGraph(
                nodes=nodes,
                edges=edges,
                generated_at=datetime(2026, 6, 25),
                llm_config_hash="abc",
            )
        assert "target" in str(exc_info.value) or "C18" in str(exc_info.value)

    def test_自环边_抛_ValidationError(self):
        nodes = [self._make_node("C17")]
        edges = [
            GraphEdge(
                source="C17",
                target="C17",  # self-loop
                relation_type=RelationType.provide,
                weight=3,
                explanation="x",
            )
        ]
        with pytest.raises(ValidationError) as exc_info:
            KnowledgeGraph(
                nodes=nodes,
                edges=edges,
                generated_at=datetime(2026, 6, 25),
                llm_config_hash="abc",
            )
        assert "self-loop" in str(exc_info.value) or "C17" in str(exc_info.value)


class TestSerialization:
    def test_GraphNode_序列化为_JSON(self):
        node = GraphNode(
            id="C17",
            label="纺织业",
            category=Category.C,
            description="将纺织纤维加工成纱、线、织物的行业",
        )
        json_str = node.model_dump_json()
        assert "C17" in json_str
        assert "纺织业" in json_str

    def test_KnowledgeGraph_序列化为_dict(self):
        node1 = GraphNode(
            id="C17",
            label="纺织业",
            category=Category.C,
            description="x",
        )
        node2 = GraphNode(
            id="B06",
            label="煤炭",
            category=Category.B,
            description="y",
        )
        edge = GraphEdge(
            source="B06",
            target="C17",
            relation_type=RelationType.provide,
            weight=4,
            explanation="x",
        )
        graph = KnowledgeGraph(
            nodes=[node1, node2],
            edges=[edge],
            generated_at=datetime(2026, 6, 25),
            llm_config_hash="abc",
        )
        d = graph.model_dump()
        assert d["nodes"][0]["id"] == "C17"
        assert d["edges"][0]["weight"] == 4
        assert d["llm_config_hash"] == "abc"
