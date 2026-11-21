import pytest
from app.anomaly_detector import detect_regressions


def test_detect_regressions_handles_empty_inputs_gracefully():
    """Verify that when baseline and constrained have no metrics, no exception is raised and feature_row defaults safely."""
    result = detect_regressions({}, {})
    assert result["anomalies"] == []
    assert result["is_anomalous"] is False
    assert result["anomaly_score"] == 0.0
    assert "No statistically significant regressions detected" in result["summary"]


def test_detect_regressions_detects_cold_start_regression():
    baseline = {"cold_start_ms": 500}
    constrained = {"cold_start_ms": 4000}  # Delta = 3500ms >= 3000ms (critical)
    result = detect_regressions(baseline, constrained)
    assert len(result["anomalies"]) >= 1
    cold_start_anomaly = next(a for a in result["anomalies"] if a["metric"] == "cold_start_ms")
    assert cold_start_anomaly["severity"] == "critical"
    assert cold_start_anomaly["delta"] == 3500
    assert result["is_anomalous"] is True
    assert result["anomaly_score"] > 0.0


def test_detect_regressions_detects_memory_regression():
    baseline = {"peak_memory_mb": 150}
    constrained = {"peak_memory_mb": 600}  # Delta = 450MB >= 400MB (critical)
    result = detect_regressions(baseline, constrained)
    assert len(result["anomalies"]) >= 1
    mem_anomaly = next(a for a in result["anomalies"] if a["metric"] == "peak_memory_mb")
    assert mem_anomaly["severity"] == "critical"
    assert mem_anomaly["delta"] == 450


def test_detect_regressions_handles_partial_data_safely():
    """Verify edge case where baseline has memory but constrained doesn't, or vice-versa."""
    result = detect_regressions({"peak_memory_mb": 100}, {"cold_start_ms": 200})
    assert isinstance(result["anomalies"], list)
    assert isinstance(result["anomaly_score"], float)
