# BharatSim — Security & OWASP ASVS Audit Report

**Security Standard:** OWASP Application Security Verification Standard (ASVS) Level 2  
**Audit Scope:** Authentication, Authorization, File Ingestion, Data Isolation, Header Security  
**Test Suite:** `backend/tests/test_security.py` (10 passed)  

---

## 1. Security Controls & Audit Findings

### 1.1 Tenant Isolation & Access Control (ASVS V4)
- **Finding:** Multi-tenant runs and analyses must be strictly inaccessible across user boundaries.
- **Verification:**
  - `owner_id` is derived strictly from verified Supabase JWT claims (`sub` field).
  - All SQL queries use parameterized clauses (`WHERE owner_id = ?`).
  - Cross-user queries return HTTP `404 Not Found` rather than `403 Forbidden` to prevent object enumeration.
  - Verified in `backend/tests/test_security.py::test_owner_isolation`.

### 1.2 File Upload & Ingestion Security (ASVS V12)
- **APK ZIP Structure Validation:**
  - Validates ZIP header (`PK\x03\x04`).
  - Checks for presence of `AndroidManifest.xml`.
  - Rejects Zip-Slip attacks (path traversal in entry filenames containing `../` or absolute paths).
  - Rejects Zip-Bomb attacks (enforces maximum decompression ratio of 100:1 and maximum uncompressed size).
  - Verified in `backend/tests/test_security.py::test_rejects_zip_slip`.

### 1.3 CORS & HTTP Headers
- **CORS Configuration:** Configured to allow credentials only from trusted frontend origins.
- **Security Headers:** Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`.

### 1.4 Worker Protocol Authentication
- **Worker Secret:** Workers must present `Authorization: Bearer <BHARATSIM_WORKER_TOKEN>` on all `/internal/worker/*` endpoints.
- **Safety Gate:** The worker daemon requires three explicit flags (`BHARATSIM_ENABLE_LOCAL_APK_EXECUTION=true`, `ANDROID_SERIAL=<id>`, `BHARATSIM_WORKER_TOKEN=<token>`) before executing untrusted binaries on test hosts.

