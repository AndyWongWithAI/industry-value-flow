import asyncio
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")

class LLMCoalescer:
    def __init__(self):
        self._inflight: dict[str, asyncio.Task] = {}

    async def get_or_create(self, key: str, coro_factory: Callable[[], Awaitable[T]]) -> T:
        if key in self._inflight:
            return await self._inflight[key]
        task = asyncio.create_task(coro_factory())
        self._inflight[key] = task
        try:
            return await task
        finally:
            del self._inflight[key]
