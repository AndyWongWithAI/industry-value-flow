import httpx
from schema.sankey import SankeyData, ValueFlowNode, ValueFlowEdge, Industry

INDUSTRY_DEFS = {
    "agriculture": ("农业", "#4a90e2"),
    "manufacturing": ("制造业", "#e94560"),
    "finance": ("金融业", "#50c878"),
    "education": ("教育业", "#ffd700"),
    "healthcare": ("医疗业", "#9b59b6"),
}


class StatsGovScraper:
    """MVP 简化版:返回硬编码的 5 行业骨架。 后续接真实 stats.gov.cn 解析。"""

    BASE_URL = "https://data.stats.gov.cn/"

    def __init__(self, http_client: httpx.AsyncClient):
        self.http = http_client

    async def _ensure_reachable(self):
        try:
            await self.http.get(self.BASE_URL, timeout=5.0)
        except Exception:
            pass  # MVP:不强制可达

    async def fetch(self, industry_id: str) -> SankeyData:
        await self._ensure_reachable()
        if industry_id not in INDUSTRY_DEFS:
            raise ValueError(f"unknown industry: {industry_id}")
        return self._build_industry_data(industry_id)

    async def fetch_all(self) -> SankeyData:
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
            ValueFlowEdge(source=f"{ind_id}_root", target="consumer", value=100.0)
            for ind_id in INDUSTRY_DEFS
        ]
        return SankeyData(industries=industries, nodes=nodes, edges=edges)

    def _build_industry_data(self, industry_id: str) -> SankeyData:
        name, color = INDUSTRY_DEFS[industry_id]
        industries = [Industry(id=industry_id, name=name, color=color)]
        nodes = [
            ValueFlowNode(id=f"{industry_id}_root", label=f"{name}投入", layer=0),
            ValueFlowNode(id=f"{industry_id}_mid", label=f"{name}加工", layer=1),
            ValueFlowNode(id=f"{industry_id}_out", label=f"{name}产出", layer=2),
        ]
        edges = [
            ValueFlowEdge(source=f"{industry_id}_root", target=f"{industry_id}_mid", value=80.0),
            ValueFlowEdge(source=f"{industry_id}_mid", target=f"{industry_id}_out", value=80.0),
        ]
        return SankeyData(industries=industries, nodes=nodes, edges=edges)