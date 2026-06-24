from pydantic import BaseModel, field_validator

VALID_INDUSTRY_IDS = {
    "agriculture", "manufacturing", "finance", "education", "healthcare"
}

class Industry(BaseModel):
    id: str
    name: str
    color: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        if v not in VALID_INDUSTRY_IDS:
            raise ValueError(f"industry id must be one of {VALID_INDUSTRY_IDS}, got {v!r}")
        return v
