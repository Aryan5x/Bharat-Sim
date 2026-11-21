# ArgosX Security Scan & Remediation Report

## Executive Summary

BharatSim underwent comprehensive security audits aligned with the ArgosX security review mandate for the hackFront India Grand Finale. The application implements defense-in-depth across frontend, backend, worker infrastructure, and database layers.

---

## 1. Baseline vs. Final Scan Status

| Scan Milestone | Date | Critical Findings | High Severity | Medium Severity | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline Scan** | 21 Nov 2026 | 0 | 2 (Resolved) | 3 (Resolved) | Remediated |
| **Final Scan** | 22 Nov 2026 | 0 | 0 | 0 | **PASS (Clean)** |

---

## 2. Remediated Vulnerabilities & Hardening Steps

### Finding 1: Unrestricted CORS / Missing Security Headers
- **Severity**: High
- **Vulnerability**: Default permissive CORS configuration allowed arbitrary web origins to communicate with backend APIs.
- **Remediation**:
  - Implemented strict CORS origins in [`backend/app/main.py`](file:///backend/app/main.py).
  - Enforced modern HTTP security response headers on all API endpoints:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `X-XSS-Protection: 1; mode=block`
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
    - `Referrer-Policy: strict-origin-when-cross-origin`

### Finding 2: Server-Side Secret Key Leakage Prevention
- **Severity**: High
- **Vulnerability**: Risk of leaking Supabase `service_role` key or `SARVAM_API_KEY` to client-side bundles.
- **Remediation**:
  - Strict boundary isolation: Service keys and external partner API tokens are stored strictly in server-side environment variables (`SUPABASE_SECRET_KEY`, `SARVAM_API_KEY`).
  - Frontend bundle auditing confirms zero `VITE_` variables expose privileged secrets; frontend only receives the public anon key for Supabase Auth exchange.

### Finding 3: Multi-Tenant Data Isolation & Database Row Level Security (RLS)
- **Severity**: Medium
- **Vulnerability**: Risk of cross-tenant APK or test run data access.
- **Remediation**:
  - All database queries for runs, uploads, and reports enforce user session isolation via Supabase Auth JWT verification.
  - Supabase PostgreSQL schema implements Row Level Security (RLS) with `auth.uid() = user_id` policies on `runs`, `apks`, and `reports` tables.

### Finding 4: File Signature & Magic Byte Validation on Uploads
- **Severity**: Medium
- **Vulnerability**: Arbitrary file upload risks where non-ZIP/APK files could be submitted with `.apk` extension.
- **Remediation**:
  - Added binary ZIP magic byte validation (`PK\x03\x04` / `0x04034b50`) on all uploaded APKs before parsing manifests.
  - Enforced file size limits (default 50MB, serverless fallback 4MB) to prevent Denial of Service (DoS) attacks.

### Finding 5: Parameterized Database Queries & Connection Pooling
- **Severity**: Medium
- **Vulnerability**: SQL injection risk and Supabase connection pool exhaustion.
- **Remediation**:
  - All SQL queries use strictly parameterized placeholders (`%s`).
  - Configured psycopg connection pooler compatibility with `prepare_threshold=None` for Supabase Transaction Pooler (port 6543).

---

## 3. Worker Execution Sandboxing
- Workers poll isolated tasks and execute them on dedicated emulator instances.
- Android ADB automation runs with bounded bounds and restricted permissions (`monkey` throttled with no system key access).
- No arbitrary remote shell commands are accepted from unauthenticated web clients.
