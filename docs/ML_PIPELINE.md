# BharatSim Machine Learning Pipeline

## Overview

BharatSim incorporates a purpose-built Machine Learning pipeline designed specifically for low-overhead, high-precision Android resilience diagnostics. The pipeline operates in two complementary stages:

1. **Failure Classification**: Real-time multi-class failure attribution from Android runtime traces and logcat streams into standardized failure categories:
   - `crash`: Fatal exceptions, unhandled runtime crashes, SIGSEGV, SIGABRT.
   - `anr`: Application Not Responding, Input dispatching timed out, Main thread lockups.
   - `oom`: OutOfMemoryError, lowmemorykiller (`lmkd`) SIGKILL, Bitmap allocation failures.
   - `network`: SocketTimeoutException, ConnectException, SSLHandshakeException, HTTP 504.
   - `storage`: SQLiteFullException, ErrnoException ENOSPC, disk quota exceeded.
   - `normal`: Routine lifecycle and non-fatal operational telemetry.

2. **Multivariate Telemetry Anomaly Detection**: Statistical covariance divergence scoring between baseline (unconstrained) and persona-constrained runs across 4 key telemetry dimensions:
   - Cold-start latency (ms)
   - Jank frame percentage (%)
   - Peak memory footprint (MB)
   - Round-trip network latency (ms)

---

## 1. Failure Classifier Architecture

### Model Design & Portability
To ensure deterministic execution across all deployment targets—including Vercel serverless environments, containerized workers, and Windows development sandboxes—the classifier is compiled into a self-contained, zero-external-DLL vector model:

- **Source Code**: [`backend/app/ml_classifier.py`](file:///backend/app/ml_classifier.py)
- **Model Definition**: [`backend/app/ml/failure_model.json`](file:///backend/app/ml/failure_model.json)
- **Metrics & Accuracy**: [`backend/app/ml/model_metrics.json`](file:///backend/app/ml/model_metrics.json)

### Training Pipeline
The model was trained using [`scripts/train_classifier.py`](file:///scripts/train_classifier.py) on a corpus of 58 authentic Android logcat failure traces.

- **Feature Extraction**: TF-IDF token vectorization with custom token regex `(?i)\b\w+\b`, Android-specific stopword removal, and minimum token length $\ge 3$.
- **Centroid Vector Formulation**: Normalized class centroid projection with softmax probability calibration:
  $$P(C_k \mid x) = \frac{\exp(s(x, C_k) / \tau)}{\sum_j \exp(s(x, C_j) / \tau)}$$
  where $s(x, C_k)$ is the cosine similarity between the input TF-IDF vector $x$ and class centroid $C_k$, with temperature parameter $\tau = 0.2$.

### Performance Metrics
Evaluated on training and holdout datasets:
- **Accuracy**: 100.0%
- **Weighted Precision**: 1.000
- **Weighted Recall**: 1.000
- **Weighted F1 Score**: 1.000
- **Inference Latency**: $< 1\text{ ms}$ per 1,000 log lines

---

## 2. Telemetry Anomaly Detection

### Logic & Statistical Scoring
The anomaly detector ([`backend/app/anomaly_detector.py`](file:///backend/app/anomaly_detector.py)) compares telemetry emitted during a constrained persona test against a baseline control run:

1. **Relative Divergence ($\Delta\%$):**
   $$\Delta\% = \frac{M_{\text{constrained}} - M_{\text{baseline}}}{M_{\text{baseline}}} \times 100$$
2. **Empirical Variance Normalization (Z-score Equivalent):**
   Each metric delta is normalized by empirical population variances derived from typical Android benchmarks:
   - Cold start ($\sigma = 350\text{ ms}$)
   - Jank frame percentage ($\sigma = 4.5\%$)
   - Peak memory ($\sigma = 80\text{ MB}$)
   - Network latency ($\sigma = 60\text{ ms}$)
3. **Multivariate Composite Anomaly Score:**
   $$\text{Anomaly Score} = \min\left(100, \sum_i w_i \cdot \max(0, z_i) \times 12.5\right)$$
   A score $\ge 35$ or any metric with $z \ge 2.5$ flags an anomalous regression.

---

## 3. Integration with Sarvam AI

When an anomaly or failure is detected, the classifier triggers [`backend/app/sarvam.py`](file:///backend/app/sarvam.py) to generate:
1. **Plain-Language Root Cause & Remediation** in English and Hindi.
2. **Defensive Code Fixes** (e.g. `BitmapFactory.Options.inSampleSize`, `ExponentialBackoffRetry`).
3. **Voice Audio Briefings** via Sarvam AI Bulbul TTS (`/api/v1/translate/audio`).

