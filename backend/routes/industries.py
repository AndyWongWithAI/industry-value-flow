from fastapi import APIRouter
from httpx import AsyncClient
from domain.scraper.stats_gov import StatsGovScraper
from domain.scraper.industry_association import IndustryAssociationScraper
from domain.storage.cache import Cache
from config import get_db_path
from schema.sankey import SankeyData

router = APIRouter(prefix="/api", tags=["industries"])
_cache = Cache(get_db_path())

YEAR = 2024  # 本 spec 数据基准


@router.get("/industries", response_model=SankeyData)
async def get_industries():
    key = f"stats_gov:industries:{YEAR}:v2"
    cached = _cache.get(key)
    if cached:
        return cached
    async with AsyncClient() as client:
        try:
            scraper = StatsGovScraper(client)
            data = await scraper.fetch_all()
        except Exception:
            async with AsyncClient() as client2:
                scraper = IndustryAssociationScraper(client2)
                data = await scraper.fetch_all()
    _cache.set(key, data.model_dump())
    return data
