import json
import sqlite3
import time
from pathlib import Path


class Cache:
    def __init__(self, db_path: str):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS scrape_cache (
                    key TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    scraped_at REAL NOT NULL,
                    expires_at REAL NOT NULL
                )
            """)
            conn.commit()

    def get(self, key: str) -> dict | None:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT data, expires_at FROM scrape_cache WHERE key = ?", (key,)
            ).fetchone()
        if row is None:
            return None
        data_json, expires_at = row
        if time.time() > expires_at:
            self.delete(key)
            return None
        return json.loads(data_json)

    def set(self, key: str, data: dict, ttl_seconds: int = 7 * 24 * 3600):
        now = time.time()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO scrape_cache (key, data, scraped_at, expires_at) VALUES (?, ?, ?, ?)",
                (key, json.dumps(data, ensure_ascii=False), now, now + ttl_seconds),
            )
            conn.commit()

    def delete(self, key: str) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            cur = conn.execute("DELETE FROM scrape_cache WHERE key = ?", (key,))
            conn.commit()
        return cur.rowcount > 0
