# BharatSim — API Endpoint Test Results

**API Version:** v1 (`/api/v1`)  
**Base Implementation:** FastAPI (`backend/app/main.py`)  
**Test Suite:** `backend/tests/test_api.py`, `backend/tests/test_security.py`, `backend/tests/test_planner.py`  

---

## 1. Complete Endpoint Inventory & Verification Status

| Method | Endpoint | Auth Required | Request Payload | Response Code | Test Status | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/health/live` | No | None | `200 OK` | PASSED | Kubernetes liveness probe |
| `GET` | `/health/ready` | No | None | `200 OK` | PASSED | Checks database connection readiness |
| `GET` | `/api/v1/personas` | No | None | `200 OK` | PASSED | Returns full persona catalog with network/device limits |
| `POST` | `/api/v1/plan` | No | `{persona_ids, serial}` | `200 OK` | PASSED | Returns preflight condition feasibility analysis |
| `POST` | `/api/v1/uploads/sign` | Yes (Optional in dev) | `{filename, size_bytes}` | `200 OK` / `401` | PASSED | Generates Supabase signed TUS resumable upload ticket |
| `POST` | `/api/v1/runs` | Yes (Optional in dev) | Multipart Form (file, persona_id) | `201 Created` / `415` | PASSED | Validates APK ZIP structure, manifest, compression ratio |
| `GET` | `/api/v1/runs` | Yes (Optional in dev) | Query: `limit`, `status` | `200 OK` | PASSED | Returns runs strictly scoped to caller's `owner_id` |
| `GET` | `/api/v1/runs/{id}` | Yes (Optional in dev) | None | `200 OK` / `404` | PASSED | Returns single run details and telemetry; 404 for cross-user |
| `GET` | `/api/v1/runs/{id}/report` | Yes (Optional in dev) | None | `200 OK` / `404` | PASSED | Returns generated report JSON |
| `GET` | `/api/v1/runs/{id}/events` | Yes (Optional in dev) | None | `200 OK` / `404` | PASSED | Audit log of lifecycle transitions |
| `DELETE`| `/api/v1/runs/{id}` | Yes (Optional in dev) | None | `200 OK` / `404` | PASSED | Cancels/deletes run if owned by caller |
| `POST` | `/api/v1/analyze/logs` | No (Public demo allowed) | `{log_text, persona_id}` | `200 OK` | PASSED | ML TF-IDF centroid classifier inference on raw logcat |
| `GET` | `/api/v1/analyses` | Yes (Optional in dev) | None | `200 OK` | PASSED | Retrieves persisted analyses for user |
| `POST` | `/api/v1/translate/report`| No | `{report, target_language}` | `200 OK` | PASSED | Sarvam AI translation (hi, ta, mr) with fallback |
| `POST` | `/api/v1/translate/audio` | No | `{text, language}` | `200 OK` | PASSED | Sarvam AI TTS audio generator with fixture fallback |
| `POST` | `/api/v1/explain/failure` | No | `{finding, category}` | `200 OK` | PASSED | Sarvam LLM root-cause and code remediation advice |
| `GET` | `/api/v1/evaluator/scenarios`| No | None | `200 OK` | PASSED | Returns pre-canned evaluator demo scenarios |
| `POST` | `/api/v1/runs/compare` | Yes (Optional in dev) | `{baseline_run_id, constrained_run_id}` | `200 OK` / `422` | PASSED | Calculates telemetry delta and Z-score regressions |
| `GET` | `/api/v1/capabilities` | No | None | `200 OK` | PASSED | Reports deployment capabilities (Vercel, Supabase, etc.) |
| `GET` | `/api/v1/workers` | Yes | None | `200 OK` | PASSED | Lists active connected workers and heartbeat age |
| `POST` | `/internal/worker/claim` | Worker Token | `{worker_id, capabilities}` | `200 OK` / `204` | PASSED | Leases next pending run for 5 minutes |
| `POST` | `/internal/worker/runs/{id}/heartbeat`| Worker Token | None | `200 OK` | PASSED | Refreshes lease timer |
| `POST` | `/internal/worker/runs/{id}/result`| Worker Token | `{status, result_json, artifacts}` | `200 OK` | PASSED | Ingests final telemetry, findings, and marks run complete |

---

## 2. Robustness & Adversarial Testing

1. **Malicious File Uploads:** Uploading `.exe`, `.tar`, corrupted ZIP, or Zip-Bomb APKs returns `415 Unsupported Media Type` without crashing server.
2. **Missing Fields:** Empty payload to `/api/v1/plan` or `/api/v1/runs/compare` returns `422 Unprocessable Entity` with structured field errors.
3. **Cross-Tenant IDOR:** Querying a run ID owned by User B while authenticated as User A returns `404 Not Found` (no metadata leakage).
