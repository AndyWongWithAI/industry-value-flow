"""FastAPI 入口.

T1 后:lifespan 不再清 v1 cache(SankeyData 已删除,不再需要).
T4: lifespan 构造 GraphService(LLM client + GraphRepo + Cache)并放到
    app.state.graph_service;路由通过 Depends 注入。
T7: lifespan 容错 — 任何异常(LLM 不可用 / DB 路径错 / 配置损坏)
    都不应让进程 crash;改为把异常记到 app.state.startup_error,
    路由层返回 503 时携带原因。

设计:
- lifespan 只做"轻量"初始化(读 settings + 实例化 client/repo/cache),
  不在启动时调 LLM(避免服务冷启动阻塞)。
- 第一次请求 /api/graph 时才调 init_or_load_graph()(可走 cache 立即返回,
  或生成 partial 图)。
- LLM 未配置时,app.state.graph_service = None,路由返回 503 + llm_unavailable。
- T7: GraphService 构造失败(LLMUnavailableError 等)→ 不 crash,记到
  app.state.startup_error,路由层透传给前端 EmptyState reason。
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
    # T7: 失败也不 re-raise,记到 app.state.startup_error
    # (LLM 不可用/DB 路径错/配置损坏 都不应让进程挂掉)
    app.state.startup_error: str | None = None
    try:
        from config import get_settings, get_db_path
        from domain.graph.graph_service import GraphService, LLMUnavailableError
        from domain.storage.cache import Cache
        from domain.storage.graph_repo import GraphRepo
        from domain.llm.registry import LLMProviderRegistry

        settings = get_settings()
        active_name = settings.active_provider
        active_cfg = (
            settings.providers.get(active_name) if settings.providers else None
        )

        if active_cfg is not None and active_cfg.api_key:
            try:
                registry = LLMProviderRegistry()
                llm_client = registry.create(active_name, active_cfg)
            except Exception as e:
                # LLM client 创建失败(协议不识别、网络挂等)
                llm_client = None
                app.state.startup_error = f"LLM client init failed: {e}"
        else:
            # LLM 未配置 — 留空 service,路由层会返回 503
            llm_client = None
            app.state.startup_error = (
                "LLM 未配置: 请在设置页配置 active_provider + api_key"
            )

        repo = GraphRepo(db_path=get_db_path())
        cache = Cache(db_path=get_db_path())
        if llm_client is not None:
            try:
                app.state.graph_service = GraphService(llm_client, repo, cache)
            except LLMUnavailableError as e:
                # 构造期 LLM 整体不可用 — 不 crash,留给路由层
                app.state.graph_service = None
                app.state.startup_error = str(e) or "LLM 不可用"
            except Exception as e:
                app.state.graph_service = None
                app.state.startup_error = f"GraphService init failed: {e}"
        else:
            app.state.graph_service = None
    except Exception as e:
        # 兜底:任何未被分类的异常(配置损坏 / DB 路径错 / import 错)
        # 都不应让进程 crash,记到 startup_error
        app.state.graph_service = None
        app.state.startup_error = f"lifespan init failed: {e}"
    yield


def create_app() -> FastAPI:
    """工厂函数:测试 / 多 app 实例用。"""
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

    return app


app = create_app()
