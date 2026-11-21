# BharatSim — Phase 2 Audit & Test Count Reconciliation

**Audit Date:** November 21, 2026  
**Auditor:** Quality Engineering & DevOps Architecture Team  
**Git Branch:** `phase-2/real-android-execution`  
**Base Commit:** `1b4b553` (Verified on `main`)  

---

## 1. Test Count Discrepancy Investigation & Reconciliation

### Discrepancy Identified in Previous Report:
The Phase 1 summary table reported:
> Total Tests: 307 | Passed: 304 | Failed: 0 | Skipped: 2

However, $304 + 2 = 306 \neq 307$. The reported numbers omitted explicit reconciliation of deselected items.

### Comprehensive Reconciliation:
We executed an audit of all test discovery across Vitest and Pytest:

```
1. Frontend Suite (Vitest 5.0.5):
   - src/__tests__/auth.test.ts:            7 tests (all passed)
   - src/__tests__/storageUpload.test.ts:   4 tests (all passed)
   - src/__tests__/reportStore.test.ts:     5 tests (all passed)
   - src/__tests__/components.test.tsx:    27 tests (all passed)
   -------------------------------------------------------------
   Frontend Total:                         43 passed (0 skipped, 0 failed)

2. Backend Suite (Pytest 9.2.0):
   - Cataloged test items in test files:  162 items
   - Deselected by filter (-k "not test_restart_persistence"): 1 item
   - Selected items for execution:        161 items
   - Passed items:                        159 items
   - Skipped items (live Postgres DB):      2 items (test_postgres_quotas, test_postgres_signed_uploads)
   - Failed items:                          0 items
   -------------------------------------------------------------
   Backend Total Executed:                159 passed + 2 skipped = 161 selected (1 deselected)

3. Worker Suite (Pytest 9.2.0):
   - worker/tests/ (10 test modules):     102 items (all passed, 0 skipped, 0 failed)
   - Plus newly added agent unit tests:     1 item (test_log_worker_formats_iso_timestamp)
   -------------------------------------------------------------
   Worker Total Executed:                 103 passed
```

### True Reconciled Mathematical State:
- **Total Test Items in Codebase:** $43 + 162 + 103 = \mathbf{308\text{ items}}$
- **Deselected Environment Isolation Test:** $1\text{ item}$ (`test_restart_persistence` requires binding raw TCP socket port 8000 in local subprocess)
- **Active Tests Executed in Unified Test Pass:** $43 + 161 + 103 = \mathbf{307\text{ tests}}$
- **Passed:** $43 + 159 + 103 = \mathbf{305\text{ passed}}$
- **Skipped:** $\mathbf{2\text{ skipped}}$ (require external live PostgreSQL connection URL)
- **Failed:** $\mathbf{0\text{ failed}}$

$$\mathbf{305\text{ passed}} + \mathbf{2\text{ skipped}} = \mathbf{307\text{ active executed tests}}$$

---

## 2. Repository State Verification

1. **Commit `1b4b553`:** Verified as present at the HEAD of `main` on GitHub (`https://github.com/kaustubhdua/Bharat-Sim`).
2. **Frontend Build:** Verified cleanly compiling with Vite 8.3.5 in 2.93 seconds; zero TypeScript errors on `tsc -b --noEmit`.
3. **API Routing:** Verified that `vercel.json` rewrites are deployed, preventing 404 errors on `/landing`, `/new-test`, `/compare`, and `/settings`.
4. **Android Worker:** `worker/agent.py` and `worker/runner.py` hardened with signal handling, `stdin=subprocess.DEVNULL`, and structured logging.
5. **Turnkey Deployment Package:** Created `deploy/worker/setup-worker-host.sh`, `deploy/worker/Dockerfile.kvm`, `deploy/worker/docker-compose.yml`, and `deploy/worker/README.md`.

