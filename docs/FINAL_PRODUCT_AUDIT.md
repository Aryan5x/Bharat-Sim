# BharatSim — final product audit (current)

**Audit date:** 22 November 2026  
**Current PR:** [#146](https://github.com/kaustubhdua/Bharat-Sim/pull/146)  
**Decision:** controlled beta; no-go for public arbitrary APK execution.

## Product work integrated in the release branch

- Removed the Overview capability/worker-contract panel.
- Removed the JanJeevan scenario catalog from Speak-to-Test while preserving scenario lookup and the controlled BharatPay original/fixed execution path.
- Removed pairwise hypothesis cards and related planner statistics while retaining the risk-ranked planner and JSON export.
- Moved Platform Showcase to the first sidebar navigation position.
- Preserved the newer typed-problem diagnosis flow and evidence-cited guidance.
- Corrected claims about legacy smoke vs full engine, system-proxy traffic scope, unsupported CPU throttling, heuristic anomaly scoring and uncalibrated ML triage scores.
- Fixed the Sarvam translation key resolver to accept the supported lowercase `sarvam_api` alias.
- Added repeated Failure DNA/FixProof regressions, a 48-example hand-authored classifier holdout, worker APK-size contract tests and accessibility smoke checks.
- Corrected the public product tour and public planner preview route so the product landing is public while private workspace routes remain gated.

## Connected infrastructure evidence

- Canonical active Supabase project: `hkyieaovolkethovyenb` (`common 1`, ap-south-1), identified by Vercel environment metadata. BharatSim uses an isolated `bharatsim` schema alongside GenomeGuard.
- All nine repository BharatSim migrations are recorded. Current run/persona/scenario and personal-worker columns are present.
- Direct Supabase DB synthetic insert/read/delete succeeded; probe row was removed. Final observed counts are zero runs, analyses, workers and artifacts.
- Private `bharatsim-private` bucket is non-public, 150 MiB per object, and currently empty.
- Vercel upload cap is 500 MiB; code uses 45 MiB multipart parts.
- No server-only Supabase secret/service-role key appears in the Vercel environment inventory. Private APK Storage therefore remains unverified.
- Vercel's sensitive `BHARATSIM_DATABASE_URL`, `SUPABASE_URL` and `sarvam_api` values are masked. The deployed API connection and current Sarvam provider health cannot be inferred from their names.
- Production flags remain fail-closed: public APK execution=false, worker isolation attested=false, worker egress restricted=false.
- No dedicated KVM-backed isolated production worker host is deployed.

## CI evidence and current validation

A prior validated SHA `93ecced18a273bf9c206eb60aab1b1e9f03c3b65` passed seven CI jobs (backend 253 passed/2 skipped, frontend 61 passed, PostgreSQL 3 passed, Playwright E2E 14 passed, worker guards, unified build and container smoke) and the Android emulator fixture workflow. The Android fixture completed local API → worker registration/lease → APK download/install/launch → report callback and measured a source-built HTTPS proxy path.

The current PR head has subsequent routing and integration updates. Its latest CI, dependency audit and Android workflow must pass on the exact current SHA before merge. Previous green runs are not substitutes for the final head.

## Remaining release blockers

1. Add `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` as a server-only Vercel Production environment variable; verify upload/hash/download/delete/retention.
2. Verify Vercel's masked database URL targets the canonical Supabase project; run live API persistence across independent invocations and restart.
3. Complete a real two-account tenant-isolation matrix.
4. Provision a dedicated KVM host with per-job microVM isolation, default-deny egress, quotas and cleanup.
5. Complete an authenticated Production APK → worker → persisted report → reopen/export journey.
6. Measure real app traffic for every claimed network condition; repeat Failure DNA/FixProof on real runs.
7. Validate ML with independent external labels; current 48-case holdout is a small regression set (79.2% accuracy, ~0.787 macro-F1; normal recall 0.50).
8. Verify fresh deployed Sarvam interpretation, translation, STT, TTS and audio playback.
9. Complete manual keyboard, screen-reader, focus, contrast and real-device testing.
10. Deploy the exact merged SHA and pass Production health/Auth/API/browser smoke.

## Release guardrails

Do not enable public arbitrary APK execution until all P0 gates pass. Do not describe heuristic analysis or CI fixture evidence as production certification or customer-app validation.
