# 行业价值流转可视化平台

本地个人使用,详见 `docs/superpowers/specs/2026-06-24-行业价值流转可视化平台-design.md`。

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