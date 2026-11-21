"""Personal laptop workers: per-user keys that can only run the owner's own tests."""
from __future__ import annotations

from app import main
from tests.test_worker_protocol import apk_bytes, prepare_isolated_db

USERS = {"token-a": "11111111-1111-1111-1111-111111111111", "token-b": "22222222-2222-2222-2222-222222222222"}


def setup(monkeypatch, tmp_path):
    client = prepare_isolated_db(monkeypatch, tmp_path)
    monkeypatch.setattr(main, "AUTH_REQUIRED", True)
    monkeypatch.setattr(main, "verify_supabase_access_token", lambda token: USERS[token])
    return client


def auth(token):
    return {"Authorization": "Bearer " + token}


def create_run(client, token):
    res = client.post("/api/v1/runs", data={"persona_id": "baseline"}, headers=auth(token),
                      files={"apk": ("app.apk", apk_bytes(), "application/vnd.android.package-archive")})
    assert res.status_code == 200, res.text
    return res.json()["id"]


def connect(client, token, label="My laptop"):
    res = client.post("/api/v1/my-workers", json={"label": label}, headers=auth(token))
    assert res.status_code == 200, res.text
    return res.json()


def test_key_is_shown_once_and_only_hash_is_stored(monkeypatch, tmp_path):
    client = setup(monkeypatch, tmp_path)
    worker = connect(client, "token-a")
    assert worker["worker_key"].startswith("bsw_" + worker["worker_id"] + "_")
    with main.db() as conn:
        row = conn.execute("SELECT token_hash, owner_id FROM workers WHERE id=?", (worker["worker_id"],)).fetchone()
    secret = worker["worker_key"].split("_", 2)[2]
    assert row["token_hash"] == main._hash_worker_secret(secret) and secret not in row["token_hash"]
    assert row["owner_id"] == USERS["token-a"]
    listed = client.get("/api/v1/my-workers", headers=auth("token-a")).json()["items"]
    assert [w["id"] for w in listed] == [worker["worker_id"]]
    assert "worker_key" not in listed[0] and "token_hash" not in listed[0]
    assert client.get("/api/v1/my-workers", headers=auth("token-b")).json()["items"] == []


def test_personal_worker_claims_only_its_owners_runs(monkeypatch, tmp_path):
    client = setup(monkeypatch, tmp_path)
    run_b = create_run(client, "token-b")
    run_a = create_run(client, "token-a")
    worker = connect(client, "token-a")
    headers = {"X-BharatSim-Worker-Token": worker["worker_key"]}
    job = client.post("/internal/worker/claim", headers=headers, json={"worker_id": worker["worker_id"]}).json()["job"]
    assert job["id"] == run_a  # never B's older run
    assert client.post("/internal/worker/claim", headers=headers, json={"worker_id": worker["worker_id"]}).json()["job"] is None
    with main.db() as conn:
        assert conn.execute("SELECT status FROM runs WHERE id=?", (run_b,)).fetchone()["status"] == "queued"


def test_personal_worker_cannot_touch_another_users_lease(monkeypatch, tmp_path):
    client = setup(monkeypatch, tmp_path)
    run_b = create_run(client, "token-b")
    shared = {"X-BharatSim-Worker-Token": main.os.environ["BHARATSIM_WORKER_TOKEN"]}
    job = client.post("/internal/worker/claim", headers=shared, json={"worker_id": "team-1"}).json()["job"]
    assert job["id"] == run_b
    worker_a = connect(client, "token-a")
    headers = {"X-BharatSim-Worker-Token": worker_a["worker_key"], "X-BharatSim-Lease-Token": job["lease_token"]}
    assert client.get(f"/internal/worker/runs/{run_b}/apk", headers=headers).status_code == 403
    assert client.post(f"/internal/worker/runs/{run_b}/heartbeat", headers=headers,
                       json={"lease_token": job["lease_token"], "stage": "x"}).status_code == 403
    assert client.post(f"/internal/worker/runs/{run_b}/result", headers=headers,
                       json={"lease_token": job["lease_token"], "status": "failed", "result": {"status": "failed"}, "error": "x"}).status_code == 403


def test_worker_id_must_match_key_and_shared_token_cannot_hijack(monkeypatch, tmp_path):
    client = setup(monkeypatch, tmp_path)
    worker = connect(client, "token-a")
    headers = {"X-BharatSim-Worker-Token": worker["worker_key"]}
    assert client.post("/internal/worker/claim", headers=headers, json={"worker_id": "someone-else"}).status_code == 403
    shared = {"X-BharatSim-Worker-Token": main.os.environ["BHARATSIM_WORKER_TOKEN"]}
    assert client.post("/internal/worker/claim", headers=shared, json={"worker_id": worker["worker_id"]}).status_code == 403


def test_revoked_or_forged_keys_are_rejected(monkeypatch, tmp_path):
    client = setup(monkeypatch, tmp_path)
    worker = connect(client, "token-a")
    forged = "bsw_" + worker["worker_id"] + "_" + "A" * 43
    assert client.post("/internal/worker/claim", headers={"X-BharatSim-Worker-Token": forged},
                       json={"worker_id": worker["worker_id"]}).status_code == 401
    assert client.delete(f"/api/v1/my-workers/{worker['worker_id']}", headers=auth("token-b")).status_code == 404
    assert client.delete(f"/api/v1/my-workers/{worker['worker_id']}", headers=auth("token-a")).status_code == 200
    assert client.post("/internal/worker/claim", headers={"X-BharatSim-Worker-Token": worker["worker_key"]},
                       json={"worker_id": worker["worker_id"]}).status_code == 401


def test_limits_and_auth(monkeypatch, tmp_path):
    client = setup(monkeypatch, tmp_path)
    assert client.post("/api/v1/my-workers", json={"label": "x"}).status_code == 401
    for i in range(main.MAX_PERSONAL_WORKERS):
        connect(client, "token-a", f"Laptop {i}")
    assert client.post("/api/v1/my-workers", json={"label": "one more"}, headers=auth("token-a")).status_code == 409
    assert client.post("/api/v1/my-workers", json={"label": "<script>"}, headers=auth("token-a")).status_code == 422


def test_workers_list_shows_team_and_own_workers_only(monkeypatch, tmp_path):
    client = setup(monkeypatch, tmp_path)
    a = connect(client, "token-a")
    b = connect(client, "token-b")
    ids = [w["id"] for w in client.get("/api/v1/workers", headers=auth("token-a")).json()["items"]]
    assert a["worker_id"] in ids and b["worker_id"] not in ids
