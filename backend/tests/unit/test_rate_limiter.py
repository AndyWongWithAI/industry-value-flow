import time
from domain.rate_limiter import RateLimiter

def test_allows_under_limit():
    rl = RateLimiter(max_per_minute=3)
    assert rl.check() is True
    assert rl.check() is True
    assert rl.check() is True
    assert rl.check() is False