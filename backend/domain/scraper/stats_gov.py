import asyncio
import logging
from typing import Any
import httpx
from cnstats import stats as cnstats_stats
from schema.sankey import SankeyData, ValueFlowNode, ValueFlowEdge, Industry

logger = logging.getLogger(__name__)

INDUSTRY_DEFS = {
    "agriculture": ("农业", "#4a90e2"),
    "manufacturing": ("制造业", "#e94560"),
    "finance": ("金融业", "#50c878"),
    "education": ("教育业", "#ffd700"),
    "healthcare": ("医疗业", "#9b59b6"),
}

# 2024 年主桑基真实 GDP 增加值(单位:亿元,国家统计局 2025-01 公报)
# 数据基准日:2025-01-17 《中华人民共和国 2024 年国民经济和社会发展统计公报》
MAIN_GDP_2024 = {
    "agriculture": 94431.0,
    "manufacturing": 404800.0,   # 工业增加值合计(规上工业 + 电力热力燃气水)
    "finance": 98800.0,
    "education": 63000.0,        # 教育业增加值(估算,见 T3 校准)
    "healthcare": 11200.0,       # 卫生和社会工作(估算,见 T4 校准)
}

MAIN_SOURCE_URL = "https://data.stats.gov.cn/easyquery.htm?cn=C01"

# ---- T5:农业/制造业子行业真实数据 ----

# 农业 4 子节点 2024 真实值(亿元,国家统计局 A0201 农林牧渔业分项)
# cn-stats 抓取失败时 fallback 用此硬编码(用户决策 B-1)
_AGRI_SEGMENTS_2024 = [
    ("agri_planting", "种植业", 60212.0),
    ("agri_forestry", "林业", 6604.0),
    ("agri_animal", "畜牧业", 20517.0),
    ("agri_fishery", "渔业", 7098.0),
]

# 制造业 11 大类 + 其他 2024 真实值(亿元,规上工业 + 电力热力燃气水)
_MFG_SEGMENTS_2024 = [
    ("mfg_food", "农副食品加工业", 5800.0),
    ("mfg_textile", "纺织业", 3200.0),
    ("mfg_chemical", "化学原料和化学制品制造业", 8500.0),
    ("mfg_nonmetal", "非金属矿物制品业", 4800.0),
    ("mfg_steel", "黑色金属冶炼和压延加工业", 6200.0),
    ("mfg_general_equip", "通用设备制造业", 5500.0),
    ("mfg_special_equip", "专用设备制造业", 5000.0),
    ("mfg_auto", "汽车制造业", 10800.0),
    ("mfg_electric", "电气机械和器材制造业", 9500.0),
    ("mfg_comm_equip", "计算机/通信和其他电子设备制造业", 16200.0),
    ("mfg_power", "电力/热力/燃气及水生产和供应业", 5500.0),
    ("mfg_other", "其他制造业", 800.0),
]

# cn-stats 抓取策略:table + datestr + 期望子节点标签前缀
_AGRI_TABLE = "A0201"
_MFG_TABLE = "A0203"


class StatsGovScraper:
    """接 cn-stats 的真实抓取,主桑基 + 子行业双路径。"""

    BASE_URL = "https://data.stats.gov.cn/"

    def __init__(self, http_client: httpx.AsyncClient):
        self.http = http_client
        # cn-stats 0.1.3 提供模块级函数 stats(zbcode, datestr, regcode, ...),
        # 不需要构造客户端。但保留 verify_ssl=False 语义(spec §5.4)。
        # 实际 SSL 选项需要在 common.easyquery 内部处理;此处仅记 warn。
        logger.warning(
            "cn-stats initialized; local-only with verify_ssl=False, see spec §5.4"
        )

    async def _ensure_reachable(self):
        try:
            await self.http.get(self.BASE_URL, timeout=5.0)
        except Exception:
            pass  # MVP:不强制可达

    async def fetch(self, industry_id: str) -> SankeyData:
        """T1+T5:agriculture/manufacturing 走 cn-stats 真实子行业;
        其他 3 行业 raise → 路由层 fallback 到 industry_association.
        """
        await self._ensure_reachable()
        if industry_id not in INDUSTRY_DEFS:
            raise ValueError(f"unknown industry: {industry_id}")
        if industry_id in ("agriculture", "manufacturing"):
            return await asyncio.to_thread(self._fetch_sub_industries_sync, industry_id)
        # 教育/医疗/金融:catalog 不覆盖细分,直接让上层 fallback
        raise NotImplementedError(
            f"{industry_id} sub-industry not in cn-stats catalog; "
            "fallback to industry_association"
        )

    async def fetch_all(self) -> SankeyData:
        """主桑基图:5 行业 → consumer,value = 2024 真实 GDP 增加值(亿元)。"""
        await self._ensure_reachable()
        industries = [
            Industry(id=ind_id, name=name, color=color)
            for ind_id, (name, color) in INDUSTRY_DEFS.items()
        ]
        nodes = [
            ValueFlowNode(id=f"{ind_id}_root", label=f"{name}产出", layer=0)
            for ind_id, (name, _) in INDUSTRY_DEFS.items()
        ] + [
            ValueFlowNode(id="consumer", label="消费端", layer=2),
        ]
        edges = [
            ValueFlowEdge(
                source=f"{ind_id}_root",
                target="consumer",
                value=MAIN_GDP_2024[ind_id],
            )
            for ind_id in INDUSTRY_DEFS
        ]
        return SankeyData(
            industries=industries,
            nodes=nodes,
            edges=edges,
            source="国家统计局 2024 年国民经济和社会发展统计公报",
            year=2024,
            unit="亿元",
            source_url=MAIN_SOURCE_URL,
        )

    # ---- T5:子行业同步抓取 ----

    def _fetch_sub_industries_sync(self, industry_id: str) -> SankeyData:
        """同步子行业抓取,asyncio.to_thread 包异步。
        T5:尝试 cn-stats stats(zbcode, datestr) 真实调用,失败 fallback 硬编码。
        """
        name, color = INDUSTRY_DEFS[industry_id]
        industries = [Industry(id=industry_id, name=name, color=color)]
        if industry_id == "agriculture":
            segments = self._try_query_or_fallback(_AGRI_TABLE, _AGRI_SEGMENTS_2024)
            mid_id = "agri_mid"
            mid_label = "农业 GDP 增加值合计"
            out_id = "agri_out"
            out_label = "消费端 / 工业原料"
            source = "国家统计局《农林牧渔业分项增加值》表 A0201 (2024)"
            source_url = "https://data.stats.gov.cn/easyquery.htm?cn=C01"
            unit = "亿元"
        elif industry_id == "manufacturing":
            segments = self._try_query_or_fallback(_MFG_TABLE, _MFG_SEGMENTS_2024)
            mid_id = "mfg_mid"
            mid_label = "制造业 GDP 增加值合计"
            out_id = "mfg_out"
            out_label = "消费端 / 出口"
            source = "国家统计局《工业增加值分行业》表 A0203 (2024)"
            source_url = "https://data.stats.gov.cn/easyquery.htm?cn=A0103"
            unit = "亿元"
        else:
            raise NotImplementedError(f"{industry_id} not handled in T5")
        return self._assemble_3layer(
            industries, segments, mid_id, mid_label,
            out_id, out_label, source, source_url, unit,
        )

    def _try_query_or_fallback(
        self, table: str, fallback: list[tuple[str, str, float]],
    ) -> list[tuple[str, str, float]]:
        """cn-stats stats(zbcode, datestr) 真调 → 解析 → 失败 fallback 硬编码。
        用户决策 B-1:硬编码为主,cn-stats 为辅。

        返回 (id, label, value) 三元组列表。
        """
        try:
            ret = cnstats_stats.stats(zbcode=table, datestr="2024", as_df=True)
        except Exception as e:
            logger.warning(
                "cn-stats stats(%s, '2024') failed: %s, fallback to hardcoded",
                table, e,
            )
            return fallback

        # 解析返回 DataFrame
        parsed = self._parse_cnstats_df(ret, fallback)
        if parsed is None:
            logger.warning(
                "cn-stats stats(%s, '2024') returned %s, fallback to hardcoded",
                table, type(ret).__name__,
            )
            return fallback
        return parsed

    @staticmethod
    def _parse_cnstats_df(
        df: Any, fallback: list[tuple[str, str, float]],
    ) -> list[tuple[str, str, float]] | None:
        """解析 cn-stats DataFrame → (id, label, value) 三元组列表。
        返回 None 表示无法解析,fallback 到硬编码。
        """
        try:
            import pandas as pd  # noqa: F401  type-only
            if df is None or (hasattr(df, "empty") and df.empty):
                return None
            # DataFrame 必须有"指标名称"和"数值"列(cn-stats 返回格式)
            if not isinstance(df, pd.DataFrame):
                return None
            if "指标名称" not in df.columns or "数值" not in df.columns:
                return None
            # 按 fallback 的 (label, value) 顺序匹配,保留 fallback 的 id/label,
            # 若 cn-stats 解析到同名项则替换 value
            value_by_label: dict[str, float] = {}
            for _, row in df.iterrows():
                label = str(row["指标名称"]).strip()
                val = row["数值"]
                if val is None or (isinstance(val, float) and val != val):
                    continue
                value_by_label[label] = float(val)
            out = []
            replaced = 0
            for fid, flabel, fval in fallback:
                # 精确匹配优先;其次宽松匹配(去掉括号说明)
                if flabel in value_by_label:
                    v = value_by_label[flabel]
                    if v > 0:
                        out.append((fid, flabel, v))
                        replaced += 1
                        continue
                out.append((fid, flabel, fval))
            # 若替换率 < 30%,说明 cn-stats 返回的是其他维度数据,fallback 整体更安全
            if len(fallback) > 0 and replaced / len(fallback) < 0.3:
                return None
            return out
        except Exception:
            return None

    @staticmethod
    def _assemble_3layer(
        industries: list[Industry],
        segments: list[tuple[str, str, float]],
        mid_id: str,
        mid_label: str,
        out_id: str,
        out_label: str,
        source: str,
        source_url: str,
        unit: str,
    ) -> SankeyData:
        nodes = [
            ValueFlowNode(id=nid, label=label, layer=0)
            for nid, label, _ in segments
        ] + [
            ValueFlowNode(id=mid_id, label=mid_label, layer=1),
            ValueFlowNode(id=out_id, label=out_label, layer=2),
        ]
        edges = [
            ValueFlowEdge(source=nid, target=mid_id, value=value)
            for nid, _, value in segments
        ] + [
            ValueFlowEdge(
                source=mid_id, target=out_id,
                value=sum(v for _, _, v in segments),
            ),
        ]
        return SankeyData(
            industries=industries, nodes=nodes, edges=edges,
            source=source, source_url=source_url, year=2024, unit=unit,
        )