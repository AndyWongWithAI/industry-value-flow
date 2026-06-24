from typing import Literal
from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high"]

class PainPoint(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=1000)
    severity: Severity