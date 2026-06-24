from domain.token_budget import TokenBudget


def test_consume_under_limit():
    b = TokenBudget(daily_limit=100)
    assert b.consume(50) is True
    assert b.remaining() == 50


def test_consume_over_limit():
    b = TokenBudget(daily_limit=100)
    b.consume(80)
    assert b.consume(30) is False
    assert b.remaining() == 20