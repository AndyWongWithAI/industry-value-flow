import hashlib
import json
import re

from fastapi import APIRouter, HTTPException
from httpx import AsyncClient
from pydantic import BaseModel

from config import get_db_path, get_settings
from domain.llm.registry import LLMProviderRegistry
from domain.llm_coalescer import LLMCoalescer
from domain.prompt_builder import build_pain_point_prompt
from domain.rate_limiter import RateLimiter
from domain.scraper.stats_gov import StatsGovScraper
from domain.storage.cache import Cache
from domain.storage.llm_cache import LLMCache
from domain.token_budget import TokenBudget
from schema.industry import VALID_INDUSTRY_IDS

router = APIRouter(prefix="/api/llm", tags=["llm"])
_registry = LLMProviderRegistry()
_coalescer = LLMCoalescer()
_rate_limiter = RateLimiter(max_per_minute=10)
_budget = TokenBudget()
_llm_cache = LLMCache(get_db_path())
_scrape_cache = Cache(get_db_path())


class GenerateRequest(BaseModel):
    industry_id: str
    force_refresh: bool = False


class PainPointOut(BaseModel):
    title: str
    description: str
    severity: str


class AIHelpOut(BaseModel):
    use_case: str
    capability: str
    example: str
    roi_estimate: str


class GenerateResponse(BaseModel):
    pain_points: list[PainPointOut]
    ai_helps: list[AIHelpOut]
    status: str
    provider: str


def _parse_json_response(text: str) -> dict:
    """解析 LLM 返回文本中的 JSON。 优先直接解析,然后 ```json``` 块,最后首个 { ... }。"""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    m = re.search(r"(\{.*\})", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    raise ValueError("LLM response is not valid JSON")


@router.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    if req.industry_id not in VALID_INDUSTRY_IDS:
        raise HTTPException(400, f"unknown industry: {req.industry_id}")
    if not _rate_limiter.check():
        raise HTTPException(429, "rate limit exceeded")
    if not _budget.consume(2000):
        raise HTTPException(429, "daily token budget exceeded")

    settings = get_settings()
    active = settings.active_provider
    provider_cfg = settings.providers[active]
    provider = _registry.create(active, provider_cfg)

    # Cache key 包含 provider + model → 切换 provider 后自然失效
    cache_key = hashlib.sha256(
        f"{req.industry_id}:{provider.name}:{provider_cfg.model}".encode()
    ).hexdigest()

    if not req.force_refresh:
        cached = _llm_cache.get(cache_key)
        if cached:
            data = cached["response"]
            return GenerateResponse(**data, status="ok", provider=provider.name)

    # 抓取行业数据
    async with AsyncClient() as client:
        scraper = StatsGovScraper(client)
        data = await scraper.fetch(req.industry_id)
    subsectors = [n.label for n in data.nodes]
    flow_summary = ", ".join(
        f"{e.source}->{e.target}:{e.value}" for e in data.edges
    )
    industry = data.industries[0]
    prompt = build_pain_point_prompt(industry, subsectors, flow_summary)

    try:
        async def _gen():
            return await provider.generate(prompt)

        text = await _coalescer.get_or_create(cache_key, _gen)
        parsed = _parse_json_response(text)
    except Exception:
        return GenerateResponse(
            pain_points=[],
            ai_helps=[],
            status="degraded",
            provider=provider.name,
        )

    result = {
        "pain_points": parsed.get("pain_points", []),
        "ai_helps": parsed.get("ai_helps", []),
    }
    _llm_cache.set(cache_key, prompt, result)
    return GenerateResponse(**result, status="ok", provider=provider.name)
