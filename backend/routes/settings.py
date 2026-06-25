from fastapi import APIRouter, HTTPException, Request
from config import get_settings, save_settings
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
    """
    # 1. 写盘
    save_settings(s)

    # 2. 同步更新内存中 GraphService.llm
    graph_service = getattr(request.app.state, "graph_service", None)
    if graph_service is None:
        # 后端 lifespan 时 LLM 未配置(无 graph_service) — settings 已保存,
        # 等下次启动生效。返回 ok,前端无感。
        return {"ok": True, "note": "settings saved; restart backend to activate"}

    active_cfg = s.providers.get(s.active_provider) if s.providers else None
    if active_cfg is None or not active_cfg.api_key:
        # 用户清空了 active provider 的 api_key — 把 graph_service.llm 置空,
        # 路由层会返回 503 + EmptyState。
        graph_service.llm = None
        request.app.state.startup_error = (
            "LLM 未配置: 请在设置页填写 active_provider 的 api_key"
        )
        return {"ok": True, "note": "LLM cleared; routes will return 503"}

    try:
        new_client = LLMProviderRegistry().create(s.active_provider, active_cfg)
    except Exception as e:
        # 新 client 创建失败(协议不识别等) — 保留旧 client,返回错误。
        # 用户改坏了 settings,但旧 client 仍可用,前端可继续用旧 provider。
        raise HTTPException(
            status_code=400,
            detail=f"failed to create LLM client for {s.active_provider}: {e}",
        )

    graph_service.llm = new_client
    # 清空 startup_error(因为我们刚成功构造了 client)
    request.app.state.startup_error = None
    return {"ok": True, "active_provider": s.active_provider, "active_model": active_cfg.model}
