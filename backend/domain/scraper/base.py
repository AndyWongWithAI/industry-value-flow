from typing import Protocol
from schema.sankey import SankeyData


class ScraperProtocol(Protocol):
    async def fetch(self, industry_id: str) -> SankeyData: ...
    async def fetch_all(self) -> SankeyData: ...