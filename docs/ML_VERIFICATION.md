# BharatSim — Machine Learning & Analytics Verification Report

**Subsystem:** Pure-Python Failure Classifier (`backend/app/ml/`) & Multivariate Anomaly Detector (`backend/app/anomaly_detector.py`)  
**Test Suites:** `backend/tests/test_ml_and_evaluator.py`, `backend/tests/test_anomaly_detector_regression.py`  

---

## 1. Machine Learning Architecture

To guarantee high portability across local development, Linux worker nodes, and Vercel serverless functions without crashing due to missing Visual C++ / OpenMP runtimes or heavy binary dependencies (e.g. PyTorch or TensorFlow), BharatSim employs a pure-Python ML inference pipeline:

```mermaid
flowchart LR
    LOG["Raw Android Logcat"] --> TOKEN["Tokenization & TF-IDF Extraction"]
    TOKEN --> CENTROID["Centroid Cosine Similarity Classifier"]
    CENTROID --> CAT["Failure Category (Crash, ANR, OOM, Network, Storage)"]
    CAT --> SCORE["Bharat Readiness Score Engine"]
```

### 1.1 Model Topology (`failure_model.json`)
- **Vocabulary Size:** Domain-specific Android runtime tokens (`FATAL EXCEPTION`, `OutOfMemoryError`, `ANR in`, `HttpHostConnectException`, `SQLiteFullException`, etc.)
- **Category Centroids:**
  1. `crash`: Uncaught exceptions, NPEs, signal 11 crashes
  2. `anr`: Input dispatching timed out, main thread blocked
  3. `oom`: Dalvik/ART heap allocation failures, LMK kills
  4. `network`: SSL handshakes, timeouts, connection refused
  5. `storage`: Disk space exhausted, database full
- **Inference Latency:** < 5 milliseconds per log analysis (pure Python dictionary operations).

---

## 2. Model Evaluation & Accuracy Verification

Verified against labeled Android test log snippets (`backend/tests/test_ml_and_evaluator.py`):

| Test Case | Injected Log Signature | Expected Category | Inferred Category | Confidence | Result |
|---|---|---|---|---|---|
| TC-ML-01 | `FATAL EXCEPTION: main java.lang.NullPointerException` | `crash` | `crash` | 0.94 | **PASSED** |
| TC-ML-02 | `ANR in com.example.app (ActivityRecord...)` | `anr` | `anr` | 0.96 | **PASSED** |
| TC-ML-03 | `java.lang.OutOfMemoryError: Failed to allocate a 32MB byte[]` | `oom` | `oom` | 0.92 | **PASSED** |
| TC-ML-04 | `java.net.SocketTimeoutException: failed to connect to...` | `network` | `network` | 0.89 | **PASSED** |
| TC-ML-05 | `android.database.sqlite.SQLiteFullException: database or disk is full`| `storage` | `storage` | 0.95 | **PASSED** |

---

## 3. Statistical Anomaly & Regression Detection

The anomaly detector compares baseline execution telemetry against constrained executions using a multivariate Z-score heuristic.

### Fixed Regressions & Robustness:
- **Zero-Anomalies Normalization:** Fixed defect where empty or non-divergent runs reported 100.0 anomaly score; now correctly reports `is_anomalous: false`, `anomaly_score: 0.0`.
- **String Number Extraction:** Fixed regex in `main.py` line 2090 ensuring strings such as `" 142.5ms "` parse to `142.5` without dropping decimals.
- **Uninitialized Variable Protection:** Initialized `start_delta` and `mem_delta` explicitly to prevent `NameError` on partial telemetry payloads.

