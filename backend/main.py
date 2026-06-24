import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.industries import router as industries_router
from routes.industry import router as industry_router
from routes.llm import router as llm_router
from routes.settings import router as settings_router
from domain.storage.cache import Cache
from config import get_db_path

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时清旧 v1 cache(spec §6.1 + 用户决策 B-5)
    cache = Cache(get_db_path())
    deleted = cache.delete_prefix(":v1")
    if deleted > 0:
        logger.info("cleared %d v1 cache entries on startup", deleted)
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


@app.get("/health")
def health():
    return {"status": "ok"}
