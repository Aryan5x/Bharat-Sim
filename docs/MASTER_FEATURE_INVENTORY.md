# BharatSim — master feature inventory and judge acceptance status

**Audit date:** 22 November 2026  
**Decision:** controlled-beta implementation with meaningful CI fixture coverage; not yet production-complete.

“Implemented” means code exists. “CI verified” means automated tests cover the stated scope. “Production accepted” requires live evidence from the intended production infrastructure.

## 1. Feature status

| Feature | Implemented | Automated / fixture evidence | Production acceptance remaining |
|---|---|---|---|
| Authentication | Supabase email/password/session and protected workspace | JWT verification and auth regression tests | Real signup/confirmation/login/refresh/logout/recovery and two-user live test |
| Tenant isolation | Owner-scoped API queries and ownership fields | API cross-user unit tests | Live two-account denial matrix for every private route, artifact and signed URL |
| Personas | Authored device/network profiles and custom persona schema | API and validation tests | Measured emulator readback for each applied control |
| Risk planner | Category-aware deterministic ranking, editable journeys and JSON export | Backend/frontend contract and Playwright tests | Keep planning separate from execution; validate final browser journey |
| Logcat analysis | Deterministic signals, source-line evidence, recommendations and BharatScore | Backend tests and browser analysis/export journey | Authenticated deployed report journey and adversarial/large-input review |
| Failure DNA | Normalized signature grouping and occurrence counts | Repeated-input fingerprint regression test | Repeated real emulator runs and persisted evidence across builds |
| Backend classifier | TF-IDF centroid classifier | Hand-authored 48-example holdout; 79.2% accuracy, ~0.787 macro-F1; normal recall 0.50 | Larger independent external holdout, leakage review, class-wise metrics and calibration |
| Worker classifier | TF-IDF word/character + logistic-regression path | Grouped cross-validation on mixed weak-rule/templated dataset | Independent labels and external holdout; training/CV is not field accuracy |
| Anomaly detection | Explicit thresholds and fixed-reference z-score heuristic | Regression tests for zero/partial telemetry | Validate formulas, sample minimums and missing-data policy |
| BharatScore | Transparent heuristic summary score | Fixture/report tests | Publish weights and validate against repeated controlled runs; not certification/probability |
| APK validation | ZIP/manifest checks, bounded metadata and SHA-256 | Upload/security regression tests | Malicious archive corpus and deployed upload verification |
| Private APK Storage | Signed/resumable/chunked upload and worker download code | Storage/auth tests and PostgreSQL migration tests | Server-only Supabase secret missing from Vercel; live upload/hash/download/delete/expiry/retention |
| PostgreSQL | Adapter and all nine timestamped BharatSim migrations | Clean PostgreSQL CI; direct Supabase synthetic insert/read/delete verified | Vercel API DB target and restart persistence |
| Worker queue | Claims, leases, heartbeat, hash-bound download and result callback | Worker protocol and PostgreSQL integration tests | Production registration/revocation/concurrency/retry/recovery |
| Legacy smoke worker | Install/launch, bounded observation and logcat | Worker unit tests and Android CI fixture journey | Dedicated host and real user APK lifecycle |
| Full engine worker | Baseline/persona passes, telemetry, proxy shaping, battery/storage/recovery | Engine/shaper unit tests and measured source-built HTTPS proxy fixture | Isolated production host and repeated app-specific data-plane evidence |
| Network shaping | Latency/bandwidth and proxy loss stalls/resets; airplane-mode outage check | CI fixture reports `traffic_path_verified=true`; baseline median 890 ms vs bandwidth median 1,431 ms in a prior fixture | Real app traffic evidence per condition; apps bypassing system proxy are not shaped |
| CPU / RAM | CPU throttling unsupported; RAM depends on emulator provisioning/readback | Planner and safety tests | Do not claim dynamic CPU throttling; report actual emulator RAM |
| Speak-to-Test | Typed/voice request, schema-validated plans and allowlisted scenarios | Backend/frontend tests and controlled BharatPay fixture | Fresh deployed Sarvam and full APK execution journey |
| JanJeevan packs | BharatPay original/fixed controlled sample; other packs planned | Fixture assertion tests | Build independent fixtures/assertions for additional packs |
| FixProof | Original/candidate run comparison against scenario assertions | Repeated synthetic verdict regression test | Two or more real completed runs of the same scenario/build pair |
| Run comparison | Owner-scoped completed-run comparison | API tests | Production PostgreSQL data and cross-user denial |
| Reports/exports | Run detail and PDF/JSON export | Frontend E2E checks file bytes/content | Durable artifact library, retention and pagination |
| Sarvam | Translation, STT, TTS and explanation integration | Provider mocks and earlier live provider evidence for selected Indian languages | Fresh deployed Vercel calls, current key validity and browser audio playback |
| UI/theme/navigation | React/Vite workspace, Platform Showcase first, lazy routes and responsive layout | Unit tests, build and Playwright viewport/accessibility smoke | Manual keyboard/screen-reader/contrast/focus/mobile review |
| Deployment | Unified FastAPI/Vite configuration | CI unified build and container smoke | Exact merged SHA, readiness and authenticated Production smoke |

## 2. Worker mode distinction

- `BHARATSIM_WORKER_ENGINE=smoke` (default): legacy install/launch/logcat smoke worker; narrower emulator control set.
- `BHARATSIM_WORKER_ENGINE=engine`: full baseline/persona engine. Host proxy shapes only traffic routed through Android's system proxy. Outage/recovery is a separate airplane-mode check.
- CPU throttling is unsupported. RAM constraints depend on emulator provisioning and readback.
- A personal laptop worker is owner-scoped convenience execution, not per-job VM/microVM isolation.

## 3. Live database and Storage observations — 22 Nov 2026

- Canonical active Supabase project identified in Vercel environment metadata: `hkyieaovolkethovyenb` (`common 1`, ap-south-1). The project contains separate `bharatsim` and `genomeguard` schemas.
- All nine BharatSim repository migrations are recorded; live run/persona/scenario and personal-worker columns are present.
- Direct database synthetic run insert/read/delete succeeded; the probe row was removed. Final live counts observed: 0 runs, 0 analyses, 0 workers, 0 artifacts.
- `bharatsim-private` is non-public with a 150 MiB per-object cap and zero APK objects.
- Vercel `BHARATSIM_MAX_UPLOAD_MB` is configured to 500 MiB; multipart objects are 45 MiB.
- Vercel environment inventory does not contain `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. The backend requires one for private Storage. Do not substitute the browser publishable key.
- Sensitive `BHARATSIM_DATABASE_URL`, `SUPABASE_URL` and `sarvam_api` values remain masked; do not claim their runtime/provider health from variable presence alone.
- Production public APK execution, worker isolation attestation and worker egress restriction remain false.
- No APK object, customer run, worker row or artifact currently exists in the inspected production schema/bucket.

## 4. Release blockers

1. Add a server-only Supabase secret/service-role credential to Vercel Production and verify private Storage lifecycle.
2. Verify the masked Vercel database URL points to the canonical project and run API persistence across invocations/restarts.
3. Run a live two-account tenant-isolation matrix.
4. Provision a dedicated KVM-capable worker host with per-job isolation and default-deny egress.
5. Complete authenticated Production APK → worker → report → reopen/export.
6. Repeat network, Failure DNA and FixProof measurements using real emulator executions.
7. Independently validate ML/anomaly methodology.
8. Verify current deployed Sarvam translation, STT, TTS and audio playback.
9. Complete manual accessibility testing and exact-SHA Production deployment.

## 5. Judge-safe claims

- Logcat analysis returns deterministic signals and source-line evidence.
- The risk planner ranks test priorities; it does not execute a plan.
- CI completes a controlled source-built APK journey through a local API and emulator worker.
- Proxy traffic telemetry proves only the tested fixture's proxy path; arbitrary apps may bypass Android's system proxy.
- ML, Failure DNA, anomaly and BharatScore outputs are triage evidence, not certified diagnoses or field-accuracy guarantees.
- Public arbitrary APK execution remains disabled until production persistence, tenant isolation, private Storage and worker isolation pass independent acceptance.
