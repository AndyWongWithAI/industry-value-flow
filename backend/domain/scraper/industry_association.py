import httpx
from schema.sankey import SankeyData, ValueFlowNode, ValueFlowEdge, Industry
from schema.industry import VALID_INDUSTRY_IDS

# Fallback:与 stats_gov 相同的骨架,实际可接中国行业协会数据
_INDUSTRY_NAMES = {
    "agriculture": "农业",
    "manufacturing": "制造业",
    "finance": "金融业",
    "education": "教育业",
    "healthcare": "医疗业",
}


class IndustryAssociationScraper:
    """Fallback scraper: 返回硬编码的 5 行业骨架,颜色统一为 #888888 标识 fallback 数据。"""

    def __init__(self, http_client: httpx.AsyncClient):
        self.http = http_client

    async def fetch(self, industry_id: str) -> SankeyData:
        if industry_id not in VALID_INDUSTRY_IDS:
            raise ValueError(f"unknown industry: {industry_id}")
        return await self.fetch_all()  # fallback:全量数据中过滤

    async def fetch_all(self) -> SankeyData:
        industries = [
            Industry(id=ind_id, name=name, color="#888888")
            for ind_id, name in _INDUSTRY_NAMES.items()
        ]
        nodes = [
            ValueFlowNode(id=f"{ind_id}_root", label=f"{name}产出", layer=0)
            for ind_id, name in _INDUSTRY_NAMES.items()
        ] + [ValueFlowNode(id="consumer", label="消费端", layer=2)]
        edges = [
            ValueFlowEdge(source=f"{ind_id}_root", target="consumer", value=50.0)
            for ind_id in _INDUSTRY_NAMES
        ]
        return SankeyData(industries=industries, nodes=nodes, edges=edges)