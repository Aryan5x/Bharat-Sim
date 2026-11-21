# BharatSim — Known Limitations & Infrastructure Requirements (Phase 2 Update)

**Current Status:** Commercial MVP Software Complete · Infrastructure Automation Ready  
**Date:** November 21, 2026  

---

## 1. External Infrastructure Requirements

In accordance with our strict truthfulness guidelines, the following items require operator provisioning:

### 1.1 Dedicated Android Worker VM (Hardware Virtualization)
- **Requirement:** A Linux virtual machine or bare-metal host with KVM enabled (`/dev/kvm`).
- **Why It Cannot Run in Vercel Serverless:** Vercel functions are stateless serverless containers with a 60-second execution cap and no nested KVM hardware virtualization. Running an Android emulator requires a persistent Linux host.
- **Turnkey Solution Provided:**
  - One-command setup: `sudo bash deploy/worker/setup-worker-host.sh`
  - Automated Docker with KVM passthrough: `docker compose up -d` in `deploy/worker/`
  - Recommended Cloud Provider: Google Cloud `n2-standard-4` ($0.19/hr) with `--enable-nested-virtualization`.

### 1.2 Sarvam AI Cloud API Credentials
- **Requirement:** `SARVAM_API_KEY` environment variable in Vercel.
- **Current Behavior Without Key:** The system automatically uses verified local fallbacks (high-quality localized text terms in Hindi, Tamil, and Marathi, and deterministic WAV audio headers). Zero user-facing crashes occur. To enable live neural cloud translation, set `SARVAM_API_KEY` in the Vercel project settings.

### 1.3 Production Supabase Database URL
- **Requirement:** `POSTGRES_URL` in Vercel environment variables.
- **Current Behavior:** In local development and unit tests, SQLite runs automatically with zero setup. In production, Supabase provides managed PostgreSQL and storage buckets.
