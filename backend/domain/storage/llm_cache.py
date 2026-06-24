import json
import sqlite3
import time
from pathlib import Path


class LLMCache:
    def __init__(self, db_path: str):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS llm_cache (
                    key TEXT PRIMARY KEY,
                    prompt TEXT NOT NULL,
                    response TEXT NOT NULL,
                    generated_at REAL NOT NULL,
                    expires_at REAL NOT NULL
                )
            """)
            conn.commit()

    def get(self, key: str) -> dict | None:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT prompt, response, expires_at FROM llm_cache WHERE key = ?", (key,)
            ).fetchone()
        if row is None:
            return None
        prompt, response_json, expires_at = row
        if time.time() > expires_at:
            return None
        return {"prompt": prompt, "response": json.loads(response_json)}

    def set(self, key: str, prompt: str, response: dict, ttl_seconds: int = 30 * 24 * 3600):
        now = time.time()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO llm_cache (key, prompt, response, generated_at, expires_at) VALUES (?, ?, ?, ?, ?)",
                (key, prompt, json.dumps(response, ensure_ascii=False), now, now + ttl_seconds),
            )
            conn.commit()