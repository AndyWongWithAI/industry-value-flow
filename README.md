# 行业价值流转可视化平台

[![CI](https://github.com/AndyWongWithAI/industry-value-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/AndyWongWithAI/industry-value-flow/actions/workflows/ci.yml)

本地个人使用,详见 `docs/superpowers/specs/2026-06-24-行业价值流转可视化平台-design.md`(原始 spec)和 `docs/superpowers/specs/2026-06-25-接入真实数据-design.md`(数据接入)。

## 数据来源

5 行业全部接真实数据(2024),桑基图 footer 标数据来源与年份。

| 行业 | 口径 | 单位 | 来源 |
|---|---|---|---|
| 农业 / 制造业 | 分行业 GDP 增加值 | 亿元 | 国家统计局 |
| 教育 | 在校生数 | 万人 | 教育部统计公报 |
| 医疗 | 机构数 | 万个 | 卫健委统计公报 |
| 金融 | 资金存量 | 万亿元 | 央行 / 银保监会 / 证监会 |

数据获取策略:公报硬编码为主(`backend/domain/scraper/industry_association.py`),cn-stats 包为辅,网络不通时自动 fallback。

## 启动

```bash
# 后端
cd /home/hq/projects/industry-value-flow
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# 前端(另一 terminal)
cd /home/hq/projects/industry-value-flow/frontend
npm run dev
# 访问 http://localhost:5173
```

## LLM 配置

1. 打开 http://localhost:5173/settings
2. 选 provider,填 API key + model
3. 点击"保存"

## 测试

```bash
# 后端
cd /home/hq/projects/industry-value-flow
source .venv/bin/activate
pytest backend/tests/ -v

# 前端
cd frontend && npm test
```

## 目录

```
backend/     FastAPI 后端
frontend/    Vite + React 前端
docs/        设计 + 实施计划
```

## 验收清单(从 spec §13)

- [ ] 后端 uvicorn 启动无 error
- [ ] 前端 npm run dev 启动无 error
- [ ] 5 行业(农业/制造/金融/教育/医疗)首页 Sankey 渲染
- [ ] 点击任一行业 → 子环节小 Sankey + 痛点面板(LLM 生成)
- [ ] Settings 切换 Claude/OpenAI/DeepSeek/MiniMax,重生成痛点成功
- [ ] LLM 全挂时 PainPanel 降级,Sankey 不受影响
- [ ] 单元测试覆盖率 > 80%
- [ ] Integration + E2E 通过
- [ ] 资产在 arch 平台登记(4 个)
- [ ] **5 行业桑基图用真实数据(2024)**
- [ ] **金融业呈现"资金来源 → 机构 → 运用"3 层桑基**
- [ ] **Footer 显示数据来源与年份,source_url 可点击**