import time
from collections import deque


class RateLimiter:
    def __init__(self, max_per_minute: int = 10):
        self.max = max_per_minute
        self.timestamps: deque[float] = deque()

    def check(self) -> bool:
        now = time.time()
        # 清理 60s 外的
        while self.timestamps and now - self.timestamps[0] > 60:
            self.timestamps.popleft()
        if len(self.timestamps) >= self.max:
            return False
        self.timestamps.append(now)
        return True