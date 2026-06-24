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

# 教育 8 学段 2024 在校生数(单位:万人)
# 数据来源:教育部《2024 年全国教育事业发展统计公报》
_EDU_SEGMENTS_2024 = [
    ("edu_preschool", "学前教育", 4803.0),
    ("edu_primary", "小学", 10584.0),
    ("edu_junior", "初中", 5243.0),
    ("edu_senior", "普通高中", 2803.0),
    ("edu_voc_junior", "中等职业教育", 1298.0),
    ("edu_voc_senior", "高职专科", 1770.0),
    ("edu_undergrad", "普通本科", 2478.0),
    ("edu_grad", "研究生", 388.0),
]

_EDU_SOURCE_URL = "http://www.moe.gov.cn/jyb_sjzl/sjzl_fztjgb/"

# ---- T6:金融业新叙事(资金来源 → 金融机构 → 资金运用) ----

# 金融 3 层 9 节点 2024 真实值(单位:万亿元)
# 数据来源:中国人民银行 + 国家金融监督管理总局 + 中国证监会
_FIN_SOURCE = [
    ("fin_src_household_dep", "住户存款", 152.3),    # 央行《社融存量》
    ("fin_src_corp_dep", "企业存款", 78.2),          # 央行
]
_FIN_INSTITUTION = [
    ("fin_inst_bank", "银行业金融机构", 372.0),      # 银保监会 总资产
    ("fin_inst_sec", "证券业", 13.5),                # 证监会 总资产
    ("fin_inst_ins", "保险业", 33.3),                # 银保监会 总资产
]
_FIN_USAGE = [
    ("fin_use_loan", "各项贷款", 258.4),             # 央行
    ("fin_use_premium", "保费收入", 5.7),            # 银保监会
    ("fin_use_raised", "证券承销筹资", 4.5),         # 证监会 2024 IPO+增发
]

# 资金来源与运用总额不一致(来源 230.5,运用 268.6)→ 接受(R6 风险:跨口径不一致,UI footer 标注)


class IndustryAssociationScraper:
    """Fallback scraper: 返回硬编码的 5 行业骨架,颜色统一为 #888888 标识 fallback 数据。"""

    def __init__(self, http_client: httpx.AsyncClient):
        self.http = http_client

    async def fetch(self, industry_id: str) -> SankeyData:
        if industry_id not in VALID_INDUSTRY_IDS:
            raise ValueError(f"unknown industry: {industry_id}")
        if industry_id == "education":
            return self._build_education()
        if industry_id == "healthcare":
            return self._build_healthcare()
        if industry_id == "finance":
            return self._build_finance()
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

    def _build_education(self) -> SankeyData:
        industries = [Industry(id="education", name="教育业", color="#ffd700")]
        nodes = [
            ValueFlowNode(id=nid, label=label, layer=0)
            for nid, label, _ in _EDU_SEGMENTS_2024
        ] + [
            ValueFlowNode(id="edu_total", label="教育合计", layer=1),
            ValueFlowNode(id="workforce", label="毕业生流向", layer=2),
        ]
        edges = [
            ValueFlowEdge(source=nid, target="edu_total", value=value)
            for nid, _, value in _EDU_SEGMENTS_2024
        ] + [
            ValueFlowEdge(
                source="edu_total",
                target="workforce",
                value=sum(v for _, _, v in _EDU_SEGMENTS_2024),
            ),
        ]
        return SankeyData(
            industries=industries,
            nodes=nodes,
            edges=edges,
            source="教育部 2024 年全国教育事业发展统计公报",
            source_url=_EDU_SOURCE_URL,
            year=2024,
            unit="万人",
        )

    def _build_finance(self) -> SankeyData:
        """金融业新叙事:资金来源 → 金融机构 → 资金运用(3 层 9 节点,万亿元)。"""
        industries = [Industry(id="finance", name="金融业", color="#50c878")]
        nodes = []
        edges = []

        # layer 0: 资金来源
        for nid, label, _ in _FIN_SOURCE:
            nodes.append(ValueFlowNode(id=nid, label=label, layer=0))
        # layer 1: 金融机构
        for nid, label, _ in _FIN_INSTITUTION:
            nodes.append(ValueFlowNode(id=nid, label=label, layer=1))
        # layer 2: 资金运用
        for nid, label, _ in _FIN_USAGE:
            nodes.append(ValueFlowNode(id=nid, label=label, layer=2))

        # edges: 来源 → 机构(按机构资产比例分配)
        total_inst = sum(v for _, _, v in _FIN_INSTITUTION)
        for sid, _, sv in _FIN_SOURCE:
            for iid, _, iv in _FIN_INSTITUTION:
                edges.append(
                    ValueFlowEdge(source=sid, target=iid, value=sv * iv / total_inst)
                )

        # edges: 机构 → 运用(按机构资产比例分配到三类运用)
        for iid, _, iv in _FIN_INSTITUTION:
            for uid, _, uv in _FIN_USAGE:
                edges.append(
                    ValueFlowEdge(source=iid, target=uid, value=iv * uv / total_inst)
                )

        return SankeyData(
            industries=industries,
            nodes=nodes,
            edges=edges,
            source="中国人民银行/国家金融监督管理总局/证监会 2024 年公报",
            source_url="https://www.pbc.gov.cn/",
            year=2024,
            unit="万亿元",
        )
