"""Runtime configuration, read once from the environment.

Server-only secrets (Supabase secret key, worker token, Sarvam key) never
leave this process. The browser and the phone app only ever see the
publishable Supabase key.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _load_dotenv() -> None:
    """Load ../.env for local development. Vercel injects env vars directly."""
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.normpath(os.path.join(here, "..", "..", ".env"))
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    supabase_url: str = os.environ.get("SUPABASE_URL", "https://gpkyzastnibffyuxhtix.supabase.co").rstrip("/")
    supabase_publishable_key: str = os.environ.get(
        "SUPABASE_PUBLISHABLE_KEY", "sb_publishable_hgwNVlzldW1gRkb1kSu6Ug_0SyUIK84"
    )
    supabase_secret_key: str = os.environ.get("SUPABASE_SECRET_KEY", "")
    worker_token: str = os.environ.get("BHARATSIM_WORKER_TOKEN", "")
    sarvam_api_key: str = os.environ.get("SARVAM_API_KEY", "")
    sarvam_chat_model: str = os.environ.get("SARVAM_CHAT_MODEL", "sarvam-105b")
    allowed_origins: list[str] = field(
        default_factory=lambda: _csv(
            os.environ.get(
                "BHARATSIM_ALLOWED_ORIGINS",
                "http://localhost:8081,http://localhost:19006",
            )
        )
    )
    max_apk_bytes: int = 50 * 1024 * 1024


settings = Settings()
