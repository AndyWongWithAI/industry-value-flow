import pytest
from pydantic import ValidationError
from schema.pain_point import PainPoint

def test_valid_pain_point():
    p = PainPoint(title="信息孤岛", description="数据未打通", severity="high")
    assert p.severity == "high"

@pytest.mark.parametrize("bad", ["critical", "low-ish", ""])
def test_invalid_severity_rejected(bad):
    with pytest.raises(ValidationError):
        PainPoint(title="t", description="d", severity=bad)