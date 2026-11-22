# BharatSim — production release gates

**Audit date:** 22 November 2026  
**Decision:** controlled beta only. No-go for public arbitrary APK execution.  
**Current implementation PR:** [#146](https://github.com/kaustubhdua/Bharat-Sim/pull/146).

## Current Production API probe — 22 Nov 2026

- `GET /health/ready` returned HTTP 503: database unavailable, private storage unavailable, auth configured, worker not configured/offline.
- `GET /api/v1/capabilities` returned HTTP 200: log analysis, risk planner, Failure DNA and evaluator scenarios enabled; database persistence, APK upload, analysis persistence, run comparison, worker dispatch, Android execution, Sarvam translation and Sarvam TTS all false.
- The current Production deployment is still commit `76f5b7e6`; the current PR is not deployed to Production.

This live API result takes precedence over configured environment-variable names or source-code implementation.

## P0 — production APK journey

| Gate | Current evidence | Acceptance required |
|---|---|---|
| Authoritative Supabase project | Vercel browser and server-side environment metadata identify active project `hkyieaovolkethovyenb` (`common 1`) as canonical. BharatSim data is in isolated `bharatsim` schema alongside GenomeGuard. | Confirm the masked Production `BHARATSIM_DATABASE_URL` resolves to this project; verify Vercel API readiness and persistence across invocations/restarts. |
| Schema/migrations | All nine repository BharatSim migrations are recorded; latest run/persona/scenario and personal-worker columns are present. | Verify deployed API schema compatibility after exact-SHA deployment; retain backup/restore evidence. |
| PostgreSQL persistence | Direct database synthetic insert/read/delete succeeded; row was removed and final run count is zero. | Same write/read/delete through the deployed API across separate invocations and restart. |
| Private APK Storage | Private non-public `bharatsim-private` bucket exists (150 MiB object cap); zero APK objects. | Add server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to Vercel Production; verify upload/hash/download/delete/expiry/retention. |
| Upload size | Vercel environment cap is 500 MiB; code chunks at 45 MiB. | Verify multipart upload above 50 MiB after Storage credentials are enabled. |
| Authentication/tenant isolation | JWT verification and owner-scoped API queries implemented. | Two real accounts; cross-tenant read/write/delete denial for every run, report, analysis, worker and artifact; signed URL replay/expiry tests. |
| Worker deployment/isolation | CI fixture worker works; personal laptop workers are owner-scoped but not isolated sandboxes. Production isolation/egress flags remain false. | Dedicated KVM host with per-job microVM, default-deny egress, quotas, patched image, lease cleanup and independent attestation. |
| Real APK-to-report | CI source-built APK completes local API → worker lease/download/install/launch → report callback. | Authenticated Production upload → isolated worker → PostgreSQL report → reopen/export → cleanup. |

## P1 — feature evidence

- Repeat full-engine network tests with measured app traffic, negative controls and per-run proxy counters. Proxy shaping applies only to Android system-proxy traffic.
- Validate airplane-mode outage/recovery, packet-loss stalls and resets across repeated app executions; keep CPU throttling unsupported and RAM provisioning-dependent.
- Validate Failure DNA fingerprints and FixProof verdicts using repeated real emulator runs of the same scenario/build pair.
- Independently evaluate backend and worker ML paths with an external labelled holdout, leakage review, confusion matrix, per-class metrics and calibration. The current 48-case hand-authored holdout is a regression set, not field accuracy.
- Validate anomaly thresholds, missing-data behavior and BharatScore weights against repeated controlled measurements.
- Verify current deployed Sarvam translation, STT, TTS/audio playback, quota handling and provider failure paths. Variable presence alone is not provider health.
- Test personal laptop installers, key revocation, update integrity and uninstall on supported Windows/macOS/Linux versions.

## P2 — quality and operations

- Manual keyboard, focus, screen-reader, contrast, reduced-motion and real-device accessibility acceptance.
- Durable artifact retention, expiry/deletion, backup/restore and incident response.
- Production monitoring, rate limiting, abuse controls and quota alerts.
- Deploy exact merged SHA; verify health, Auth, API, upload and authenticated browser journeys.
- Finalize release notes and judge demo with accurate distinction between CI fixtures, measured app traffic, heuristics and production-accepted behavior.

## Release guardrails

- Keep `BHARATSIM_PUBLIC_APK_EXECUTION_ENABLED=false`.
- Keep `BHARATSIM_WORKER_ISOLATION_ATTESTED=false`.
- Keep `BHARATSIM_WORKER_EGRESS_RESTRICTED=false`.
- Never use a personal laptop, shared CI runner, API host or Vercel function as a sandbox for arbitrary public APKs.
- A green CI run or READY Vercel build is not production acceptance.
