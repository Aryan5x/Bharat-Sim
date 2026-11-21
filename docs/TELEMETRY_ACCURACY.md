# BharatSim — Telemetry and Measurement Accuracy Audit

**Auditor:** Performance Testing & Systems Reliability Team  
**Scope:** Real Android Hardware / Emulator Telemetry Sources  

---

## 1. Telemetry Sources & Accuracy Profile

BharatSim guarantees that every reported number reflects a verifiable diagnostic query against Android subsystem interfaces rather than an ungrounded estimate.

| Metric | Subsystem Query | Sampling Mode | Unit | Truthfulness / Limitation Status |
|---|---|---|---|---|
| **Cold Start Latency** | `am start -W` or ActivityManager logcat | Single Launch Event | milliseconds (ms) | **Actual Measurement** (Time from launch intent to first draw) |
| **Frame Jank Percentage** | `dumpsys gfxinfo <package>` | Window Aggregate | percentage (%) | **Actual Measurement** (Janky frames / Total frames rendered $\times 100$) |
| **Total Frames Rendered** | `dumpsys gfxinfo <package>` | Window Aggregate | integer count | **Actual Measurement** (Frames produced by RenderThread) |
| **Slow UI Thread Frames** | `dumpsys gfxinfo <package>` | Window Aggregate | integer count | **Actual Measurement** (Frames where Choreographer delayed vsync) |
| **Peak Memory (Total PSS)** | `dumpsys meminfo <package>` | Periodic Snapshot | Megabytes (MB) | **Actual Measurement** (Proportional Set Size accounting for shared memory) |
| **Java Heap Memory** | `dumpsys meminfo <package>` | Periodic Snapshot | Megabytes (MB) | **Actual Measurement** (Dalvik / ART heap allocation) |
| **Native Heap Memory** | `dumpsys meminfo <package>` | Periodic Snapshot | Megabytes (MB) | **Actual Measurement** (C++ / jemalloc allocation) |
| **Network Latency (Control Plane)** | `emu network status` | Console Readback | milliseconds (ms) | **Verified Control Plane Setting** (Read back from QEMU emulator socket) |
| **Network Latency (Data Plane)** | In-App HTTP Probe | End-to-End Ping | milliseconds (ms) | **Verified when fixture is used**; marked unverified for arbitrary customer APKs without built-in probe |
| **Storage Pressure** | `df /data` | Filesystem Query | Kilobytes (KB) | **Actual Measurement** (Remaining free disk space on `/data` partition) |

---

## 2. Missing-Data Behavior & Honest Display

1. **Never Display Synthetic Defaults as Zero:** If a metric (e.g. `gfxinfo`) cannot be collected because an app crashed before rendering its first frame, BharatSim records `null` rather than `0.0%`.
2. **UI Communication:** The frontend dashboard explicitly renders missing metrics with a designated `—` dash and a tooltip explaining `"Not recorded for this run"`.
3. **Run Comparison Safety:** `POST /api/v1/runs/compare` checks intersection of common metrics between baseline and constrained runs. If no overlapping metrics exist, it returns `422 Unprocessable Entity` with a clear explanation rather than inventing artificial delta numbers.

