import pytest
from pydantic import ValidationError
from schema.industry import Industry, VALID_INDUSTRY_IDS

def test_valid_industry():
    ind = Industry(id="agriculture", name="农业", color="#4a90e2")
    assert ind.id == "agriculture"

def test_invalid_industry_id_rejected():
    with pytest.raises(ValidationError):
        Industry(id="unknown", name="未知", color="#fff")

def test_valid_ids_constant():
    assert VALID_INDUSTRY_IDS == {
        "agriculture", "manufacturing", "finance", "education", "healthcare"
    }
