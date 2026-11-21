# BharatSim — completion audit and judge-ready acceptance plan

**Audit date:** 2026-11-22 (IST)  
**Base commit reviewed:** `cfbb8abd`  
**Decision:** substantial controlled-beta implementation; **not yet fully production-complete**.

This audit separates source-code implementation, automated fixture evidence, live-provider configuration, and production acceptance. A route, button, API endpoint, CI fixture, or successful deployment alone does not make a feature complete.

## 1. Judge-ready user journeys

### Primary: APK to evidence report
1. Sign in with a real account.
2. Upload a valid APK through private storage; verify server-side validation, SHA-256 and APK metadata.
3. Select a persona and see which constraints are actually requested.
4. Observe queued → leased → running → completed/failed transitions from real worker heartbeats.
5. Verify install/launch on a disposable Android emulator.
6. Inspect measured Logcat, crash/ANR, startup, memory, frame and network evidence.
7. Distinguish measured, control-plane-only, report-only and unsupported conditions.
8. Reopen the persisted report and export it.
9. Verify cleanup and APK hash integrity.

**Status:** execution code and a controlled emulator fixture exist, but public production execution is not accepted. A separately provisioned and attested worker, production persistence, private storage, Auth ownership and durable artifact retention still require live acceptance.

### Secondary: Logcat to report
1. Paste real Logcat and submit it to the analysis API.
2. Inspect severity, evidence-linked source lines, findings, recommendations and BharatScore.
3. Export PDF and JSON.
4. Reopen the report and verify its persistence label is truthful.

**Status:** deterministic analysis and client-side export are implemented. Stateless/local analysis is not proof of durable server-side storage. Live authenticated lifecycle and persistence remain to be accepted.

### Supporting: risk planner
Validate category and journeys, generate an explainable API plan, export the exact JSON and confirm the UI does not claim the plan was executed.

**Status:** implemented; fresh Playwright verification is required.

## 2. Confirmed latest-main CI failures and fixes in this branch

Latest inspected main CI: [44954049465](https://github.com/kaustubhdua/Bharat-Sim/actions/runs/44954049465), commit `cfbb8abd`, 2026-11-21. Backend, frontend build, unified Vercel build, worker guards and container build passed. PostgreSQL integration and frontend E2E failed. Dependency audit passed. Android smoke [44954049500](https://github.com/kaustubhdua/Bharat-Sim/actions/runs/44954049500) failed.

### PostgreSQL migration drift
CI applied only the original core, FK-index and signed-upload migrations. Current inserts use `persona_json` and `scenario_json`, producing `UndefinedColumn: persona_json`.

**Branch fix:** create the minimal Supabase Storage bucket-metadata table in the disposable PostgreSQL service and apply every timestamped BharatSim migration in sorted order. This brings custom-persona, worker-status, scenario, large-APK and personal-worker DDL into integration tests.

### Baseline worker rejected zero-kbps arguments
The Android job failed before install because the baseline profile's `down_kbps=0` and `up_kbps=0` (unrestricted/full speed) were passed as explicit caps. The runner correctly rejects zero as a throughput cap.

**Branch fix:** the worker uses the shared persona argument translator. A zero/zero baseline sentinel emits no zero-kbps CLI override while preserving the full profile for condition planning and control-plane evidence. Packet-loss bounds remain validated. A regression test covers the sentinel.

### Frontend E2E assertions drifted from the actual UI
Five Playwright failures included an obsolete packet-loss badge, double-escaped PDF/JSON extension regexes, stale run-button text, a stale API-docs destination, and an obsolete landing-page heading/badge.

**Branch fix:** tests now target current UI labels/links and correctly match literal file extensions. They still assert API connectivity, evidence content, PDF bytes and JSON content; no unconditional pass assertions were added.

## 3. Feature inventory — what remains before full completion

| Feature | Implemented in source | Acceptance still required |
|---|---|---|
| Authentication | Supabase session/sign-in and protected workspace | Real sign-up, email confirmation, sign-in, refresh, expiry, sign-out and password recovery. |
| Tenant isolation | Owner-scoped API paths and private-schema/RLS migrations | Two-user cross-tenant read/write/delete denial for every private route and artifact on production DB. |
| Persona catalogue | API-authored profiles and custom persona UI | Measured emulator readback per profile; never equate profile targets with physical-device measurements. |
| Risk planner | Deterministic category/journey ranking and JSON export | Fresh E2E and continued separation of planning from execution. |
| Logcat analysis | Deterministic signals, source-line evidence, severity, recommendations and score | Malformed/large/adversarial logs, Unicode, redaction, multi-signature and authenticated-access tests. |
| PDF/JSON export | Browser-side report export | Stable schema, long/Unicode reports, file-content checks and export after session restoration. |
| APK intake | Validation, metadata, SHA-256, signed/resumable/chunked upload code | Live private Storage upload/verify/download/delete, size and interrupted-upload tests. |
| Run registration/history | PostgreSQL adapter and lifecycle/ownership code | Apply reviewed migrations to the intended DB; prove CRUD across API restarts. |
| Worker claiming | Token auth, lease, heartbeat and result callbacks | Expired leases, stale/duplicate callbacks, revocation, ownership and concurrent claims. |
| Personal laptop worker | Key creation/revocation UI and Windows/macOS/Linux installers | Real OS install/uninstall, rotation/revocation, owner-only claims and safe cleanup. A laptop is not a multi-tenant sandbox. |
| Android execution | ADB install/launch, bounded exploration, Logcat, memory/frame/startup capture and cleanup | Green emulator E2E; multi-APK, failure, timeout, process-tree cleanup, reset and artifact retrieval tests. |
| Engine worker | Baseline/persona engine, shaping proxy and measurements | Prove production uses engine mode; do not conflate legacy smoke runner with full engine. |
| Network simulation | Emulator latency/bandwidth controls with readback; proxy code for additional shaping | Measure app data-plane traffic for every claimed condition. Keep packet loss/outage/reset unsupported unless worker evidence proves them. |
| RAM/CPU | RAM reported; CPU throttling not implemented | Do not claim dynamic RAM/CPU throttling without a safe measured implementation. |
| Storage/battery controls | Bounded emulator controls and cleanup evidence | Low-space safety, pre-satisfied target, interrupted cleanup and emulator discard tests. |
| Failure DNA | Deterministic signature grouping/evidence fusion | Stable fingerprints across repeated runs/versions; similarity is not confirmed root cause. |
| ML classifier | Local TF-IDF classifier path | Independently labelled holdout, leakage-free validation, per-class metrics, confusion matrix and model version. Training fit is not field accuracy. |
| Anomaly detection | Statistical/threshold logic | Document formulas, minimum samples, missing-data behavior and confidence; don't call heuristics trained ML. |
| BharatScore | Transparent heuristic score | Publish weights/formula/missing-evidence treatment; verify fixtures; don't call it certification. |
| Sarvam / Speak-to-Test | Provider integration and capability-gated UI | Server-only key, real speech-to-text, structured-plan validation, translation/audio and outage/rate-limit tests. |
| FixProof | Route and old/new evidence workflow | Same scenario and comparable measured assertions on two completed builds. |
| Run comparison | Owner-scoped completed-run comparison | DB-backed history, shared measured metrics, missing telemetry and cross-user denial. |
| Reports/history/settings | Routes and components | Durable report library, pagination/filtering, artifact lifecycle, persistent preferences and account recovery. |
| Accessibility/responsive | Responsive layout, theme, reduced-motion support | Keyboard, screen-reader, contrast, focus, reduced-motion and small-screen manual audit. |
| Deployment | Vercel project and Render URL referenced | One canonical origin; exact release SHA deployed; frontend/API pairing, readiness and deployed browser E2E verified. |

## 4. Infrastructure and data gates

These cannot be closed by source changes alone.

1. **Choose the authoritative Supabase project.** The connected project inspected is `common 1` (`hkyieaovolkethovyenb`), shared with GenomeGuard. The Vercel environment inventory also contains a browser Supabase URL with a different project reference. Confirm exact project IDs behind server-side `SUPABASE_URL`, `BHARATSIM_DATABASE_URL` and browser `VITE_SUPABASE_URL` without exposing secrets.
2. **Do not run `supabase db push` blindly against common 1.** The live schema inspection did not show latest `persona_json`, `scenario_json` and personal-worker columns. Apply migrations only after confirming the target, backup and review with the owner of the shared GenomeGuard DB.
3. **Verify server-only credentials.** A non-decrypted Vercel environment inventory is not proof of connectivity. Confirm the PostgreSQL pooler URL, TLS mode and server-only Supabase secret in the correct Production scope. Never put server secrets in `VITE_*`, source control, screenshots or chat.
4. **Prove persistence and Storage.** `/health/ready` must report actual connected dependencies. Create/read/delete a run across separate invocations; upload, hash-verify, download and delete a private APK; verify cleanup.
5. **Provision an isolated worker host.** A personal laptop worker is useful for controlled private testing but does not replace disposable VM-grade isolation for untrusted public APKs. Require default-deny egress, quotas, per-job isolation, process-tree cleanup, patched emulator images, signed worker identity, lease expiry and artifact retention.
6. **Keep public APK execution disabled** until isolation, ownership, abuse controls, storage boundaries and worker attestation are independently demonstrated.

## 5. Evidence required for judge-ready release

- [ ] Green CI: backend, PostgreSQL with all migrations, worker guards, frontend build/E2E, unified deployment build and container smoke.
- [ ] Green Android emulator workflow with evidence artifact: install/launch/logcat, measured persona readback, cleanup and negative cases.
- [ ] Real authenticated journeys for primary and secondary flows.
- [ ] Two-user authorization report proving cross-tenant denial for every private route/artifact.
- [ ] Production DB and private Storage round-trip evidence.
- [ ] Worker isolation/egress attestation plus lease/revocation/cleanup evidence.
- [ ] Live Sarvam evidence if those features are claimed to judges.
- [ ] Independent ML holdout validation and documented BharatScore/anomaly methodology.
- [ ] Browser E2E and manual responsive/accessibility review on deployed origin.
- [ ] Release notes, limitations, architecture, API contract and demo script updated to exact release SHA.

## 6. Judge-facing claim language until acceptance

- "BharatSim provides deterministic Android Logcat analysis with source-line evidence."
- "The risk planner generates explainable test priorities; it does not execute tests."
- "The Android worker can execute a controlled APK fixture in CI; arbitrary public APK execution is not enabled."
- "Latency/bandwidth control readback is distinct from proof that arbitrary app traffic traversed the shaped path."
- "RAM is measured/reported, not dynamically restricted; CPU throttling is unsupported."
- "ML and anomaly outputs are triage signals, not confirmed root causes or production field-accuracy guarantees."

Do not describe the project as fully production-ready until the acceptance evidence above exists. This is an engineering release gate, not a judgement of the project's potential.
