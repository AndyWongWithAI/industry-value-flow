from fastapi import APIRouter

router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.post("/generate")
async def generate():
    return {"status": "not_implemented"}