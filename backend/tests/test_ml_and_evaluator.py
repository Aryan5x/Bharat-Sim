"""Tests for ML Failure Classification, Anomaly Detection, Sarvam Audio, and Evaluator Scenarios."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.anomaly_detector import detect_regressions
from backend.app.evaluator_scenarios import get_all_scenarios, get_scenario_by_id
from backend.app.main import app
from backend.app.ml_classifier import classify_log_snippet, classify_logcat_stream
from backend.app.sarvam import generate_speech_audio, explain_failure_with_sarvam


@pytest.fixture
def client():
    return TestClient(app)


def test_ml_classifier_individual_snippets():
    crash_res = classify_log_snippet("FATAL EXCEPTION: main java.lang.NullPointerException")
    assert crash_res["category"] == "crash"
    assert crash_res["is_failure"] is True
    assert crash_res["confidence"] > 0.5

    anr_res = classify_log_snippet("ANR in com.bharat.app: Input dispatching timed out")
    assert anr_res["category"] == "anr"
    assert anr_res["is_failure"] is True

    oom_res = classify_log_snippet("OutOfMemoryError: Failed to allocate a 52428816 byte allocation")
    assert oom_res["category"] == "oom"
    assert oom_res["is_failure"] is True

    net_res = classify_log_snippet("java.net.SocketTimeoutException: Connection timed out")
    assert net_res["category"] == "network"
    assert net_res["is_failure"] is True

    storage_res = classify_log_snippet("java.io.IOException: write failed: ENOSPC (No space left on device)")
    assert storage_res["category"] == "storage"
    assert storage_res["is_failure"] is True

    normal_res = classify_log_snippet("I/ChatAdapter: Rendered 25 messages in RecyclerView in 14ms")
    assert normal_res["category"] == "normal"
    assert normal_res["is_failure"] is False


def test_ml_classifier_stream():
    sample_log = """
    ActivityTaskManager: START u0 {cmp=com.bharat.app/.MainActivity}
    Choreographer: Skipped 3 frames!
    java.net.SocketTimeoutException: failed to connect to api.bharatsim.io after 15000ms
    D/Lifecycle: Activity onResume called
    lowmemorykiller: Killing 'com.bharat.app' to free 48210kB because system is low on memory
    """
    matches = classify_logcat_stream(sample_log)
    categories = [m["category"] for m in matches]
    assert "network" in categories
    assert "oom" in categories


def test_anomaly_detector_regressions():
    baseline = {
        "cold_start_ms": 650,
        "jank_percentage": 4.0,
        "peak_memory_mb": 85,
        "network_latency_ms": 30,
    }
    constrained = {
        "cold_start_ms": 2900,  # +2250ms -> warning/critical
        "jank_percentage": 36.0,  # +32% -> critical
        "peak_memory_mb": 290,  # +205MB -> warning
        "network_latency_ms": 480,
    }
    result = detect_regressions(baseline, constrained)
    assert result["regression_count"] >= 2
    metrics = [a["metric"] for a in result["anomalies"]]
    assert "cold_start_ms" in metrics
    assert "jank_percentage" in metrics


def test_sarvam_tts_audio_generation():
    audio_data = generate_speech_audio("सावधान: यह ऍप क्रैश हो रहा है।", "hi-IN")
    assert "audio_base64" in audio_data
    assert len(audio_data["audio_base64"]) > 100
    assert audio_data["format"] == "audio/wav"


def test_sarvam_failure_explanation():
    explanation = explain_failure_with_sarvam("oom", "OutOfMemoryError in bitmap allocation", "Budget Android")
    assert "root_cause" in explanation
    assert "developer_fix" in explanation
    assert "code_remedy" in explanation


def test_evaluator_scenarios_api(client):
    res = client.get("/api/v1/evaluator/scenarios")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert len(data["items"]) >= 2

    # Check Scenario A
    res_a = client.get("/api/v1/evaluator/scenarios/fintech-upi-timeout")
    assert res_a.status_code == 200
    sc_a = res_a.json()
    assert sc_a["category"] == "fintech"
    assert "SocketTimeoutException" in sc_a["logcat"]

    # Check Scenario B
    res_b = client.get("/api/v1/evaluator/scenarios/quick-commerce-oom")
    assert res_b.status_code == 200
    sc_b = res_b.json()
    assert sc_b["category"] == "delivery"
    assert "OutOfMemoryError" in sc_b["logcat"]


def test_sarvam_tts_endpoint(client):
    res = client.post("/api/v1/translate/audio", json={
        "text": "सावधान: यह ऍप 2GB रैम वाले फोन पर क्रैश हो रहा है।",
        "target_language_code": "hi-IN",
        "speaker": "meera",
    })
    assert res.status_code == 200
    data = res.json()
    assert "audio_base64" in data
    assert data["format"] == "audio/wav"


def test_sarvam_explain_endpoint(client):
    res = client.post("/api/v1/explain/failure", json={
        "category": "network",
        "evidence": "java.net.SocketTimeoutException: Connection timed out",
        "persona_id": "edge-village",
    })
    assert res.status_code == 200
    data = res.json()
    assert "root_cause" in data
    assert "developer_fix" in data
    assert "code_remedy" in data


def test_analyze_logs_with_ml_enrichment(client):
    sample_text = (
        "11-21 14:02:10.120 14205 14205 E AndroidRuntime: FATAL EXCEPTION: main\n"
        "Process: com.bharat.app, PID: 14205\n"
        "java.lang.OutOfMemoryError: Failed to allocate a 52428816 byte allocation\n"
        "java.net.SocketTimeoutException: failed to connect to api.bharatsim.io after 15000ms\n"
    )
    res = client.post("/api/v1/analyze/logs", json={
        "text": sample_text,
        "persona_id": "budget-android",
    })
    assert res.status_code == 200
    data = res.json()
    assert "ml_pipeline" in data
    assert data["ml_pipeline"]["algorithm"] == "TfidfVectorizer + LogisticRegression"
    assert data["summary"]["finding_count"] >= 2
    # Verify Sarvam explanation is attached to findings
    first_finding = data["findings"][0]
    assert "sarvam_explanation" in first_finding
    assert "code_remedy" in first_finding["sarvam_explanation"]
