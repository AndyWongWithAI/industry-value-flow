from fastapi import APIRouter, HTTPException, Request
from config import get_settings, get_db_path, save_settings
from domain.llm.registry import LLMProviderRegistry
from schema.settings import Settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/llm", response_model=Settings)
async def get_llm_settings():
    return get_settings()


@router.post("/llm")
async def post_llm_settings(s: Settings, request: Request) -> dict:
    """保存 settings 到磁盘,并同步更新内存中 GraphService 的 LLM client。

    关键:不更新内存的话,后续 LLM 调用仍打旧 provider(bug: 用户切 minimax
    仍然 403 from api.anthropic.com)。

    2026-06-26 修:lifespan 启动时 LLM 未配置 → graph_service 整个是 None
    (不是 llm=None)。之前会返"restart to activate",现在 lazy init。
    """
    # 1. 写盘
    save_settings(s)

    # 2. 拿 graph_service(lifespan 时 LLM 未配置的话整个是 None)
    graph_service = getattr(request.app.state, "graph_service", None)
    active_cfg = s.providers.get(s.active_provider) if s.providers else None

    # 3. 如果 graph_service 是 None,看用户有没有配置新 LLM,有就 lazy init 整个 service
    if graph_service is None:
        if active_cfg is None or not active_cfg.api_key:
            return {"ok": True, "note": "settings saved; no LLM configured"}

        # lazy init:建 registry / client / repo / cache / graph_service
        try:
            from domain.graph.graph_service import GraphService
            from domain.storage.cache import Cache
            from domain.storage.graph_repo import GraphRepo

            registry = LLMProviderRegistry()
            new_client = registry.create(s.active_provider, active_cfg)
            repo = GraphRepo(db_path=get_db_path())
            cache = Cache(db_path=get_db_path())
            request.app.state.graph_service = GraphService(new_client, repo, cache)
            request.app.state.startup_error = None
            return {
                "ok": True,
                "active_provider": s.active_provider,
                "active_model": active_cfg.model,
                "note": "graph_service initialized (was None before)",
            }
        except Exception as e:
            # lazy init 失败 — settings 已保存,等下次重启
            request.app.state.startup_error = f"lazy init failed: {e}"
            return {"ok": True, "note": f"settings saved; lazy init failed: {e}"}

    # 4. graph_service 存在(只是 .llm 可能 None)
    if active_cfg is None or not active_cfg.api_key:
        # 用户清空了 active provider 的 api_key
        graph_service.llm = None
        request.app.state.startup_error = (
            "LLM 未配置: 请在设置页填写 active_provider 的 api_key"
        )
        return {"ok": True, "note": "LLM cleared; routes will return 503"}

    try:
        new_client = LLMProviderRegistry().create(s.active_provider, active_cfg)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"failed to create LLM client for {s.active_provider}: {e}",
        )

    graph_service.llm = new_client
    request.app.state.startup_error = None
    return {"ok": True, "active_provider": s.active_provider, "active_model": active_cfg.model}
