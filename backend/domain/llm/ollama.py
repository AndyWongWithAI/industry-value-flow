from domain.llm.openai_compatible import OpenAICompatibleProvider


class OllamaProvider(OpenAICompatibleProvider):
    name = "ollama"

    def __init__(
        self,
        base_url: str = "http://localhost:11434/v1",
        api_key: str = "ollama",
        default_model: str = "llama3",
        timeout: float = 120.0,
    ):
        super().__init__(
            base_url=base_url,
            api_key=api_key,
            default_model=default_model,
            timeout=timeout,
        )