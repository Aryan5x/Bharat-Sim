"""Run the emulator worker against a local or deployed API using the repo-root .env.

    python scripts/dev_worker.py                 # local API at http://127.0.0.1:8000
    BHARATSIM_API_URL=https://... python scripts/dev_worker.py
"""
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
os.environ.setdefault("BHARATSIM_API_URL", "http://127.0.0.1:8000")
if os.environ["BHARATSIM_API_URL"].startswith("http://127.0.0.1") or os.environ["BHARATSIM_API_URL"].startswith("http://localhost"):
    os.environ.setdefault("BHARATSIM_ALLOW_INSECURE_HTTP", "true")
os.environ.setdefault("ANDROID_SERIAL", "emulator-5554")
os.environ.setdefault("BHARATSIM_ENABLE_LOCAL_APK_EXECUTION", "true")
os.environ.setdefault("BHARATSIM_WORKER_ID", "deccans-laptop-1")
sys.path.insert(0, str(ROOT))

from worker.agent import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
