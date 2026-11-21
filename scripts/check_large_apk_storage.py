"""Round-trip a 60 MB object through BharatSim's multi-part storage helpers against real Supabase.

    python scripts/check_large_apk_storage.py

Uses the repo-root .env (never printed). Uploads two parts with signed URLs (as the browser does),
checks the summed size, streams the download back, compares SHA-256, then deletes every part.
"""
from __future__ import annotations

import hashlib
import os
import sys
import uuid
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
for raw in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())
os.environ.setdefault("BHARATSIM_ENV", "development")
sys.path.insert(0, str(ROOT / "backend"))

from app import main  # noqa: E402

size = 60 * 1024 * 1024
data = os.urandom(size)
digest = hashlib.sha256(data).hexdigest()
path = main.apk_parts_path(f"runs/{uuid.uuid4()}/input.apk", size)
objects = main.apk_part_objects(path)
print("storage path:", path, "| parts:", len(objects))
try:
    for i, obj in enumerate(objects):
        url = main.create_private_upload_url(obj)
        chunk = data[i * main.APK_PART_BYTES:(i + 1) * main.APK_PART_BYTES]
        req = Request(url, data=chunk, method="PUT", headers={"Content-Type": "application/vnd.android.package-archive"})
        with urlopen(req, timeout=300) as r:
            print(f"  part {i}: {len(chunk) // (1024 * 1024)} MB uploaded, HTTP {r.status}")
    total = main.private_object_size(path)
    print("summed size matches:", total == size)
    conn, resp = main.open_private_object(path)
    h = hashlib.sha256()
    got = 0
    while chunk := resp.read(1024 * 1024):
        h.update(chunk)
        got += len(chunk)
    resp.close()
    conn.close()
    print("download bytes match:", got == size, "| sha256 matches:", h.hexdigest() == digest)
finally:
    main.delete_private_object(path)
    print("after delete, size:", main.private_object_size(path))
