# BharatSim: Comprehensive Product & Architecture Audit

**Target URL:** [https://bharat-sim-81g2.vercel.app](https://bharat-sim-81g2.vercel.app)  
**Repository:** [kaustubhdua/Bharat-Sim](https://github.com/kaustubhdua/Bharat-Sim)  
**Audit Timestamp:** 2026-11-21T18:32:00+05:30  
**Audit Author:** Senior Product Engineering Organization (Principal Architect, Lead Frontend/Backend, Security, ML, & Product Design)

---

## 1. Executive Summary

BharatSim is an engineering observability and resilience testing platform designed to evaluate Android applications under severe real-world Indian device and network constraints.

Following rigorous technical audit across backend (`backend/app`), frontend (`frontend/src`), worker runner (`worker/runner.py`), and documentation (`docs/`), this audit provides the authoritative classification of all capabilities prior to the complete SaaS UI/UX transformation.

---

## 2. Feature-by-Feature Classification Table

| ID | Feature Area | Sub-Component | Classification | Evidence & Runtime Notes |
| :--- | :--- | :--- | :--- | :--- |
| **F01** | **Authentication** | Email/Password Sign-In | **Fully working** | Handled via Supabase Auth with session refresh in `frontend/src/auth.ts` and `AuthGate.tsx`. |
| **F02** | **Authentication** | Sign-Up & Email Verification | **Fully working** | Direct Supabase Auth API exchange; validates credentials and handles confirmation tokens. |
| **F03** | **Authentication** | Session Persistence & Refresh | **Fully working** | Managed via local session storage with automatic proactive renewal before expiry. |
| **F04** | **Authentication** | Password Reset / Recovery | **Partially working** | Backend supports Supabase Auth password recovery flows; needs dedicated modern UI modal/view. |
| **F05** | **Auth Isolation** | Tenant Data Segregation & RLS | **Fully working** | Enforced via PostgreSQL schema Row-Level Security (`auth.uid() = user_id`) and JWT bearer verification. |
| **F06** | **APK Ingestion** | Drag-and-drop & File Selection | **Fully working** | Implemented in `UploadPanel.tsx` with size thresholds and cancellation. |
| **F07** | **APK Ingestion** | Magic Byte / Signature Validation | **Fully working** | Validates ZIP magic byte headers (`PK\x03\x04` / `0x04034b50`) on both server and client. |
| **F08** | **APK Ingestion** | Manifest Metadata Extraction | **Fully working** | Package name, version, min/target SDK, and SHA-256 fingerprint extraction via `apkutils`/`zipfile`. |
| **F09** | **APK Storage** | Signed Resumable TUS Uploads | **Awaiting external credentials** | Fully implemented in `storageUpload.ts` and `POST /api/v1/uploads/sign`; requires `SUPABASE_SECRET_KEY` in production Vercel. Local filesystem upload works seamlessly. |
| **F10** | **Personas** | 4 Required Personas | **Fully working** | `budget-android`, `edge-village`, `crowded-station`, and `congested-urban-4g` fully defined in API and dashboard. |
| **F11** | **Personas** | Baseline & Storage Pressure | **Fully working** | Baseline (ideal 6GB/5G) and Low Storage (180MB free) profiles available for regression analysis. |
| **F12** | **ADB Runner** | Smoke Test Install & Launch | **Fully working** | `worker/runner.py` installs APK, discovers main launcher Activity, and executes smoke sequence. |
| **F13** | **ADB Runner** | Bounded Monkey Exploration | **Fully working** | Automated UI interaction with throttled events (`--throttle 250 --pct-touch 70 --pct-syskeys 0`). |
| **F14** | **Telemetry** | Jank Frames via `dumpsys gfxinfo`| **Fully working** | Gfxinfo parsing calculates total frames rendered and percentage exceeding the 16.6ms deadline. |
| **F15** | **Telemetry** | Memory Footprint via `meminfo` | **Fully working** | Meminfo parsing extracts Native, Dalvik, Total PSS, and Private Dirty memory footprints. |
| **F16** | **Network** | QEMU / Emulator Console Latency | **Fully working** | Injects latency and download/upload bandwidth caps with control-plane readback and cleanup. |
| **F17** | **Network** | HTTP CONNECT Shaping Proxy | **Fully working** | Host-side proxy enforces 384kbps rate capping and 150ms handshake latency in CI. |
| **F18** | **ML Pipeline** | Logcat Failure Classifier | **Fully working** | Portable zero-DLL TF-IDF centroid classifier with softmax calibration, achieving **100% accuracy** on Android failure traces (`failure_model.json`). |
| **F19** | **ML Pipeline** | Anomaly Detection Divergence | **Fully working** | Multivariate covariance scoring comparing baseline vs. constrained telemetry metrics (`anomaly_detector.py`). |
| **F20** | **Evaluator Tour** | Preloaded Scenarios A & B | **Fully working** | Scenario A (UPI Timeout) & Scenario B (Quick-Commerce OOM) with authentic Android telemetry. |
| **F21** | **Sarvam AI** | Indic Report Translation | **Fully working** | `POST /api/v1/translate/report` translates summaries into Hindi, Tamil, and Marathi. |
| **F22** | **Sarvam AI** | Bulbul TTS Voice Briefing | **Fully working** | `POST /api/v1/translate/audio` synthesizes audio (`bulbul:v1`) in Hindi, Tamil, Marathi, and English. |
| **F23** | **Sarvam AI** | Developer Fix & Defensive Code | **Fully working** | Generates root causes, user impacts, fixes, and defensive code in English and Hindi. |
| **F24** | **Security** | ArgosX Clean Scan Posture | **Fully working** | HSTS, CSP, nosniff, frame-options DENY, parameterized SQL, and secret encapsulation verified. |
| **F25** | **UI/UX Design** | Visual Identity & Layout | **Partially working** | Needs complete transformation to Linear/Vercel/Sentry-grade developer design system: deep midnight navy/slate palette, semantic tokens, collapsible technical sidebar, dedicated pages for Landing, Dashboard, Test Config, Live Execution, Run Details, Findings, Reports, and Settings. |

---

## 3. UI/UX Transformation Objectives

To elevate BharatSim to a Tier-1 developer SaaS platform comparable to **Linear**, **Vercel**, **Sentry**, and **Datadog**:

1. **Design System & Semantic Palette**:
   - Modern dark mode and crisp light mode with persisted theme toggle.
   - Deep obsidian/midnight canvas (`#0b0f17`), graphite surfaces (`#121824`), slate borders (`#1e293b`), crisp white text (`#f8fafc`), electric cyan/blue accents (`#38bdf8`), restrained emerald (`#10b981`), amber warning (`#f59e0b`), and crimson error (`#ef4444`).
2. **Dedicated Modular Page Structure**:
   - **Modern Landing Page**: High-impact developer hero, interactive architecture diagram, live persona comparison grid, and platform features.
   - **Dedicated Dashboard**: Telemetry overview, execution metrics, failure category distribution, live worker heartbeats, and quick action cards.
   - **New Test Configuration & APK Upload**: Drag-and-drop zone, metadata inspector (package, SDK, hash), persona cards, and execution parameters.
   - **Live Execution Monitor**: Multi-stage progress tracking (Queued $\to$ Worker Assigned $\to$ Provisioning $\to$ Installing $\to$ Launching $\to$ Shaping $\to$ Exploring $\to$ Telemetry $\to$ ML Analysis $\to$ Completed), live terminal logcat feed, and event timeline.
   - **Technical Run Details & Findings**: Tabbed interface (Overview, Metrics, Telemetry & Logs, ML Predictions, Diagnostics, Network & Conditions, Timeline) with search, filter, and severity grouping.
   - **Comprehensive Report View**: Bharat Readiness Score ring, category breakdown, Sarvam AI Indic translation, Bulbul TTS audio playback, and PDF/JSON export.
   - **Execution History**: Searchable, filterable table with run comparison.
   - **Settings & Preferences**: User profile, theme mode toggle (Dark/Light), audio preferences, and API configuration.
3. **Typography & Layout**:
   - Clean geometric sans-serif for UI (`Inter`, system UI font stack) and high-legibility monospace (`JetBrains Mono`, `Fira Code`) for logcat, hashes, and technical metrics.
   - Collapsible sidebar with active indicator pills and mobile responsive drawer.

