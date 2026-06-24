from pydantic import BaseModel, Field

class AIHelp(BaseModel):
    use_case: str = Field(min_length=1, max_length=100)
    capability: str = Field(min_length=1, max_length=200)
    example: str = Field(min_length=1, max_length=500)
    roi_estimate: str = Field(min_length=1, max_length=200)