import json
import os
from pathlib import Path
from schema.settings import Settings, LLMProviderConfig

CONFIG_DIR = Path(os.environ.get("IVF_CONFIG_DIR", Path.home() / ".config" / "industry-value-flow"))
CONFIG_FILE = CONFIG_DIR / "settings.json"
DB_DIR = CONFIG_DIR / "db"

def default_settings() -> Settings:
    return Settings(
        active_provider="claude",
        providers={},
        daily_token_budget=100_000,
    )

def get_settings() -> Settings:
    if not CONFIG_FILE.exists():
        return default_settings()
    return Settings.model_validate_json(CONFIG_FILE.read_text(encoding="utf-8"))

def save_settings(s: Settings):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(s.model_dump_json(indent=2), encoding="utf-8")
    os.chmod(CONFIG_FILE, 0o600)

def get_db_path() -> str:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    return str(DB_DIR / "cache.db")
