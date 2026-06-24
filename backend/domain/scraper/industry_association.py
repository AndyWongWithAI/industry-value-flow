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

# 医疗 4 类机构 2024 数据(单位:万个)
# 数据来源:国家卫健委《2024 年我国卫生健康事业发展统计公报》
_MED_SEGMENTS_2024 = [
    ("med_hospital", "医院", 38.5),
    ("med_grassroot", "基层医疗卫生机构", 104.4),
    ("med_public_health", "专业公共卫生机构", 3.4),
    ("med_other", "其他医疗卫生机构", 6.0),
]

_MED_SOURCE_URL = "http://www.nhc.gov.cn/guihuaxxs/s3585u/2024.htm"


class IndustryAssociationScraper:
    """Fallback scraper: 返回硬编码的 5 行业骨架,颜色统一为 #888888 标识 fallback 数据。"""

    def __init__(self, http_client: httpx.AsyncClient):
        self.http = http_client

    async def fetch(self, industry_id: str) -> SankeyData:
        if industry_id not in VALID_INDUSTRY_IDS:
            raise ValueError(f"unknown industry: {industry_id}")
        if industry_id == "healthcare":
            return self._build_healthcare()
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
        return SankeyData(
            industries=industries,
            nodes=nodes,
            edges=edges,
            source="占位数据",
            year=2024,
            unit="亿元",
            source_url=None,
        )

    def _build_healthcare(self) -> SankeyData:
        industries = [Industry(id="healthcare", name="医疗业", color="#9b59b6")]
        nodes = [
            ValueFlowNode(id=nid, label=label, layer=0)
            for nid, label, _ in _MED_SEGMENTS_2024
        ] + [
            ValueFlowNode(id="med_total", label="医疗卫生机构合计", layer=1),
            ValueFlowNode(id="patients", label="服务对象", layer=2),
        ]
        edges = [
            ValueFlowEdge(source=nid, target="med_total", value=value)
            for nid, _, value in _MED_SEGMENTS_2024
        ] + [
            ValueFlowEdge(
                source="med_total",
                target="patients",
                value=sum(v for _, _, v in _MED_SEGMENTS_2024),
            ),
        ]
        return SankeyData(
            industries=industries,
            nodes=nodes,
            edges=edges,
            source="国家卫健委 2024 年我国卫生健康事业发展统计公报",
            source_url=_MED_SOURCE_URL,
            year=2024,
            unit="万个",
        )
