# BharatSim — production readiness and evidence audit

**Audit date:** 22 November 2026 (IST)  
**Current release decision:** controlled beta; **NO-GO for public arbitrary APK execution**.  
**Current code PR:** [#146](https://github.com/kaustubhdua/Bharat-Sim/pull/146) — open, not merged.

This document distinguishes repository implementation, CI fixture evidence, connected production control-plane observations and acceptance that still requires live infrastructure. A green build or configured capability is not proof of a customer APK completing a production journey.

## Executive status

| Area | Verified now | Not yet accepted |
|---|---|---|
| Supabase project identity | Vercel's browser URL and server-side URL metadata comments identify `hkyieaovolkethovyenb` (`common 1`) as the canonical active project; its `bharatsim` schema is separate from `genomeguard`. | Decrypted Vercel DB URL target and live Vercel runtime connection. |
| BharatSim schema | All nine repository BharatSim migrations are recorded; latest `runs` and `workers` columns are present. | Production API restart/persistence through the deployed Vercel runtime. |
| PostgreSQL | A synthetic run row was inserted, read in a separate query, and deleted; final run count is zero. | Same round-trip through the deployed API and independent invocations. |
| APK Storage | `bharatsim-private` exists, is private, and has a 150 MiB per-object limit. | Server-only Storage credential is absent from the visible Vercel environment inventory; no object lifecycle has been demonstrated. |
| Authentication | Supabase browser URL and publishable key are configured; API JWT verification and owner-scoped query paths exist. | Two real accounts and live cross-tenant denial matrix. |
| Android CI | A source-built fixture APK is uploaded to a local API, leased, downloaded, installed/launched and reported back in CI. | Production worker host, customer APK and per-job isolation. |
| Network evidence | Android CI fixture verifies the shaped HTTPS traffic path through proxy telemetry. | Per-run measurements for arbitrary customer APK traffic; only proxy-routed traffic is shaped. |
| Failure DNA / FixProof | Repeated-input fingerprint and repeated-verdict regression tests exist. | Repeated real emulator/customer-app executions with persisted evidence. |
| ML | 48-example hand-authored holdout is included; dry-run result is 79.2% accuracy and about 0.787 macro-F1. | Independent external labels, larger holdout, class-wise report and calibration; this is not field accuracy. |
| Sarvam | Production variable name exists; earlier live evidence recorded Hindi/Hinglish/Tamil interpretation plus Hindi/Tamil TTS/STT responses. | Fresh deployed Vercel provider call and browser audio playback. |
| Accessibility | Responsive Playwright widths and basic semantic/accessibility smoke tests are in CI. | Manual keyboard, screen-reader, focus, contrast and real-device review. |
| Deployment | Unified Vercel build and container smoke pass on previously tested heads. | Exact final PR SHA deployed to Production and authenticated production smoke. |

## Current Production API probe — 22 Nov 2026

A live GET against the deployed Production API returned:
- `GET /health/ready`: HTTP 503; `status=not_ready`, `database=unavailable`, `private_storage=unavailable`, `authentication=configured`, `apk_execution_worker=not_configured`, `worker_online=false`.
- `GET /api/v1/capabilities`: HTTP 200; log analysis, risk planner, Failure DNA and evaluator scenarios are enabled, but `database_persistence=false`, `apk_upload=false`, `analysis_persistence=false`, `run_comparison=false`, `worker_dispatch=false`, `android_execution=false`, `sarvam_translation=false` and `sarvam_audio_tts=false`.

The production deployment currently points to commit `76f5b7e6`, not the current release PR. The runtime probe is the authoritative statement of what the deployed service can do today; environment-variable presence and direct SQL access from the Supabase connector do not override it.

## 1. Authoritative Supabase project and schema

The Vercel project `bharat-sim-81g2` is configured with browser `VITE_SUPABASE_URL=https://hkyieaovolkethovyenb.supabase.co`. Its environment metadata comment identifies this as the canonical active Supabase project for BharatSim browser Auth and private Storage. The server-side `SUPABASE_URL` metadata comment identifies the same canonical project. The connected Supabase account lists `common 1` (`hkyieaovolkethovyenb`) as `ACTIVE_HEALTHY`.

The project is shared at the Supabase project level with GenomeGuard, but BharatSim tables are isolated in the `bharatsim` schema. No GenomeGuard tables or migrations were changed during this audit.

All nine BharatSim migrations are now recorded in the connected project:
- core schema and FK indexes
- private APK bucket and signed-upload sizing
- custom persona/APK metadata
- worker claim/status fields
- run scenario metadata
- large APK part metadata
- personal worker ownership/key metadata

Live schema inspection confirms `runs.persona_json`, `runs.apk_meta_json`, `runs.scenario_json`, and the current personal-worker ownership/key columns are present.

### PostgreSQL verification

A synthetic `bharatsim.runs` row was inserted using the current schema, read in a separate database query, then deleted. The final live counts observed were zero runs, zero analyses, zero workers and zero artifacts. The test row was removed.

This verifies direct connectivity to the connected Supabase database and its current schema. It does **not** prove that the deployed Vercel API's masked `BHARATSIM_DATABASE_URL` connects to this same database or that its process survives an API restart. Vercel masks the sensitive URL value, so its host/credentials were not inspected.

## 2. Private APK Storage and production credentials

The `bharatsim-private` bucket is confirmed non-public with a 150 MiB per-object limit. The configured total upload cap is now 500 MiB, with 45 MiB multipart objects. The bucket currently has zero APK objects.

The Vercel environment inventory has no `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Backend code deliberately requires one of these server-only credentials for private Storage operations. The public/publishable browser key is not a substitute.

Therefore these operations remain unverified:
1. signed private upload
2. server-side size and SHA-256 verification
3. multipart APK assembly/retention
4. authenticated worker download
5. report/artifact persistence and reopen
6. delete, expiry and cleanup

**Required owner action:** add a Supabase Secret key (preferred) or legacy service-role key as a Production-only Vercel environment variable named `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Never put it in a `VITE_*` variable, source control or chat. Then redeploy and run the private Storage lifecycle test.

The bucket's lack of user-facing Storage policies is fail-closed for direct user access; the intended backend path uses a server-only privileged key. Do not add broad public/anon Storage policies to work around the missing server key.

## 3. Authentication and tenant isolation

Implemented:
- Supabase session, sign-in/sign-up, refresh and sign-out code
- API-side JWT verification
- owner-scoped run, report and worker query paths
- isolated BharatSim database schema and ownership columns

Not production-accepted:
- Supabase Auth leaked-password protection is currently disabled (Supabase security advisor WARN); enable it in Auth settings before broad public signup.
- two real user accounts
- cross-user list/read/update/delete denial for runs, analyses, artifacts and worker keys
- signed URL owner/path binding, replay and expiry tests
- account confirmation, expiry and recovery acceptance against the live Auth project

The database advisor reports RLS-enabled tables without policies in the private BharatSim and GenomeGuard schemas. These schemas are used through the backend's direct PostgreSQL connection, not intended as unrestricted browser Data API tables. Keep direct database credentials server-only and do not expose the schemas through the Data API without a separate RLS/policy review.

## 4. Android worker and APK-to-report journey

The Android emulator workflow is meaningful CI evidence: it starts a local API, registers an authenticated worker, uploads a source-built fixture APK, leases/downloads/installs/launches it, persists a report callback, and checks invalid-manifest/install failures. A separate HTTPS proxy fixture verifies measured traffic-path telemetry.

This is **not** a production worker deployment. No dedicated KVM-capable host with per-job Firecracker/microVM isolation and default-deny egress is currently attested. The personal laptop worker is owner-scoped convenience execution, not a multi-tenant sandbox.

Required before public arbitrary APK execution:
- dedicated KVM-capable worker host
- per-job disposable isolation, default-deny egress and resource quotas
- signed worker identity, lease/revocation, process-tree cleanup and teardown
- patched Android emulator image and host
- production private Storage lifecycle
- full authenticated APK → worker → report → reopen/export journey on Production
- independent security review and attestation

Keep all three production flags false until the above evidence exists:
- `BHARATSIM_PUBLIC_APK_EXECUTION_ENABLED=false`
- `BHARATSIM_WORKER_ISOLATION_ATTESTED=false`
- `BHARATSIM_WORKER_EGRESS_RESTRICTED=false`

Do not use Vercel functions, the API host, a personal laptop or shared GitHub runners as a sandbox for arbitrary public APKs.

## 5. Feature validation still required

### Network conditions
The full engine uses Android's system proxy for latency, bandwidth and packet-loss stalls/resets; only apps that use that proxy are shaped. Outage/recovery is a separate airplane-mode check. CI fixture telemetry previously recorded `traffic_path_verified=true`, baseline median 890 ms, bandwidth-only median 1,431 ms (+541 ms), and injected latency samples around 150.5 ms. These are fixture measurements, not a universal app-performance claim.

### Failure DNA and FixProof
Unit regressions verify stable fingerprints across timestamp/PID variation and consistent FixProof verdicts across repeated synthetic candidates. Still required: repeated emulator executions of the same APK/scenario, persisted original/candidate reports and a reproducible comparison.

### ML classifier
The 48-example hand-authored holdout dry-run produced 79.2% accuracy and about 0.787 macro-F1; normal-class recall was 0.50. Treat this as a small regression set, not independent field validation. Required: independently labelled external holdout, leakage review, confusion matrix, per-class precision/recall, calibration and model versioning.

### Sarvam
A production environment variable named `sarvam_api` exists. Prior live evidence records five Hindi/Hinglish/Tamil interpretation responses and non-fixture Hindi/Tamil TTS/STT calls. The current Vercel provider credential value is masked and a fresh deployed Vercel request/audio playback has not been verified. Do not claim current provider health based only on variable presence.

### Accessibility and responsive behavior
CI covers 320–1440 px layout checks, main landmark, accessible control names and image alt text. Manual keyboard-only navigation, screen-reader flow, focus visibility, contrast and reduced-motion review remain outstanding.

## 6. CI and deployment evidence

The latest code PR is #146. A previously validated code SHA `93ecced18a273bf9c206eb60aab1b1e9f03c3b65` passed seven CI jobs (backend 253 passed/2 skipped, frontend 61 passed, PostgreSQL 3 passed, E2E 14 passed, worker guards, unified Vercel build and container smoke) and the Android emulator workflow. Subsequent changes corrected public landing/preview routing and are being revalidated on the current PR head; use the current run links on the PR rather than treating the earlier SHA as final verification.

The Vercel Production deployment observed during this audit still targets `76f5b7e6` on `main`. Environment edits apply to the next deployment, not already-running functions. Deploy the exact merged SHA and verify `/health/live`, `/health/ready`, Auth, API and browser flows before declaring release.

## 7. Release decision

BharatSim has a substantial working implementation and meaningful automated fixture coverage. It is **not fully production-complete** while the server-only Storage credential, production API-to-database verification, two-account isolation, dedicated isolated worker, customer APK journey, repeated real-run validation, fresh production Sarvam check and manual accessibility review remain open.

Public arbitrary APK execution must remain disabled. Judges can be shown the controlled fixture journeys and should be told clearly which results are CI-fixture evidence, measured proxy-path evidence, heuristic analysis and still-unverified production behavior.
