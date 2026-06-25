# 行业知识图谱

[![CI](https://github.com/AndyWongWithAI/industry-value-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/AndyWongWithAI/industry-value-flow/actions/workflows/ci.yml)

LLM 驱动的国民经济行业关系知识图谱。基于 GB/T 4754-2017 中类(96 项),由 LLM 生成节点描述与节点间定性关系(支撑/依赖/服务/消费),前端 react-flow + dagre 布局,明色系企业风。

## 设计

启动时,后端用 LLM 一次性生成完整图(96 个中类节点 + 关系边)→ 存 SQLite → cache(`graph:v1:{llm_config_hash}`, TTL 7 天)→ 前端 react-flow 渲染。用户点击节点/边可调 LLM 实时解释,LLM **部分生成失败**时支持只重跑失败部分。

详细设计见 `docs/superpowers/specs/2026-06-25-行业知识图谱重塑-design.md`。
实施计划见 `docs/superpowers/plans/2026-06-25-行业知识图谱重塑-plan.md`。

## 核心特性

- **GB/T 4754-2017 中类**:96 个中类节点,覆盖国民经济 20 大类(A-T)
- **定性关系**:provide / rely_on / service / consume 4 种,weight 1-5
- **可视化**:react-flow + dagre 自动布局,鼠标可拖动 / 缩放
- **LLM 抽象**:支持 5 个 provider(claude / openai / deepseek / minimax / ollama),在 Settings 页切换
- **Partial failure 重跑**:LLM 部分失败时,每个节点/边立即持久化(generated / failed),失败节点红色边框 + 失败边虚线 + hover tooltip 显示失败原因,顶部状态条一键重跑失败部分
- **明色系企业风**:白底 + 品牌蓝 #1A4D8F + 思源黑体 + 24-32px 留白
- **Fallback**:LLM 不可用时显示空状态 + "前往设置" 引导

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | FastAPI + Pydantic v2 + SQLite + httpx |
| 前端 | Vite + React + TypeScript + react-flow + @dagrejs/dagre |
| LLM | 5 provider 抽象(Anthropic / OpenAI / DeepSeek / MiniMax / Ollama) |
| 测试 | pytest + vitest + Playwright e2e + respx |
| 部署 | GitHub Actions(单文件 `.github/workflows/ci.yml`) |

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
4. 返回首页,后端会自动用新 LLM 配置重新生成图(切换 provider/model → cache 自动失效)

## API 端点

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/graph` | 启动时获取完整图(含 stats) |
| `GET` | `/api/node/{id}` | 单个节点详情(NodePanel 用) |
| `GET` | `/api/edge/{id}` | 单条边详情(EdgePanel 用),`{id}` 形如 `B06-C17` |
| `GET` | `/api/edge/{id}/explain` | 实时 LLM 解释这条边 |
| `POST` | `/api/graph/regenerate-failed` | 重跑 failed 节点/边,`{"scope": "all"\|"nodes"\|"edges"}` |

LLM 不可用时 `/api/graph` 返回 503 + `{error: "llm_unavailable", message: "请配置 LLM"}`,前端显示空状态。

## 数据模型

```python
# backend/schema/graph.py
class Category(str, Enum):  # 20 大类 A-T
class RelationType(str, Enum):  # provide / rely_on / service / consume
class NodeStatus(str, Enum):    # pending / generated / failed(partial failure 关键)

class GraphNode(BaseModel):
    id: str                      # GB/T 4754 中类代码,形如 "B06"
    label: str                   # LLM 生成的节点名
    category: Category           # 大类
    description: str             # LLM 生成的节点描述
    status: NodeStatus = "generated"
    failed_reason: Optional[str] = None
    last_attempt_at: Optional[datetime] = None

class GraphEdge(BaseModel):
    id: str                      # 形如 "B06-C17"
    source: str                  # 节点 id
    target: str                  # 节点 id
    relation_type: RelationType
    weight: int = Field(ge=1, le=5)
    explanation: str             # LLM 生成的一句话解释
    status: NodeStatus = "generated"
    failed_reason: Optional[str] = None
    last_attempt_at: Optional[datetime] = None

class GraphStats(BaseModel):     # 用于 partial failure 状态条
    total: int
    generated: int
    failed: int
    pending: int

class KnowledgeGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    generated_at: datetime
    llm_config_hash: str
    schema_version: Literal["v1"]
```

## 测试

```bash
# 后端(需 PYTHONPATH=.)
cd /home/hq/projects/industry-value-flow
PYTHONPATH=. pytest backend/tests/ -v

# 前端
cd /home/hq/projects/industry-value-flow/frontend
npm test -- --run
npx tsc --noEmit

# E2E(需先 npm install + npx playwright install)
cd /home/hq/projects/industry-value-flow
npx playwright test frontend/tests/e2e/
```

当前测试覆盖:
- 后端 160 tests,97.40% coverage
- 前端 74 unit tests
- 5 Playwright e2e(graph 渲染 / 节点点击 / 边点击 / LLM 不可用 / partial failure 重跑)

## 目录结构

```
backend/
  schema/
    graph.py        # KnowledgeGraph / GraphNode / GraphEdge / GraphStats / 枚举
    gbt4754.py      # 96 中类白名单 + 校验
  domain/
    graph/          # GraphService(LLM init + partial state + cache) + GraphRepo
    llm/            # 5 provider 抽象(Anthropic/OpenAI/DeepSeek/MiniMax/Ollama)
    storage/        # SQLite 缓存 + graph_repo
  routes/
    graph.py        # 5 API 端点
  tests/

frontend/
  src/
    components/
      GraphView.tsx       # ReactFlow 包装
      GraphNode.tsx       # 自定义节点(失败时 #DC2626 红色边框)
      GraphEdge.tsx       # 自定义边(失败时虚线 + 中文关系标签)
      StatusBar.tsx       # 顶部状态条 + 重跑按钮
      NodePanel.tsx       # 节点详情面板
      EdgePanel.tsx       # 边详情面板
      EmptyState.tsx      # LLM 不可用空状态
    lib/
      gbt4754-colors.ts   # 20 大类配色
      dagre-layout.ts     # @dagrejs/dagre 自动布局
      api.ts              # 5 API 客户端 + mock
    pages/
      GraphPage.tsx       # 主页(react-flow 全图)
    types/api.ts          # 与后端 schema 严格同步
    styles/
      tokens.css          # CSS variables(品牌蓝 #1A4D8F 等)
      global.css
  tests/e2e/              # 5 Playwright e2e

docs/
  superpowers/
    specs/                # 设计与变更 spec
    plans/                # 实施计划
```

## 验收清单

- [x] 后端 uvicorn 启动无 error
- [x] 前端 npm run dev 启动无 error
- [x] react-flow 全图渲染 ≥ 90 节点
- [x] 节点点击 → NodePanel 显示节点详情 + 入/出边
- [x] 边点击 → EdgePanel 显示关系 + 强度 + 解释
- [x] LLM 不可用 → EmptyState + 设置引导
- [x] Settings 切换 5 provider 成功,cache 自动失效
- [x] Partial failure 红色边框 + 虚线 + hover tooltip + 一键重跑
- [x] 单元测试覆盖率 > 80%(后端 97.40%,前端 ≥ 80%)
- [x] 5 Playwright e2e 全过

## 不做(scope 限制)

- 节点编辑 UI(LLM 生成的图就是最终)
- 时间序列 / 历史快照
- 实时数据刷新
- 用户系统 / 权限
- 关系人工校验流程
- 导出图片 / PDF(留 backlog)
- 多进程 / 多用户并发(本地单人)
