from fastapi import APIRouter

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/llm")
async def get_llm_settings():
    return {"status": "not_implemented"}