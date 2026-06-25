"""GraphService — 知识图谱核心服务.

T3 spec (3.1):
- init_or_load_graph(): cache 命中返回,未命中调 LLM 生成(partial allowed),写缓存
- regenerate_failed(): 重跑 failed 节点/边
- _generate_node(): LLM 生成单个节点
- _generate_edge(): LLM 生成单条边
- compute_stats(): 返回 generated/failed/total

设计决策:
- 持久化:每生成一个 node/edge 立即写 GraphRepo(SQLite,同步)
- 缓存:Cache (SQLite) 7 天 TTL,key = graph:v1:{llm_config_hash}
- 错误:LLM 整体不可用 -> LLMUnavailableError(不缓存)
       LLM 单项失败 -> NodeStatus.failed + failed_reason,继续下一个
       LLM JSON 错 -> 1 次重试
- 防御:节点 code 不在 GB/T 4754 白名单 -> ValidationError 由 Pydantic 拒收
       边 source/target 不存在 -> KnowledgeGraph 校验器拒收
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import ValidationError

from domain.llm.base import LLMProviderProtocol
from domain.storage.cache import Cache
from domain.storage.graph_repo import GraphRepo
from schema.gbt4754 import (
    GBT4754_MIDDLE_CATEGORIES,
    get_category_for_code,
    get_label_for_code,
    is_valid_middle_category_code,
)
from schema.graph import (
    Category,
    GraphEdge,
    GraphNode,
    GraphStats,
    KnowledgeGraph,
    NodeStatus,
    RelationType,
)


logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "graph:v2:"
CACHE_TTL_SECONDS = 7 * 24 * 3600

# 启动时生成节点的范围 — T3 MVP 选一个有代表性的子集(10 个左右)
# 全部 96 个太慢;留 T4 让用户选择子集。
# 选 8 个跨类核心:农业(投入)、制造业、采矿业(投入)、电力(投入)、
# 批发零售、运输、金融、商务服务
DEFAULT_NODE_CODES: list[str] = [
    "A01",  # 农业
    "B06",  # 煤炭开采
    "B07",  # 石油天然气
    "C17",  # 纺织业
    "C26",  # 化学原料
    "D44",  # 电力热力
    "F51",  # 批发业
    "G54",  # 道路运输
    "I65",  # 软件信息技术
    "J66",  # 货币金融
    "L72",  # 商务服务业
]


class LLMUnavailableError(Exception):
    """LLM 完全不可用(无 key / 网络挂) — 启动报错,前端白屏 + '请配置 LLM'"""


class TransientLLMError(Exception):
    """LLM 单次调用失败(LLM 整体可用,只是这次失败)。

    区分 LLMUnavailableError(整体挂)和 TransientLLMError(瞬断):
    - 整体挂 -> 启动失败,不写 cache
    - 瞬断 -> 把当前 node/edge 标 failed,继续下一个
    """


class GraphService:
    """知识图谱服务 — LLM 初始化 + partial state 持久化 + regenerate_failed."""

    def __init__(
        self,
        llm_client: LLMProviderProtocol,
        storage: GraphRepo,
        cache: Cache,
        node_codes: list[str] | None = None,
    ):
        self.llm = llm_client
        self.storage = storage
        self.cache = cache
        self.node_codes = node_codes or DEFAULT_NODE_CODES
        # 计算 LLM 配置 hash(provider + model + api_key 前 8 位)
        # 通过属性延迟计算(llm_client 可能没有暴露 api_key;我们用通用接口)
        self._llm_config_hash: str | None = None
        # Track whether LLM has produced at least one successful response.
        # 用来区分"整体挂"(从未成功) vs "瞬断"(曾经成功,这次失败)。
        self._llm_ever_succeeded: bool = False

    # ---------- public ----------

    async def init_or_load_graph(self) -> KnowledgeGraph:
        """启动时调用。
        1. 查 cache key = 'graph:v1:{llm_config_hash}',TTL 7 天
        2. 命中且未过期 -> 返回缓存的 KnowledgeGraph(包括 partial 状态)
        3. 未命中 -> 调 LLM 生成,持久化(partial allowed),写缓存
        4. LLM 完全不可用 -> 抛 LLMUnavailableError
        """
        config_hash = self._compute_config_hash()
        cache_key = f"{CACHE_KEY_PREFIX}{config_hash}"

        # 1) 试 cache
        cached = self.cache.get(cache_key)
        if cached is not None:
            logger.info("graph cache hit key=%s", cache_key)
            try:
                return KnowledgeGraph.model_validate(cached)
            except (ValidationError, ValueError) as e:
                logger.warning("cached graph invalid, regenerating: %s", e)
                # corrupted cache — fall through to regenerate

        # 2) 试 DB(让"已持久化的 partial state"也能被复用,
        #    不需要再调 LLM)
        existing = self.storage.load_graph(llm_config_hash=config_hash)
        if existing is not None:
            logger.info("graph loaded from storage nodes=%d edges=%d",
                        len(existing.nodes), len(existing.edges))
            self._write_cache(cache_key, existing)
            return existing

        # 3) 调 LLM 生成
        graph = await self._generate_full_graph(config_hash)
        self.storage.replace_full(graph)
        self._write_cache(cache_key, graph)
        return graph

    async def regenerate_failed(
        self, scope: Literal["nodes", "edges", "all"] = "all"
    ) -> KnowledgeGraph:
        """重跑 failed 节点/边,成功 -> status=generated,失败 -> 保持 failed + 更新 failed_reason
        返回最新 KnowledgeGraph
        """
        if scope in ("nodes", "all"):
            failed_nodes = self.storage.list_failed_nodes()
            for node in failed_nodes:
                try:
                    regenerated = await self._generate_node(node.id)
                except Exception as e:
                    # 重跑仍失败(LLMUnavailableError/TransientLLMError/JSON
                    # 错误等):更新 failed_reason,保持 failed
                    logger.warning("regenerate node %s failed: %s", node.id, e)
                    node.failed_reason = str(e)
                    node.last_attempt_at = datetime.now(timezone.utc)
                    self.storage.upsert_node(node)
                    continue
                self.storage.upsert_node(regenerated)

        if scope in ("edges", "all"):
            failed_edges = self.storage.list_failed_edges()
            for edge in failed_edges:
                try:
                    regenerated = await self._generate_edge(
                        edge.source, edge.target
                    )
                except Exception as e:
                    logger.warning(
                        "regenerate edge %s->%s failed: %s",
                        edge.source, edge.target, e,
                    )
                    edge.failed_reason = str(e)
                    edge.last_attempt_at = datetime.now(timezone.utc)
                    self.storage.upsert_edge(edge)
                    continue
                self.storage.upsert_edge(regenerated)

        # 重新加载图 + 失效缓存(让 partial state 被重新持久化)
        config_hash = self._compute_config_hash()
        graph = self.storage.load_graph(llm_config_hash=config_hash)
        if graph is None:
            # storage 是空的,这种情况不应该发生
            raise LLMUnavailableError("storage empty after regenerate_failed")
        cache_key = f"{CACHE_KEY_PREFIX}{config_hash}"
        self._write_cache(cache_key, graph)
        return graph

    def compute_stats(self, graph: KnowledgeGraph) -> GraphStats:
        """返回 {generated, failed, total, pending}."""
        node_stats = _status_counts(graph.nodes)
        edge_stats = _status_counts(graph.edges)
        # node + edge 合并
        generated = node_stats[NodeStatus.generated] + edge_stats[NodeStatus.generated]
        failed = node_stats[NodeStatus.failed] + edge_stats[NodeStatus.failed]
        pending = node_stats[NodeStatus.pending] + edge_stats[NodeStatus.pending]
        total = len(graph.nodes) + len(graph.edges)
        return GraphStats(
            generated=generated, failed=failed, total=total, pending=pending
        )

    # ---------- generation (private) ----------

    async def _generate_nodes_by_category(
        self, on_progress: Any | None = None
    ) -> list[GraphNode]:
        """按 GB/T 4754 20 大类并行调 LLM,每类一个 call.

        Returns:
            所有生成的节点(成功的 + 失败的)。
            每个成功的立即 upsert 到 storage(partial state 持久化)。

        Args:
            on_progress: 可选 callback(generated, failed, total),
                在每个 node 持久化后调用,用于前端 StatusBar 进度。
        """
        categories = _all_categories()  # [(cat, name), ...] x 20
        total = len(categories)
        progress_gen = 0
        progress_fail = 0
        # 并行调 20 次 LLM(每类一次)
        results = await asyncio.gather(
            *[self._llm_generate_category(cat, name) for cat, name in categories],
            return_exceptions=True,
        )
        all_nodes: list[GraphNode] = []
        for (cat, _name), res in zip(categories, results, strict=True):
            if isinstance(res, Exception):
                # 整个 category call 抛异常(LLM 瞬断等):该类所有节点都标 failed
                logger.warning("category %s batch failed: %s", cat, res)
                # 拿白名单里该类所有中类代码,标 failed
                for item in GBT4754_MIDDLE_CATEGORIES:
                    if item["category"] != cat:
                        continue
                    failed = _make_failed_node(
                        item["code"], f"category batch failed: {res!s}"
                    )
                    self.storage.upsert_node(failed)
                    all_nodes.append(failed)
                    progress_fail += 1
            else:
                # res 是 list[GraphNode],成功的 + 失败的混合
                for node in res:
                    self.storage.upsert_node(node)
                    all_nodes.append(node)
                    if node.status == NodeStatus.generated:
                        progress_gen += 1
                    else:
                        progress_fail += 1
            if on_progress is not None:
                try:
                    on_progress(progress_gen, progress_fail, total)
                except Exception as e:  # pragma: no cover
                    logger.warning("on_progress callback raised: %s", e)
        return all_nodes

    async def _llm_generate_category(
        self, cat: str, cat_name: str
    ) -> list[GraphNode]:
        """单次 LLM call:返回该大类下所有中类节点(成功的 generated,失败的 failed).

        Robust 策略:
        - JSON 解析错误:重试 1 次(让 LLM 看到同一个 prompt 重新生成)
        - 中类代码不在白名单:标 failed(不抛,让上层 partial state 持久化)
        - 2 次都失败:返空 list(上层 gather 会收到 Exception if 调用方 raise,这里不 raise)
        """
        prompt = _build_category_prompt(cat, cat_name)
        items: list[dict[str, Any]] = []
        last_exc: Exception | None = None
        for attempt in range(2):
            try:
                raw = await self._call_llm_with_retry(prompt)
                parsed = _parse_json_strict(raw)
                if not isinstance(parsed, list):
                    raise ValueError(
                        f"expected JSON array, got {type(parsed).__name__}"
                    )
                items = parsed
                break
            except (json.JSONDecodeError, ValueError) as e:
                last_exc = e
                logger.warning(
                    "category %s parse attempt %d failed: %s",
                    cat, attempt + 1, e,
                )
        if not items and last_exc is not None:
            # 2 次都失败:把白名单里该类所有中类都标 failed
            failed_nodes: list[GraphNode] = []
            for item in GBT4754_MIDDLE_CATEGORIES:
                if item["category"] != cat:
                    continue
                failed_nodes.append(
                    _make_failed_node(
                        item["code"], f"LLM JSON 解析失败 2 次: {last_exc!s}"
                    )
                )
            return failed_nodes
        # items 解析成功:转 GraphNode,白名单校验失败的标 failed
        result: list[GraphNode] = []
        seen_codes: set[str] = set()
        for it in items:
            try:
                code = str(it.get("code", ""))
                name = str(it.get("name", ""))
                desc = str(it.get("description", ""))
            except (AttributeError, TypeError) as e:
                logger.warning("category %s item shape error: %s", cat, e)
                continue
            if not code or not name:
                continue
            # 白名单校验
            if not is_valid_middle_category_code(code):
                # 把无效 code 也写一个 failed node(方便前端看到)
                # model_construct 绕开 Pydantic 校验(否则 id validator 直接抛)
                failed = GraphNode.model_construct(
                    id=code,
                    label=name or code,
                    category=Category(cat),
                    description="",
                    status=NodeStatus.failed,
                    failed_reason=f"code {code!r} not in GB/T 4754 whitelist",
                    last_attempt_at=datetime.now(timezone.utc),
                )
                result.append(failed)
                continue
            if code in seen_codes:
                # LLM 重复:标 failed
                failed = GraphNode.model_construct(
                    id=code,
                    label=name,
                    category=Category(cat),
                    description="",
                    status=NodeStatus.failed,
                    failed_reason=f"duplicate code {code!r} in LLM response",
                    last_attempt_at=datetime.now(timezone.utc),
                )
                result.append(failed)
                continue
            seen_codes.add(code)
            cat_for_code = get_category_for_code(code) or cat
            # 业务校验:LLM 给的 category 与 code 的真实 category 不一致 -> failed
            if cat_for_code != cat:
                failed = GraphNode(
                    id=code,
                    label=name,
                    category=Category(cat_for_code),
                    description="",
                    status=NodeStatus.failed,
                    failed_reason=(
                        f"category mismatch: code {code!r} belongs to {cat_for_code}, "
                        f"not {cat}"
                    ),
                    last_attempt_at=datetime.now(timezone.utc),
                )
                result.append(failed)
                continue
            result.append(
                GraphNode(
                    id=code,
                    label=name,
                    category=Category(cat_for_code),
                    description=desc,
                    status=NodeStatus.generated,
                    last_attempt_at=datetime.now(timezone.utc),
                )
            )
        # 兜底:LLM 没返任何 item 或全被白名单拒收 -> 标 failed
        if not result:
            for item in GBT4754_MIDDLE_CATEGORIES:
                if item["category"] != cat:
                    continue
                result.append(
                    _make_failed_node(
                        item["code"], "LLM 返回空 / 全部白名单拒收"
                    )
                )
        return result

    async def _generate_full_graph(self, config_hash: str) -> KnowledgeGraph:
        """全图生成:逐个 node,逐个 edge(可能边之间相互依赖),立即持久化."""
        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []

        # 1) 节点
        for code in self.node_codes:
            try:
                node = await self._generate_node(code)
            except LLMUnavailableError:
                # LLM 整体挂 -> 立刻抛,partial state 已持久化(直到失败的)
                raise
            except TransientLLMError as e:
                # 瞬断:标记 failed + 持久化,继续下一个
                logger.warning("node %s transient failure: %s", code, e)
                node = _make_failed_node(code, str(e))
            except Exception as e:
                # JSON 解析错误 / ValidationError 等也走这里
                logger.warning("node %s generation failed: %s", code, e)
                node = _make_failed_node(code, str(e))
            self.storage.upsert_node(node)
            nodes.append(node)

        # 2) 边:基于已生成(generated + failed 都算"已知")节点对
        # T3 MVP:成对生成(n*(n-1)/2 太慢;我们选相邻的"价值链"对)
        edge_pairs = _build_default_edge_pairs([n.id for n in nodes])
        for src, tgt in edge_pairs:
            try:
                edge = await self._generate_edge(src, tgt)
            except LLMUnavailableError:
                raise
            except TransientLLMError as e:
                logger.warning("edge %s->%s transient failure: %s", src, tgt, e)
                edge = _make_failed_edge(src, tgt, str(e))
            except Exception as e:
                logger.warning("edge %s->%s generation failed: %s", src, tgt, e)
                edge = _make_failed_edge(src, tgt, str(e))
            self.storage.upsert_edge(edge)
            edges.append(edge)

        return KnowledgeGraph(
            nodes=nodes,
            edges=edges,
            generated_at=datetime.now(timezone.utc),
            llm_config_hash=config_hash,
        )

    async def _generate_node(self, code: str) -> GraphNode:
        """LLM 生成单个节点(NodeStatus=generated / failed)."""
        if not is_valid_middle_category_code(code):
            raise ValueError(
                f"node code {code!r} not in GB/T 4754 whitelist"
            )
        label = get_label_for_code(code) or code
        category_str = get_category_for_code(code) or "A"
        prompt = (
            f"你是中国国民经济行业分类专家。请为以下行业生成一句话描述:\n"
            f"行业代码: {code}\n"
            f"行业名称: {label}\n"
            f"所属大类: {category_str}\n\n"
            f"要求:用中文,不超过 50 字,说明该行业的核心业务或产业链定位。\n"
            f"只返回描述文本,不要任何前缀/解释/JSON 包装。"
        )
        raw = await self._call_llm_with_retry(prompt)
        description = raw.strip()
        return GraphNode(
            id=code,
            label=label,
            category=Category(category_str),
            description=description,
            status=NodeStatus.generated,
            last_attempt_at=datetime.now(timezone.utc),
        )

    async def _generate_edge(self, source_id: str, target_id: str) -> GraphEdge:
        """LLM 生成单条边(weight + reason,relation_type 固定 supports).

        spec 3.4:JSON 格式错误重试 1 次,再失败 -> 抛异常让上层标 failed.

        v2 收敛(2026-06-25):relation_type 固定为 `supports`(A 支撑 B,单向)。
        LLM 只需判断 weight + 解释;不再让 LLM 在 4 种类型间选择。
        """
        if not is_valid_middle_category_code(source_id):
            raise ValueError(f"source {source_id!r} not in GB/T 4754 whitelist")
        if not is_valid_middle_category_code(target_id):
            raise ValueError(f"target {target_id!r} not in GB/T 4754 whitelist")
        s_label = get_label_for_code(source_id) or source_id
        t_label = get_label_for_code(target_id) or target_id
        # v2 收敛:关系类型固定为 supports,语义 A → B = A 支撑 B(单向)
        prompt = (
            f"分析行业 {source_id}({s_label}) 与行业 {target_id}({t_label}) 之间的产业关系。\n\n"
            f"方向语义:**{s_label} 是 {t_label} 的上游** —— {s_label} 支撑 {t_label} "
            f"(资源 / 服务 / 技术从 {s_label} 流向 {t_label})。\n\n"
            f"**禁止生成双向边**:即使 {s_label} 与 {t_label} 看似互依,本条边方向固定为 "
            f"{source_id} → {target_id};反向 {target_id} → {source_id} 由另一条独立边承载。\n\n"
            f"返回严格 JSON 格式(不要 markdown,不要解释):\n"
            f'{{"weight": <1-5 整数,关系强度>, '
            f'"explanation": "<一句话中文解释,不超过 40 字,说明 {s_label} 如何支撑 {t_label}>"}}\n\n'
            f"weight 5 = 强核心依赖,1 = 弱/偶发关联。"
        )
        # spec 3.4:JSON 错误重试 1 次
        last_exc: Exception | None = None
        for attempt in range(2):
            raw = await self._call_llm_with_retry(prompt)
            try:
                data = _parse_json_strict(raw)
                return GraphEdge(
                    source=source_id,
                    target=target_id,
                    relation_type=RelationType.supports,  # v2:固定 supports
                    weight=int(data["weight"]),
                    explanation=str(data["explanation"]),
                    status=NodeStatus.generated,
                    last_attempt_at=datetime.now(timezone.utc),
                )
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                last_exc = e
                logger.warning(
                    "edge %s->%s JSON parse attempt %d failed: %s",
                    source_id, target_id, attempt + 1, e,
                )
        # 2 次都失败
        assert last_exc is not None
        raise ValueError(
            f"LLM JSON 解析失败 2 次: {last_exc!s}"
        ) from last_exc

    async def reexplain_edge(self, edge_id: str) -> dict:
        """实时重新生成单条边的解释(EdgePanel "重新解释" 按钮).

        edge_id 格式: "{source}-{target}" (e.g. "B06-C17").

        Returns:
            {"edge_id": ..., "explanation": ..., "generated_at": ...}

        Raises:
            KeyError: 边不存在
            LLMUnavailableError: LLM 完全不可用
            ValueError: LLM 两次 JSON 解析都失败
        """
        if "-" not in edge_id:
            raise KeyError(f"invalid edge id format: {edge_id!r}")
        source, target = edge_id.split("-", 1)
        existing = self.storage.get_edge(source, target)
        if existing is None:
            raise KeyError(f"edge not found: {edge_id}")

        # 直接调 LLM 生成新解释(用 _generate_edge 的 prompt 风格)
        s_label = get_label_for_code(source) or source
        t_label = get_label_for_code(target) or target
        # v2 收敛:关系类型固定为 supports(单向 A 支撑 B)
        prompt = (
            f"分析行业 {source}({s_label}) 与行业 {target}({t_label}) 之间的产业关系。\n\n"
            f"方向语义:**{s_label} 支撑 {t_label}** —— 资源 / 服务 / 技术从 {s_label} 流向 {t_label}。\n\n"
            f"**禁止生成双向边**:本边方向固定为 {source} → {target}。\n\n"
            f"返回严格 JSON 格式(不要 markdown,不要解释):\n"
            f'{{"weight": <1-5 整数,关系强度>, '
            f'"explanation": "<一句话中文解释,不超过 40 字,说明 {s_label} 如何支撑 {t_label}>"}}\n\n'
            f"weight 5 = 强核心依赖,1 = 弱/偶发关联。"
        )

        last_exc: Exception | None = None
        for attempt in range(2):
            raw = await self._call_llm_with_retry(prompt)
            try:
                data = _parse_json_strict(raw)
                new_explanation = str(data["explanation"])
                # 持久化新解释(只更新 explanation + last_attempt_at,
                # 不动 relation_type/weight,避免误改拓扑)
                updated = existing.model_copy(
                    update={
                        "explanation": new_explanation,
                        "last_attempt_at": datetime.now(timezone.utc),
                    }
                )
                self.storage.upsert_edge(updated)
                # 失效缓存,让下次 init_or_load_graph 拿到新解释
                config_hash = self._compute_config_hash()
                self.cache.delete(f"{CACHE_KEY_PREFIX}{config_hash}")
                return {
                    "edge_id": edge_id,
                    "explanation": new_explanation,
                    "generated_at": datetime.now(timezone.utc),
                }
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                last_exc = e
                logger.warning(
                    "reexplain edge %s JSON parse attempt %d failed: %s",
                    edge_id, attempt + 1, e,
                )
        assert last_exc is not None
        raise ValueError(
            f"LLM JSON 解析失败 2 次: {last_exc!s}"
        ) from last_exc

    # ---------- LLM call ----------

    async def _call_llm_with_retry(self, prompt: str) -> str:
        """调 LLM,JSON 解析错误重试 1 次。

        错误处理策略(对齐 spec 3.4):
        - 首次调用就失败(LLM 从未成功过) -> 抛 LLMUnavailableError
          (前端白屏 + '请配置 LLM')
        - 已经成功过,这一次失败 -> 抛 TransientLLMError,让调用方把当前
          node/edge 标 failed,然后继续
        """
        try:
            first = await self.llm.generate(prompt)
        except Exception as e:
            if self._llm_ever_succeeded:
                # transient: 让调用方把 node/edge 标 failed
                raise TransientLLMError(str(e)) from e
            # 首次失败 -> 整体不可用
            logger.error("LLM generate failed (never succeeded): %s", e)
            raise LLMUnavailableError(
                f"LLM 不可用: {e!s}. 请检查 LLM 配置。"
            ) from e
        self._llm_ever_succeeded = True
        return first

    # ---------- config hash ----------

    def _compute_config_hash(self) -> str:
        """provider + model + api_key 前 8 位的 sha256."""
        if self._llm_config_hash is not None:
            return self._llm_config_hash
        provider = getattr(self.llm, "name", "unknown")
        model = getattr(self.llm, "default_model", "unknown")
        api_key = getattr(self.llm, "api_key", "")
        api_key_prefix = api_key[:8] if api_key else ""
        raw = f"{provider}:{model}:{api_key_prefix}"
        self._llm_config_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return self._llm_config_hash

    def _write_cache(self, key: str, graph: KnowledgeGraph) -> None:
        try:
            payload = graph.model_dump(mode="json")
            self.cache.set(key, payload, ttl_seconds=CACHE_TTL_SECONDS)
        except Exception as e:
            logger.warning("failed to write graph cache: %s", e)


# ---------- module-level helpers ----------


def _status_counts(items: list[Any]) -> dict[NodeStatus, int]:
    counts = {NodeStatus.pending: 0, NodeStatus.generated: 0, NodeStatus.failed: 0}
    for item in items:
        counts[item.status] = counts.get(item.status, 0) + 1
    return counts


def _make_failed_node(code: str, reason: str) -> GraphNode:
    label = get_label_for_code(code) or code
    category_str = get_category_for_code(code) or "A"
    return GraphNode(
        id=code,
        label=label,
        category=Category(category_str),
        description="",
        status=NodeStatus.failed,
        failed_reason=reason,
        last_attempt_at=datetime.now(timezone.utc),
    )


def _make_failed_edge(source_id: str, target_id: str, reason: str) -> GraphEdge:
    return GraphEdge(
        source=source_id,
        target=target_id,
        relation_type=RelationType.supports,  # v2:固定 supports(原 placeholder 保留)
        weight=1,  # placeholder
        explanation="",
        status=NodeStatus.failed,
        failed_reason=reason,
        last_attempt_at=datetime.now(timezone.utc),
    )


def _parse_json_strict(text: str) -> dict:
    """严格 JSON 解析,允许 markdown 围栏."""
    text = text.strip()
    # 去掉 ```json ... ``` 围栏
    if text.startswith("```"):
        lines = text.splitlines()
        # 去掉首行 ```json / ```,末行 ```
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return json.loads(text)


def _build_default_edge_pairs(node_ids: list[str]) -> list[tuple[str, str]]:
    """构造有代表性的"价值链"边对(避免 n*(n-1)/2 过载).

    T3 MVP:相邻下标的节点配对(去重 + 去自环).
    """
    pairs: list[tuple[str, str]] = []
    for i in range(len(node_ids)):
        for j in range(i + 1, len(node_ids)):
            pairs.append((node_ids[i], node_ids[j]))
    # 截断到前 N 对,避免 n*(n-1)/2 过大
    # 11 节点 -> 55 对,MVP 截到 12 对
    return pairs[:12]


# GB/T 4754-2017 大类名称(20 大类) — 用于 LLM prompt
# 顺序:枚举 Category 的字母顺序
_GBT4754_CATEGORY_NAMES: dict[str, str] = {
    "A": "农、林、牧、渔业",
    "B": "采矿业",
    "C": "制造业",
    "D": "电力、热力、燃气及水生产和供应业",
    "E": "建筑业",
    "F": "批发和零售业",
    "G": "交通运输、仓储和邮政业",
    "H": "住宿和餐饮业",
    "I": "信息传输、软件和信息技术服务业",
    "J": "金融业",
    "K": "房地产业",
    "L": "租赁和商务服务业",
    "M": "科学研究和技术服务业",
    "N": "水利、环境和公共设施管理业",
    "O": "居民服务、修理和其他服务业",
    "P": "教育",
    "Q": "卫生和社会工作",
    "R": "文化、体育和娱乐业",
    "S": "公共管理、社会保障和社会组织",
    "T": "国际组织",
}


def _all_categories() -> list[tuple[str, str]]:
    """返回 [(cat, name), ...] for all 20 GB/T 4754 categories."""
    return [(cat.value, _GBT4754_CATEGORY_NAMES[cat.value]) for cat in Category]


def _build_category_prompt(cat: str, cat_name: str) -> str:
    """构造单次 LLM call 的 prompt — 列出该大类下所有中类."""
    return (
        f"列出 GB/T 4754-2017 国民经济行业分类中,"
        f"【{cat_name} ({cat})】大类下的所有中类。\n\n"
        f"输出要求(JSON 数组,不要 markdown 围栏):\n"
        f"[\n"
        f"  {{\n"
        f'    "code": "{cat}01",          // 中类代码(字母+2位数字)\n'
        f'    "name": "农业",              // 中类名称\n'
        f'    "description": "..."        // 一句话描述(20-50 字)\n'
        f"  }},\n"
        f"  ...\n"
        f"]\n\n"
        f"注意:\n"
        f"- 严格按 GB/T 4754-2017 实际中类清单(中类代码格式:字母+2位数字)\n"
        f"- 数量上,参考实际分类(每类 3-8 个中类)\n"
        f"- description 简短,说清中类做什么,不写「包括但不限于」等废话\n"
        f"- 只输出 JSON,不要解释/前言/后语"
    )
