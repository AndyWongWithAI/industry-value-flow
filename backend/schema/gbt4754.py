# GB/T 4754-2017 国民经济行业分类 — 中类(二级)代码
# 来源: https://www.stats.gov.cn/sj/tjbz/gjtjbz/202302/t20230213_1902763.html
# 实施时确认最新版本,如有变化同步更新

GBT4754_MIDDLE_CATEGORIES: list[dict[str, str]] = [
    # A 农、林、牧、渔业
    {"code": "A01", "label": "农业", "category": "A"},
    {"code": "A02", "label": "林业", "category": "A"},
    {"code": "A03", "label": "畜牧业", "category": "A"},
    {"code": "A04", "label": "渔业", "category": "A"},
    {"code": "A05", "label": "农、林、牧、渔专业及辅助性活动", "category": "A"},
    # B 采矿业
    {"code": "B06", "label": "煤炭开采和洗选业", "category": "B"},
    {"code": "B07", "label": "石油和天然气开采业", "category": "B"},
    {"code": "B08", "label": "黑色金属矿采选业", "category": "B"},
    {"code": "B09", "label": "有色金属矿采选业", "category": "B"},
    {"code": "B10", "label": "非金属矿采选业", "category": "B"},
    {"code": "B11", "label": "开采专业及辅助性活动", "category": "B"},
    {"code": "B12", "label": "其他采矿业", "category": "B"},
    # C 制造业
    {"code": "C13", "label": "农副食品加工业", "category": "C"},
    {"code": "C14", "label": "食品制造业", "category": "C"},
    {"code": "C15", "label": "酒、饮料和精制茶制造业", "category": "C"},
    {"code": "C16", "label": "烟草制品业", "category": "C"},
    {"code": "C17", "label": "纺织业", "category": "C"},
    {"code": "C18", "label": "纺织服装、服饰业", "category": "C"},
    {"code": "C19", "label": "皮革、毛皮、羽毛及其制品和制鞋业", "category": "C"},
    {"code": "C20", "label": "木材加工和木、竹、藤、棕、草制品业", "category": "C"},
    {"code": "C21", "label": "家具制造业", "category": "C"},
    {"code": "C22", "label": "造纸和纸制品业", "category": "C"},
    {"code": "C23", "label": "印刷和记录媒介复制业", "category": "C"},
    {"code": "C24", "label": "文教、工美、体育和娱乐用品制造业", "category": "C"},
    {"code": "C25", "label": "石油加工、炼焦和核燃料加工业", "category": "C"},
    {"code": "C26", "label": "化学原料和化学制品制造业", "category": "C"},
    {"code": "C27", "label": "医药制造业", "category": "C"},
    {"code": "C28", "label": "化学纤维制造业", "category": "C"},
    {"code": "C29", "label": "橡胶和塑料制品业", "category": "C"},
    {"code": "C30", "label": "非金属矿物制品业", "category": "C"},
    {"code": "C31", "label": "黑色金属冶炼和压延加工业", "category": "C"},
    {"code": "C32", "label": "有色金属冶炼和压延加工业", "category": "C"},
    {"code": "C33", "label": "金属制品业", "category": "C"},
    {"code": "C34", "label": "通用设备制造业", "category": "C"},
    {"code": "C35", "label": "专用设备制造业", "category": "C"},
    {"code": "C36", "label": "汽车制造业", "category": "C"},
    {"code": "C37", "label": "铁路、船舶、航空航天和其他运输设备制造业", "category": "C"},
    {"code": "C38", "label": "电气机械和器材制造业", "category": "C"},
    {"code": "C39", "label": "计算机、通信和其他电子设备制造业", "category": "C"},
    {"code": "C40", "label": "仪器仪表制造业", "category": "C"},
    {"code": "C41", "label": "其他制造业", "category": "C"},
    {"code": "C42", "label": "废弃资源综合利用业", "category": "C"},
    {"code": "C43", "label": "金属制品、机械和设备修理业", "category": "C"},
    # D 电力、热力、燃气及水生产和供应业
    {"code": "D44", "label": "电力、热力生产和供应业", "category": "D"},
    {"code": "D45", "label": "燃气生产和供应业", "category": "D"},
    {"code": "D46", "label": "水的生产和供应业", "category": "D"},
    # E 建筑业
    {"code": "E47", "label": "房屋建筑业", "category": "E"},
    {"code": "E48", "label": "土木工程建筑业", "category": "E"},
    {"code": "E49", "label": "建筑安装业", "category": "E"},
    {"code": "E50", "label": "建筑装饰、装修和其他建筑业", "category": "E"},
    # F 批发和零售业
    {"code": "F51", "label": "批发业", "category": "F"},
    {"code": "F52", "label": "零售业", "category": "F"},
    # G 交通运输、仓储和邮政业
    {"code": "G53", "label": "铁路运输业", "category": "G"},
    {"code": "G54", "label": "道路运输业", "category": "G"},
    {"code": "G55", "label": "水上运输业", "category": "G"},
    {"code": "G56", "label": "航空运输业", "category": "G"},
    {"code": "G57", "label": "管道运输业", "category": "G"},
    {"code": "G58", "label": "多式联运和运输代理业", "category": "G"},
    {"code": "G59", "label": "装卸搬运和仓储业", "category": "G"},
    {"code": "G60", "label": "邮政业", "category": "G"},
    # H 住宿和餐饮业
    {"code": "H61", "label": "住宿业", "category": "H"},
    {"code": "H62", "label": "餐饮业", "category": "H"},
    # I 信息传输、软件和信息技术服务业
    {"code": "I63", "label": "电信、广播电视和卫星传输服务", "category": "I"},
    {"code": "I64", "label": "互联网和相关服务", "category": "I"},
    {"code": "I65", "label": "软件和信息技术服务业", "category": "I"},
    # J 金融业
    {"code": "J66", "label": "货币金融服务", "category": "J"},
    {"code": "J67", "label": "资本市场服务", "category": "J"},
    {"code": "J68", "label": "保险业", "category": "J"},
    {"code": "J69", "label": "其他金融业", "category": "J"},
    # K 房地产业
    {"code": "K70", "label": "房地产业", "category": "K"},
    # L 租赁和商务服务业
    {"code": "L71", "label": "租赁业", "category": "L"},
    {"code": "L72", "label": "商务服务业", "category": "L"},
    # M 科学研究和技术服务业
    {"code": "M73", "label": "研究和试验发展", "category": "M"},
    {"code": "M74", "label": "专业技术服务业", "category": "M"},
    {"code": "M75", "label": "科技推广和应用服务业", "category": "M"},
    # N 水利、环境和公共设施管理业
    {"code": "N76", "label": "水利管理业", "category": "N"},
    {"code": "N77", "label": "生态保护和环境治理业", "category": "N"},
    {"code": "N78", "label": "公共设施管理业", "category": "N"},
    # O 居民服务、修理和其他服务业
    {"code": "O79", "label": "居民服务业", "category": "O"},
    {"code": "O80", "label": "机动车、电子产品和日用产品修理业", "category": "O"},
    {"code": "O81", "label": "其他服务业", "category": "O"},
    # P 教育
    {"code": "P82", "label": "教育", "category": "P"},
    # Q 卫生和社会工作
    {"code": "Q83", "label": "卫生", "category": "Q"},
    {"code": "Q84", "label": "社会工作", "category": "Q"},
    # R 文化、体育和娱乐业
    {"code": "R85", "label": "新闻和出版业", "category": "R"},
    {"code": "R86", "label": "广播、电视、电影和影视录音制作业", "category": "R"},
    {"code": "R87", "label": "文化艺术业", "category": "R"},
    {"code": "R88", "label": "体育", "category": "R"},
    {"code": "R89", "label": "娱乐业", "category": "R"},
    # S 公共管理、社会保障和社会组织
    {"code": "S90", "label": "中国共产党机关", "category": "S"},
    {"code": "S91", "label": "国家机构", "category": "S"},
    {"code": "S92", "label": "人民政协、民主党派", "category": "S"},
    {"code": "S93", "label": "社会保障", "category": "S"},
    {"code": "S94", "label": "群众团体、社会团体和其他成员组织", "category": "S"},
    {"code": "S95", "label": "基层群众自治组织及其他组织", "category": "S"},
    # T 国际组织
    {"code": "T96", "label": "国际组织", "category": "T"},
]


def is_valid_middle_category_code(code: str) -> bool:
    """校验 GB/T 4754 中类代码"""
    return any(item["code"] == code for item in GBT4754_MIDDLE_CATEGORIES)


def get_category_for_code(code: str) -> str | None:
    """获取代码对应的大类"""
    for item in GBT4754_MIDDLE_CATEGORIES:
        if item["code"] == code:
            return item["category"]
    return None


def get_label_for_code(code: str) -> str | None:
    """获取代码对应的中文名"""
    for item in GBT4754_MIDDLE_CATEGORIES:
        if item["code"] == code:
            return item["label"]
    return None
