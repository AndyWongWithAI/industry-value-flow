from domain.llm.openai_compatible import OpenAICompatibleProvider


class OpenAIProvider(OpenAICompatibleProvider):
    name = "openai"

    def __init__(self, api_key: str, default_model: str = "gpt-4o", timeout: float = 60.0):
        super().__init__(
            base_url="https://api.openai.com/v1",
            api_key=api_key,
            default_model=default_model,
            timeout=timeout,
        )
