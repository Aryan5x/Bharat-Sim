# BharatSim — Phase 2 Test Execution Results

**Date of Execution:** November 21, 2026  
**Environment:** Windows 11 · Python 3.14.6 · Node v20+ · Vite 8.3.5 · Vitest 5.0.5 · Pytest 9.2.0  
**Git Branch:** `phase-2/real-android-execution`  

---

## 1. Test Summary Across All Subsystems

| Subsystem | Total Test Items | Executed | Passed | Failed | Skipped | Status |
|---|---|---|---|---|---|---|
| **Frontend Unit & Component (Vitest)** | 43 | 43 | 43 | 0 | 0 | **100% PASSED** |
| **Frontend Typecheck (`tsc -b --noEmit`)** | N/A | Full Build | Clean | 0 | 0 | **100% PASSED** |
| **Frontend Production Build (`vite build`)** | N/A | Production | Clean (2.93s) | 0 | 0 | **100% PASSED** |
| **Backend API, ML & Security (Pytest)** | 162 | 161 (1 deselected) | 159 | 0 | 2 (Live DB) | **100% PASSED** |
| **Android Worker & Network Shaper (Pytest)** | 103 | 103 | 103 | 0 | 0 | **100% PASSED** |
| **Unified Total** | **308** | **307** | **305** | **0** | **2** | **ALL ACTIVE TESTS PASSED** |

---

## 2. Test Execution Commands & Verification Evidence

### 2.1 Frontend (`npm test -- --run`)
```
 RUN  v5.0.5 C:/Users/kaust/OneDrive/Desktop/New folder (3)/Bharat-Sim/frontend

 ✓ src/__tests__/auth.test.ts (7 tests)
 ✓ src/__tests__/storageUpload.test.ts (4 tests)
 ✓ src/__tests__/reportStore.test.ts (5 tests)
 ✓ src/__tests__/components.test.tsx (27 tests)

 Test Files  4 passed (4)
      Tests  43 passed (43)
```

### 2.2 Backend (`pytest backend/tests -k "not test_restart_persistence"`)
```
collected 162 items / 1 deselected / 161 selected

backend\tests\test_analysis.py .....................                     [ 13%]
backend\tests\test_anomaly_detector_regression.py ....                   [ 15%]
backend\tests\test_api.py ................                               [ 25%]
backend\tests\test_audit_events.py ....                                  [ 27%]
backend\tests\test_evidence_fusion.py ............                       [ 35%]
backend\tests\test_firecracker_host_preflight.py .....                   [ 38%]
backend\tests\test_health_readiness.py ................                  [ 48%]
backend\tests\test_ml_and_evaluator.py ............                      [ 55%]
backend\tests\test_number_parser_regression.py .                         [ 56%]
backend\tests\test_planner.py .......                                    [ 60%]
backend\tests\test_postgres_adapter.py .........                         [ 66%]
backend\tests\test_postgres_pooler.py .                                  [ 66%]
backend\tests\test_postgres_quotas.py s                                  [ 67%]
backend\tests\test_postgres_signed_uploads.py s                          [ 68%]
backend\tests\test_production_config.py ....                             [ 70%]
backend\tests\test_public_preview_analysis.py ...                        [ 72%]
backend\tests\test_quotas.py .....                                       [ 75%]
backend\tests\test_sarvam.py .......                                     [ 79%]
backend\tests\test_security.py ..........                                [ 85%]
backend\tests\test_signed_uploads.py .......                             [ 90%]
backend\tests\test_supabase_storage_auth.py ..                           [ 91%]
backend\tests\test_vercel_dependencies.py .                              [ 92%]
backend\tests\test_vercel_runtime.py ........                            [ 97%]
backend\tests\test_worker_protocol.py .............                      [100%]

========== 159 passed, 2 skipped, 1 deselected in 22.84s ==========
```

### 2.3 Worker Suite (`pytest worker/tests`)
```
collected 103 items

worker\tests\android_testing_engine\test_apk_parser.py ..                [  1%]
worker\tests\android_testing_engine\test_crash_detector.py .....         [  6%]
worker\tests\android_testing_engine\test_models.py ..                    [  8%]
worker\tests\android_testing_engine\test_runner_mock.py ....             [ 12%]
worker\tests\test_agent.py .................                             [ 29%]
worker\tests\test_android_connect_source.py ..                           [ 31%]
worker\tests\test_appium_smoke_journey.py ............                   [ 42%]
worker\tests\test_condition_applicator.py ....................           [ 62%]
worker\tests\test_condition_planner.py .......                           [ 68%]
worker\tests\test_https_shaping_proxy.py .....                           [ 73%]
worker\tests\test_network_shaper.py ..........                           [ 83%]
worker\tests\test_runner.py .................                            [100%]

======================== 103 passed in 13.92s =========================
```

