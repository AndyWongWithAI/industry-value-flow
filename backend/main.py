from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.industries import router as industries_router
from routes.industry import router as industry_router
from routes.llm import router as llm_router
from routes.settings import router as settings_router

app = FastAPI(title="行业价值流转平台", version="0.1.0")

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
