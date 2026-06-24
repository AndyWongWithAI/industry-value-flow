from domain.llm.openai_compatible import OpenAICompatibleProvider


class DeepSeekProvider(OpenAICompatibleProvider):
    name = "deepseek"

    def __init__(
        self,
        api_key: str,
        default_model: str = "deepseek-chat",
        timeout: float = 60.0,
    ):
        super().__init__(
            base_url="https://api.deepseek.com/v1",
            api_key=api_key,
            default_model=default_model,
            timeout=timeout,
        )