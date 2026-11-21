"""BharatSim API (FastAPI on Vercel).

User routes forward the caller's Supabase JWT so row-level security decides
access. Worker routes require the worker token and use the server-only key.
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, field_validator

try:  # Vercel runs this file as a module inside /api
    from ._lib import sarvam, supa
    from ._lib.config import settings
    from ._lib.deps import Caller, client_ip, current_user, general_limiter, require_worker, sarvam_limiter
    from ._lib.report import build_facts, fallback_explanation, speech_text
except ImportError:  # loaded as a top-level module (Vercel runtime or uvicorn --app-dir api)
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from _lib import sarvam, supa  # type: ignore
    from _lib.config import settings  # type: ignore
    from _lib.deps import Caller, client_ip, current_user, general_limiter, require_worker, sarvam_limiter  # type: ignore
    from _lib.report import build_facts, fallback_explanation, speech_text  # type: ignore

app = FastAPI(title="BharatSim API", version="2.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=r"https://bharat-sim[a-z0-9-]*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if request.method != "OPTIONS":
        try:
            general_limiter.check(client_ip(request))
        except HTTPException as exc:
            return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.exception_handler(supa.SupabaseError)
async def supabase_error(_: Request, exc: supa.SupabaseError):
    status = exc.status if exc.status in (400, 401, 403, 404, 409, 422, 429, 503) else 502
    message = exc.message
    if exc.code == "P0001":  # raised by our quota trigger, safe to show
        status = 429
    elif exc.code in ("42501",) or status == 403:
        message = "You do not have access to that"
    elif status >= 500 or exc.code:
        message = message if exc.code == "23514" else "The database rejected the request"
    return JSONResponse({"detail": message}, status_code=status)


@app.exception_handler(sarvam.SarvamError)
async def sarvam_error(_: Request, exc: sarvam.SarvamError):
    return JSONResponse({"detail": str(exc)}, status_code=502)


UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def check_uuid(value: str) -> str:
    if not UUID_RE.match(value):
        raise HTTPException(status_code=404, detail="Not found")
    return value


async def profile_catalogue() -> dict[str, dict]:
    rows = await supa.service().select("test_profiles", {"select": "*", "order": "sort_order"})
    return {row["key"]: row for row in rows}


# ---------------------------------------------------------------- health

@app.get("/api/health")
async def health() -> dict[str, Any]:
    database = "unavailable"
    worker_online = False
    try:
        rows = await supa.service().select("workers", {"select": "id,last_seen", "order": "last_seen.desc", "limit": "1"})
        database = "ok"
        if rows:
            seen = datetime.fromisoformat(rows[0]["last_seen"].replace("Z", "+00:00"))
            worker_online = datetime.now(timezone.utc) - seen < timedelta(seconds=90)
    except supa.SupabaseError:
        pass
    return {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
        "worker_online": worker_online,
        "sarvam": bool(settings.sarvam_api_key),
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/profiles")
async def list_profiles(caller: Caller = Depends(current_user)) -> list[dict[str, Any]]:
    return await supa.as_user(caller.token).select("test_profiles", {"select": "*", "order": "sort_order"})


_SPEED_PAYLOAD = os.urandom(512 * 1024)  # incompressible, generated once per instance


@app.get("/api/speedtest")
async def speedtest() -> Response:
    """512 KB of random bytes for the phone's real download measurement."""
    return Response(content=_SPEED_PAYLOAD, media_type="application/octet-stream", headers={"Cache-Control": "no-store"})


@app.get("/api/languages")
async def list_languages() -> list[dict[str, str]]:
    return [{"code": code, "name": name} for code, name in sarvam.LANGUAGES.items()]


# ---------------------------------------------------------------- apps

class AppIn(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    storage_path: str = Field(min_length=10, max_length=400)
    package_name: str | None = Field(default=None, max_length=255)
    version_name: str | None = Field(default=None, max_length=80)
    source: Literal["upload", "device"] = "upload"

    @field_validator("storage_path")
    @classmethod
    def safe_path(cls, value: str) -> str:
        if ".." in value or value.startswith("/") or not re.match(r"^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,200}$", value):
            raise ValueError("Invalid storage path")
        return value

    @field_validator("package_name")
    @classmethod
    def safe_package(cls, value: str | None) -> str | None:
        if value and not re.match(r"^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$", value):
            raise ValueError("Invalid package name")
        return value


@app.get("/api/apps")
async def list_apps(caller: Caller = Depends(current_user)) -> list[dict[str, Any]]:
    return await supa.as_user(caller.token).select("apps", {"select": "*", "order": "created_at.desc", "limit": "100"})


@app.post("/api/apps", status_code=201)
async def register_app(body: AppIn, caller: Caller = Depends(current_user)) -> dict[str, Any]:
    if not body.storage_path.startswith(f"{caller.user_id}/"):
        raise HTTPException(status_code=403, detail="You can only register your own uploads")
    info = await supa.storage_object_info("apks", body.storage_path)
    if not info:
        raise HTTPException(status_code=400, detail="Upload not found. Upload the APK again")
    size = int(info.get("size") or (info.get("metadata") or {}).get("size") or 0)
    if size <= 0 or size > settings.max_apk_bytes:
        raise HTTPException(status_code=400, detail="APK must be between 1 byte and 50 MB")
    rows = await supa.as_user(caller.token).insert(
        "apps",
        {
            "label": body.label.strip(),
            "storage_path": body.storage_path,
            "size_bytes": size,
            "package_name": body.package_name,
            "version_name": body.version_name,
            "source": body.source,
        },
    )
    return rows[0]


class SampleIn(BaseModel):
    key: Literal["fragile_news", "steady_notes"]


SAMPLES = {
    "fragile_news": {"label": "Fragile News (sample)", "path": "samples/fragile-news.apk", "package": "in.bharatsim.fragile"},
    "steady_notes": {"label": "Steady Notes (sample)", "path": "samples/steady-notes.apk", "package": "in.bharatsim.steady"},
}


@app.post("/api/apps/sample", status_code=201)
async def add_sample(body: SampleIn, caller: Caller = Depends(current_user)) -> dict[str, Any]:
    sample = SAMPLES[body.key]
    info = await supa.storage_object_info("apks", sample["path"])
    if not info:
        raise HTTPException(status_code=503, detail="Sample APKs are not uploaded yet")
    size = int(info.get("size") or (info.get("metadata") or {}).get("size") or 1)
    rows = await supa.as_user(caller.token).insert(
        "apps",
        {"label": sample["label"], "storage_path": sample["path"], "size_bytes": size, "package_name": sample["package"], "source": "sample"},
    )
    return rows[0]


@app.delete("/api/apps/{app_id}")
async def delete_app(app_id: str, caller: Caller = Depends(current_user)) -> dict[str, str]:
    check_uuid(app_id)
    rows = await supa.as_user(caller.token).delete("apps", {"id": f"eq.{app_id}"})
    if not rows:
        raise HTTPException(status_code=404, detail="Not found")
    path = rows[0]["storage_path"]
    if path.startswith(f"{caller.user_id}/"):
        await supa.storage_remove("apks", [path])
    return {"status": "deleted"}


# ---------------------------------------------------------------- device profiles

class DeviceIn(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    manufacturer: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=80)
    android_version: str | None = Field(default=None, max_length=20)
    sdk_int: int | None = Field(default=None, ge=1, le=100)
    total_ram_mb: int | None = Field(default=None, ge=1, le=65536)
    screen_width: int | None = Field(default=None, ge=1, le=10000)
    screen_height: int | None = Field(default=None, ge=1, le=10000)
    network_type: str | None = Field(default=None, max_length=20)
    measured_down_kbps: int | None = Field(default=None, ge=0, le=10_000_000)
    measured_rtt_ms: int | None = Field(default=None, ge=0, le=60000)


@app.get("/api/devices")
async def list_devices(caller: Caller = Depends(current_user)) -> list[dict[str, Any]]:
    return await supa.as_user(caller.token).select("device_profiles", {"select": "*", "order": "created_at.desc", "limit": "50"})


@app.post("/api/devices", status_code=201)
async def add_device(body: DeviceIn, caller: Caller = Depends(current_user)) -> dict[str, Any]:
    rows = await supa.as_user(caller.token).insert("device_profiles", body.model_dump())
    return rows[0]


@app.delete("/api/devices/{device_id}")
async def delete_device(device_id: str, caller: Caller = Depends(current_user)) -> dict[str, str]:
    check_uuid(device_id)
    rows = await supa.as_user(caller.token).delete("device_profiles", {"id": f"eq.{device_id}"})
    if not rows:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------- runs

class RunIn(BaseModel):
    app_id: str
    profiles: list[str] = Field(min_length=1, max_length=8)
    device_profile_id: str | None = None

    @field_validator("app_id", "device_profile_id")
    @classmethod
    def is_uuid(cls, value: str | None) -> str | None:
        if value is not None and not UUID_RE.match(value):
            raise ValueError("Invalid id")
        return value

    @field_validator("profiles")
    @classmethod
    def known_shape(cls, value: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(v for v in value if re.match(r"^[a-z0-9_]{2,40}$", v)))
        if not cleaned:
            raise ValueError("Pick at least one profile")
        if "baseline" not in cleaned:
            cleaned.insert(0, "baseline")
        return cleaned[:8]


RUN_FIELDS = "id,app_id,device_profile_id,profiles,status,stage,started_at,finished_at,error,readiness_score,summary,created_at,apps(label,package_name,version_name,source)"


@app.get("/api/runs")
async def list_runs(caller: Caller = Depends(current_user)) -> list[dict[str, Any]]:
    return await supa.as_user(caller.token).select("runs", {"select": RUN_FIELDS, "order": "created_at.desc", "limit": "100"})


@app.post("/api/runs", status_code=201)
async def create_run(body: RunIn, caller: Caller = Depends(current_user)) -> dict[str, Any]:
    rows = await supa.as_user(caller.token).insert("runs", body.model_dump())
    return rows[0]


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str, caller: Caller = Depends(current_user)) -> dict[str, Any]:
    check_uuid(run_id)
    db = supa.as_user(caller.token)
    runs = await db.select("runs", {"select": RUN_FIELDS + ",device_profiles(*)", "id": f"eq.{run_id}"})
    if not runs:
        raise HTTPException(status_code=404, detail="Not found")
    results = await db.select("run_results", {"select": "*", "run_id": f"eq.{run_id}"})
    translations = await db.select("report_translations", {"select": "language,content,audio_path,created_at", "run_id": f"eq.{run_id}"})
    return {**runs[0], "results": results, "translations": translations}


@app.delete("/api/runs/{run_id}")
async def delete_run(run_id: str, caller: Caller = Depends(current_user)) -> dict[str, str]:
    check_uuid(run_id)
    rows = await supa.as_user(caller.token).delete("runs", {"id": f"eq.{run_id}"})
    if not rows:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "deleted"}


async def _owned_run(run_id: str, caller: Caller) -> dict[str, Any]:
    check_uuid(run_id)
    runs = await supa.as_user(caller.token).select("runs", {"select": "*,apps(*)", "id": f"eq.{run_id}"})
    if not runs:
        raise HTTPException(status_code=404, detail="Not found")
    return runs[0]


@app.post("/api/runs/{run_id}/cancel")
async def cancel_run(run_id: str, caller: Caller = Depends(current_user)) -> dict[str, str]:
    run = await _owned_run(run_id, caller)
    if run["status"] not in ("queued", "running"):
        raise HTTPException(status_code=409, detail="This run has already finished")
    await supa.service().update(
        "runs", {"id": f"eq.{run_id}", "owner_id": f"eq.{caller.user_id}"},
        {"status": "cancelled", "finished_at": datetime.now(timezone.utc).isoformat(), "stage": "cancelled"},
    )
    return {"status": "cancelled"}


# ---------------------------------------------------------------- report (Sarvam)

async def _english_explanation(run: dict[str, Any], caller: Caller) -> dict[str, Any]:
    db = supa.as_user(caller.token)
    cached = await db.select("report_translations", {"select": "content", "run_id": f"eq.{run['id']}", "language": "eq.en-IN"})
    if cached:
        return cached[0]["content"]
    results = await db.select("run_results", {"select": "*", "run_id": f"eq.{run['id']}"})
    catalogue = await profile_catalogue()
    try:
        explanation = await sarvam.explain(build_facts(run, run["apps"], results, catalogue))
        explanation["generated_by"] = "sarvam"
    except sarvam.SarvamError:
        explanation = fallback_explanation(run, results, catalogue)
    await supa.service().insert(
        "report_translations",
        {"run_id": run["id"], "owner_id": caller.user_id, "language": "en-IN", "content": explanation},
        upsert="run_id,language",
    )
    return explanation


@app.post("/api/runs/{run_id}/explain")
async def explain_run(run_id: str, request: Request, caller: Caller = Depends(current_user)) -> dict[str, Any]:
    sarvam_limiter.check(caller.user_id)
    run = await _owned_run(run_id, caller)
    if run["status"] != "completed":
        raise HTTPException(status_code=409, detail="The report is ready once the run completes")
    return await _english_explanation(run, caller)


class TranslateIn(BaseModel):
    language: str

    @field_validator("language")
    @classmethod
    def supported(cls, value: str) -> str:
        if value not in sarvam.LANGUAGES:
            raise ValueError("Unsupported language")
        return value


@app.post("/api/runs/{run_id}/translate")
async def translate_run(run_id: str, body: TranslateIn, caller: Caller = Depends(current_user)) -> dict[str, Any]:
    sarvam_limiter.check(caller.user_id)
    run = await _owned_run(run_id, caller)
    if run["status"] != "completed":
        raise HTTPException(status_code=409, detail="The report is ready once the run completes")
    db = supa.as_user(caller.token)
    cached = await db.select("report_translations", {"select": "content,audio_path", "run_id": f"eq.{run_id}", "language": f"eq.{body.language}"})
    if cached:
        return {"language": body.language, **cached[0]["content"], "has_audio": bool(cached[0]["audio_path"])}
    english = await _english_explanation(run, caller)
    translated = {
        "verdict": await sarvam.translate(english["verdict"], body.language),
        "issues": [
            {"issue": await sarvam.translate(i["issue"], body.language), "fix": await sarvam.translate(i["fix"], body.language) if i.get("fix") else ""}
            for i in english.get("issues", [])
        ],
    }
    await supa.service().insert(
        "report_translations",
        {"run_id": run_id, "owner_id": caller.user_id, "language": body.language, "content": translated},
        upsert="run_id,language",
    )
    return {"language": body.language, **translated, "has_audio": False}


@app.post("/api/runs/{run_id}/speech")
async def speech_run(run_id: str, body: TranslateIn, caller: Caller = Depends(current_user)) -> dict[str, Any]:
    sarvam_limiter.check(caller.user_id)
    await _owned_run(run_id, caller)
    db = supa.as_user(caller.token)
    rows = await db.select("report_translations", {"select": "content,audio_path", "run_id": f"eq.{run_id}", "language": f"eq.{body.language}"})
    if not rows:
        raise HTTPException(status_code=409, detail="Translate the report first")
    path = rows[0]["audio_path"]
    if not path:
        audio = await sarvam.speak(speech_text(rows[0]["content"]), body.language)
        path = f"{caller.user_id}/{run_id}-{body.language}.wav"
        await supa.storage_upload("audio", path, audio, "audio/wav")
        await supa.service().update(
            "report_translations", {"run_id": f"eq.{run_id}", "language": f"eq.{body.language}"}, {"audio_path": path}
        )
    return {"url": await supa.storage_sign("audio", path, 600)}


# ---------------------------------------------------------------- worker (laptop)

class HeartbeatIn(BaseModel):
    worker_id: str = Field(min_length=1, max_length=80)
    info: dict[str, Any] = Field(default_factory=dict)


@app.post("/api/worker/heartbeat", dependencies=[Depends(require_worker)])
async def worker_heartbeat(body: HeartbeatIn) -> dict[str, str]:
    await supa.service().insert(
        "workers", {"id": body.worker_id, "last_seen": datetime.now(timezone.utc).isoformat(), "info": body.info}, upsert="id"
    )
    return {"status": "ok"}


@app.post("/api/worker/claim", dependencies=[Depends(require_worker)])
async def worker_claim(body: HeartbeatIn) -> dict[str, Any]:
    await worker_heartbeat(body)
    claimed = await supa.service().rpc("claim_next_run", {"p_worker_id": body.worker_id, "p_lease_seconds": 900})
    if not claimed:
        return {"run": None}
    run = claimed[0]
    db = supa.service()
    app_rows = await db.select("apps", {"select": "*", "id": f"eq.{run['app_id']}"})
    if not app_rows:
        await db.update("runs", {"id": f"eq.{run['id']}"}, {"status": "failed", "error": "App was deleted", "finished_at": datetime.now(timezone.utc).isoformat()})
        return {"run": None}
    catalogue = await profile_catalogue()
    device = None
    if run.get("device_profile_id"):
        rows = await db.select("device_profiles", {"select": "*", "id": f"eq.{run['device_profile_id']}"})
        device = rows[0] if rows else None
    return {
        "run": run,
        "app": app_rows[0],
        "download_url": await supa.storage_sign("apks", app_rows[0]["storage_path"], 900),
        "profiles": [catalogue[key] for key in run["profiles"] if key in catalogue],
        "device_profile": device,
    }


class ProgressIn(BaseModel):
    worker_id: str
    stage: str = Field(max_length=120)


@app.post("/api/worker/runs/{run_id}/progress", dependencies=[Depends(require_worker)])
async def worker_progress(run_id: str, body: ProgressIn) -> dict[str, str]:
    check_uuid(run_id)
    rows = await supa.service().update(
        "runs",
        {"id": f"eq.{run_id}", "worker_id": f"eq.{body.worker_id}", "status": "eq.running"},
        {"stage": body.stage, "lease_expires_at": (datetime.now(timezone.utc) + timedelta(seconds=900)).isoformat()},
    )
    if not rows:
        return {"status": "stop"}  # cancelled or reassigned
    return {"status": "ok"}


class ResultItem(BaseModel):
    profile_key: str
    verdict: Literal["pass", "warn", "fail", "error"]
    metrics: dict[str, Any] = Field(default_factory=dict)
    findings: list[dict[str, Any]] = Field(default_factory=list, max_length=50)
    logcat_excerpt: str | None = Field(default=None, max_length=20000)


class ResultIn(BaseModel):
    worker_id: str
    status: Literal["completed", "failed"]
    error: str | None = Field(default=None, max_length=1000)
    readiness_score: int | None = Field(default=None, ge=0, le=100)
    summary: dict[str, Any] = Field(default_factory=dict)
    package_name: str | None = None
    version_name: str | None = None
    results: list[ResultItem] = Field(default_factory=list, max_length=8)


@app.post("/api/worker/runs/{run_id}/result", dependencies=[Depends(require_worker)])
async def worker_result(run_id: str, body: ResultIn) -> dict[str, str]:
    check_uuid(run_id)
    db = supa.service()
    runs = await db.select("runs", {"select": "id,owner_id,app_id,status,worker_id", "id": f"eq.{run_id}"})
    if not runs or runs[0]["worker_id"] != body.worker_id or runs[0]["status"] != "running":
        raise HTTPException(status_code=409, detail="Run is not assigned to this worker")
    run = runs[0]
    if body.results:
        await db.insert(
            "run_results",
            [{**item.model_dump(), "run_id": run_id, "owner_id": run["owner_id"]} for item in body.results],
            upsert="run_id,profile_key",
        )
    await db.update(
        "runs",
        {"id": f"eq.{run_id}"},
        {
            "status": body.status,
            "error": body.error,
            "readiness_score": body.readiness_score,
            "summary": body.summary,
            "stage": "done" if body.status == "completed" else "failed",
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "lease_expires_at": None,
        },
    )
    if body.package_name:
        await db.update(
            "apps", {"id": f"eq.{run['app_id']}"},
            {"package_name": body.package_name, "version_name": body.version_name},
        )
    return {"status": "saved"}
