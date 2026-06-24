from fastapi import APIRouter
from config import get_settings, save_settings
from schema.settings import Settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/llm", response_model=Settings)
async def get_llm_settings():
    return get_settings()


@router.post("/llm")
async def post_llm_settings(s: Settings):
    save_settings(s)
    return {"ok": True}