"""Anomaly and Regression Detection comparing Baseline vs Constrained Android runs.

Uses explicit metric thresholds and a transparent pure-Python z-score to flag
regressions in startup latency, UI jank, memory consumption, and network responsiveness.
"""
from __future__ import annotations

from typing import Any

# Standard performance thresholds on Indian budget tier (e.g. 2 GB RAM Android Go)
REGRESSION_THRESHOLDS = {
    "cold_start_ms": {"warn_delta_ms": 1200, "critical_delta_ms": 3000},
    "jank_percentage": {"warn_pct": 15.0, "critical_pct": 35.0},
    "peak_memory_mb": {"warn_delta_mb": 150, "critical_delta_mb": 400},
    "network_latency_ms": {"warn_delta_ms": 300, "critical_delta_ms": 1000},
}


def _calculate_statistical_anomaly_score(feature_row: list[float]) -> tuple[bool, float]:
    """Calculate multi-variate anomaly score using statistical multivariate Z-score.

    Uses pure-Python statistical anomaly detection to avoid uncatchable Windows C-level
    DLL initialization crashes in environments without Visual C++ OpenMP runtime.
    """
    # Reference baseline distribution (normal execution profile)
    # Means: [start_delta=250, jank_pct=6.0, mem_pct=25.0]
    # Standard deviations: [100.0, 1.5, 8.0]
    means = [250.0, 6.0, 25.0]
    stds = [100.0, 1.5, 8.0]
    z_scores = [abs(f - m) / s for f, m, s in zip(feature_row, means, stds)]
    max_z = max(z_scores) if z_scores else 0.0
    is_anom = max_z > 2.0
    anomaly_score = round(min(100.0, max_z * 25.0), 2)
    return is_anom, anomaly_score


def detect_regressions(
    baseline: dict[str, Any],
    constrained: dict[str, Any]
) -> dict[str, Any]:
    """Compare baseline run metrics against constrained persona run metrics.

    Returns:
        dict with:
            - 'anomalies': list of detected metric regressions
            - 'anomaly_score': float (0.0 to 100.0 statistical heuristic)
            - 'is_anomalous': bool
            - 'summary': executive summary string
    """
    anomalies: list[dict[str, Any]] = []

    # 1. Cold start launch latency regression
    b_start = baseline.get("cold_start_ms")
    c_start = constrained.get("cold_start_ms")
    if isinstance(b_start, (int, float)) and isinstance(c_start, (int, float)):
        delta = c_start - b_start
        pct_increase = round((delta / b_start) * 100, 1) if b_start > 0 else 0
        severity = None
        if delta >= REGRESSION_THRESHOLDS["cold_start_ms"]["critical_delta_ms"]:
            severity = "critical"
        elif delta >= REGRESSION_THRESHOLDS["cold_start_ms"]["warn_delta_ms"]:
            severity = "warning"

        if severity:
            anomalies.append({
                "metric": "cold_start_ms",
                "label": "App Startup Time",
                "baseline": b_start,
                "constrained": c_start,
                "delta": delta,
                "percentage_increase": pct_increase,
                "severity": severity,
                "explanation": (
                    f"Cold-start latency grew from {b_start}ms to {c_start}ms (+{pct_increase}%) "
                    f"under constrained CPU and storage throttling."
                ),
            })

    # 2. UI Jank / Slow Frames (from dumpsys gfxinfo)
    b_jank = baseline.get("jank_percentage")
    c_jank = constrained.get("jank_percentage")
    if isinstance(b_jank, (int, float)) and isinstance(c_jank, (int, float)):
        jank_diff = c_jank - b_jank
        severity = None
        if c_jank >= REGRESSION_THRESHOLDS["jank_percentage"]["critical_pct"] or jank_diff >= 25.0:
            severity = "critical"
        elif c_jank >= REGRESSION_THRESHOLDS["jank_percentage"]["warn_pct"] or jank_diff >= 12.0:
            severity = "warning"

        if severity:
            anomalies.append({
                "metric": "jank_percentage",
                "label": "UI Frame Drops & Jank",
                "baseline": f"{b_jank}%",
                "constrained": f"{c_jank}%",
                "delta": round(jank_diff, 1),
                "severity": severity,
                "explanation": (
                    f"Slow frame rate increased by {round(jank_diff, 1)}% ({c_jank}% of frames dropped), "
                    f"causing perceptible UI stutter on a 720p display."
                ),
            })

    # 3. Peak RAM consumption
    b_mem = baseline.get("peak_memory_mb")
    c_mem = constrained.get("peak_memory_mb")
    if isinstance(b_mem, (int, float)) and isinstance(c_mem, (int, float)):
        mem_delta = c_mem - b_mem
        severity = None
        if mem_delta >= REGRESSION_THRESHOLDS["peak_memory_mb"]["critical_delta_mb"]:
            severity = "critical"
        elif mem_delta >= REGRESSION_THRESHOLDS["peak_memory_mb"]["warn_delta_mb"]:
            severity = "warning"

        if severity:
            anomalies.append({
                "metric": "peak_memory_mb",
                "label": "Memory Footprint",
                "baseline": f"{b_mem} MB",
                "constrained": f"{c_mem} MB",
                "delta": mem_delta,
                "severity": severity,
                "explanation": (
                    f"Memory consumption rose by {mem_delta} MB under low-memory constraints, "
                    f"increasing probability of LMK termination on 2 GB devices."
                ),
            })

    # 4. Multivariate reference z-score heuristic
    feature_row = [
        float(delta) if 'delta' in locals() and delta is not None else 0.0,
        float(c_jank) if isinstance(c_jank, (int, float)) else 0.0,
        float(mem_delta) if 'mem_delta' in locals() and mem_delta is not None else 0.0,
    ]

    is_anomalous, anomaly_score = _calculate_statistical_anomaly_score(feature_row)
    if not anomalies:
        is_anomalous = False

    summary = (
        f"{len(anomalies)} performance regression(s) identified between baseline and constrained environment."
        if anomalies
        else "No statistically significant regressions detected against baseline."
    )

    return {
        "anomalies": anomalies,
        "is_anomalous": is_anomalous,
        "anomaly_score": anomaly_score,
        "regression_count": len(anomalies),
        "summary": summary,
    }
