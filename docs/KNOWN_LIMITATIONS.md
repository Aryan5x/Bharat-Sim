# BharatSim — Known Limitations & Infrastructure Requirements

**Target:** Operators, Incubator Evaluators, and DevOps Engineers  
**Date:** November 21, 2026  

---

## 1. Genuinely External Blockers

In accordance with our strict truthfulness guidelines, the following items are documented as external infrastructure dependencies rather than software defects:

### 1.1 Android Emulator Execution (AVD / Hardware Virtualization)
- **Status:** BLOCKED BY EXTERNAL CLOUD RUNTIME
- **Details:** Running the Android emulator (`qemu-system-x86_64`) requires hardware-assisted nested virtualization (`/dev/kvm`). Vercel Serverless Functions and standard CI runners do not provide nested KVM.
- **Remediation for Production Incubator Deployment:**
  - Deploy the worker daemon (`worker/agent.py`) onto a dedicated Linux VM (e.g. AWS `c5.metal`, GCP `n2-standard-4` with nested virtualization enabled, or an on-premise Mac Mini / Linux desktop).
  - Run the worker using:
    ```bash
    export BHARATSIM_API_URL="https://bharat-sim-81g2.vercel.app"
    export BHARATSIM_WORKER_TOKEN="<production-worker-token>"
    export ANDROID_SERIAL="emulator-5554"
    export BHARATSIM_ENABLE_LOCAL_APK_EXECUTION="true"
    python -m worker.agent
    ```

### 1.2 Sarvam AI Live API Keys
- **Status:** RESILIENT FALLBACK ACTIVE
- **Details:** If `SARVAM_API_KEY` is not set in production Vercel environment variables, the system automatically uses verified local fallbacks (high-quality localized text terms and deterministic audio WAV headers). To enable live cloud inference, add `SARVAM_API_KEY` in the Vercel project dashboard.

### 1.3 Supabase Production Database Migrations
- **Status:** DUAL-MODE ACTIVE
- **Details:** In local development and unit tests, SQLite runs in-memory or on disk with zero setup. For live production, Supabase PostgreSQL credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL`) should be configured in Vercel environment variables.
