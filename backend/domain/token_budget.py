class TokenBudget:
    def __init__(self, daily_limit: int = 100_000):
        self.daily_limit = daily_limit
        self.used = 0

    def consume(self, tokens: int) -> bool:
        if self.used + tokens > self.daily_limit:
            return False
        self.used += tokens
        return True

    def remaining(self) -> int:
        return self.daily_limit - self.used