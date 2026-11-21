"""Run the API locally with variables from the repo-root .env (never committed)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
env_file = ROOT / ".env"
if env_file.exists():
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())
os.environ.setdefault("BHARATSIM_AUTH_REQUIRED", "true")
os.environ.setdefault("BHARATSIM_ENV", "development")
os.environ.setdefault("BHARATSIM_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
sys.path.insert(0, str(ROOT / "backend"))

import uvicorn  # noqa: E402

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), reload=False)
