"""FastAPI 入口.

T1 后:lifespan 不再清 v1 cache(SankeyData 已删除,不再需要).
T3 会加 GraphService.ensure_graph() 在 lifespan 启动时初始化知识图谱.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.industries import router as industries_router
from routes.industry import router as industry_router
from routes.llm import router as llm_router
from routes.settings import router as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # T1: 启动钩子空,等 T3 加 GraphService.ensure_graph()
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