"""Engine (baseline vs persona) reports flow through list, detail, export and compare."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager

from starlette.requests import Request

from app import main as main_module
from app.main import CompareRunsRequest


def engine_report(cold_ms: float, jank: float, pss: float, overall: int = 90) -> dict:
    leg = {
        "label": "Budget Android",
        "installed": True,
        "cold_start_ms_median": cold_ms,
        "frames": {"jank_percent": jank},
        "memory": {"pss_mb": pss},
        "signals": {"crashes": 0},
        "findings": [],
    }
    return {
        "status": "completed",
        "engine": "bharatsim-engine-2.0",
        "baseline": {**leg, "label": "Baseline"},
        "constrained": leg,
        "anomalies": [],
        "readiness": {"overall": overall, "status": "pass", "categories": {}},
    }


def make_db(rows):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute(
        "CREATE TABLE runs (id TEXT PRIMARY KEY, created_at TEXT, status TEXT, apk_name TEXT, apk_sha256 TEXT, "
        "persona_id TEXT, error TEXT, result_json TEXT, owner_id TEXT)"
    )
    connection.executemany(
        "INSERT INTO runs(id,created_at,status,apk_name,apk_sha256,persona_id,error,result_json,owner_id) VALUES(?,?,?,?,?,?,?,?,?)",
        rows,
    )
    return connection


def request_for(owner_id: str, path: str = "/api/v1/runs") -> Request:
    request = Request({"type": "http", "method": "GET", "path": path, "headers": []})
    request.state.owner_id = owner_id
    return request


def patch_db(monkeypatch, connection):
    @contextmanager
    def fake_db():
        yield connection

    monkeypatch.setattr(main_module, "db", fake_db)


def test_is_engine_report():
    assert main_module._is_engine_report(engine_report(900, 10, 90)) is True
    assert main_module._is_engine_report({"steps": []}) is False
    assert main_module._is_engine_report(None) is False


def test_compare_uses_persona_leg_of_engine_reports(monkeypatch):
    connection = make_db([
        ("a", "2026-11-21T10:00:00Z", "completed", "x.apk", "s", "budget-android", None,
         json.dumps(engine_report(900, 10.0, 90.0)), "owner-a"),
        ("b", "2026-11-21T11:00:00Z", "completed", "x.apk", "s", "edge-village", None,
         json.dumps(engine_report(2400, 40.0, 210.0)), "owner-a"),
    ])
    patch_db(monkeypatch, connection)
    result = main_module.compare_runs(
        CompareRunsRequest(baseline_run_id="a", constrained_run_id="b"),
        request_for("owner-a", "/api/v1/runs/compare"),
    )
    assert result["baseline_metrics"] == {"cold_start_ms": 900.0, "jank_percentage": 10.0, "peak_memory_mb": 90.0}
    assert result["constrained_metrics"] == {"cold_start_ms": 2400.0, "jank_percentage": 40.0, "peak_memory_mb": 210.0}
    assert result["anomaly_detected"] is True


def test_list_runs_carries_readiness_score_not_report(monkeypatch):
    monkeypatch.setattr(main_module, "AUTH_REQUIRED", True)
    connection = make_db([
        ("a", "2026-11-21T10:00:00Z", "completed", "x.apk", "s", "budget-android", None,
         json.dumps(engine_report(900, 10.0, 90.0, overall=87)), "owner-a"),
        ("b", "2026-11-21T09:00:00Z", "queued", "y.apk", "s", "budget-android", None, None, "owner-a"),
        ("c", "2026-11-21T08:00:00Z", "completed", "z.apk", "s", "budget-android", None, "not json", "owner-a"),
    ])
    patch_db(monkeypatch, connection)
    items = main_module.list_runs(request_for("owner-a"))["items"]
    by_id = {item["id"]: item for item in items}
    assert by_id["a"]["readiness_score"] == 87
    assert by_id["a"]["readiness_status"] == "pass"
    assert by_id["b"]["readiness_score"] is None
    assert by_id["c"]["readiness_score"] is None
    assert all("result_json" not in item and "result" not in item for item in items)


def test_get_run_skips_smoke_fusion_for_engine_reports(monkeypatch):
    monkeypatch.setattr(main_module, "AUTH_REQUIRED", True)
    connection = make_db([
        ("a", "2026-11-21T10:00:00Z", "completed", "x.apk", "s", "budget-android", None,
         json.dumps(engine_report(900, 10.0, 90.0)), "owner-a"),
    ])
    patch_db(monkeypatch, connection)
    detail = main_module.get_run("a", request_for("owner-a", "/api/v1/runs/a"))
    assert detail["result"]["readiness"]["overall"] == 90
    assert "diagnostics" not in detail["result"]


def test_capability_notes_follow_dispatch_state(monkeypatch):
    monkeypatch.setattr(main_module, "worker_dispatch_configured", lambda: True)
    enabled = main_module._capabilities_payload()
    assert enabled["notes"][0].startswith("Worker dispatch is enabled")
    assert "cpu_throttling" in enabled["engine_worker"]["not_applied"]
    monkeypatch.setattr(main_module, "worker_dispatch_configured", lambda: False)
    disabled = main_module._capabilities_payload()
    assert disabled["notes"][0].startswith("Production worker dispatch remains disabled")
