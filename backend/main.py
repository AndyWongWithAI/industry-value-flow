"""FastAPI 入口.

T1 后:lifespan 不再清 v1 cache(SankeyData 已删除,不再需要).
T4: lifespan 构造 GraphService(LLM client + GraphRepo + Cache)并放到
    app.state.graph_service;路由通过 Depends 注入。

设计:
- lifespan 只做"轻量"初始化(读 settings + 实例化 client/repo/cache),
  不在启动时调 LLM(避免服务冷启动阻塞)。
- 第一次请求 /api/graph 时才调 init_or_load_graph()(可走 cache 立即返回,
  或生成 partial 图)。
- LLM 未配置时,app.state.graph_service = None,路由返回 503 + llm_unavailable。
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.graph import router as graph_router
from routes.industries import router as industries_router
from routes.industry import router as industry_router
from routes.llm import router as llm_router
from routes.settings import router as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # T4: 启动时构造 GraphService,放到 app.state 供 DI 注入
    try:
        from config import get_settings, get_db_path
        from domain.graph.graph_service import GraphService
        from domain.storage.cache import Cache
        from domain.storage.graph_repo import GraphRepo
        from domain.llm.registry import LLMProviderRegistry

        settings = get_settings()
        active_name = settings.active_provider
        active_cfg = (
            settings.providers.get(active_name) if settings.providers else None
        )

        if active_cfg is not None and active_cfg.api_key:
            registry = LLMProviderRegistry()
            llm_client = registry.create(active_name, active_cfg)
        else:
            # LLM 未配置 — 留空 service,路由层会返回 503
            llm_client = None

        repo = GraphRepo(db_path=get_db_path())
        cache = Cache(db_path=get_db_path())
        if llm_client is not None:
            app.state.graph_service = GraphService(llm_client, repo, cache)
        else:
            app.state.graph_service = None
    except Exception:
        # 启动失败 → 让路由返回 503
        app.state.graph_service = None
    yield


app = FastAPI(title="行业价值流转平台", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(industries_router)
app.include_router(industry_router)
app.include_router(llm_router)
app.include_router(settings_router)
app.include_router(graph_router)


@app.get("/health")
def health():
    return {"status": "ok"}
