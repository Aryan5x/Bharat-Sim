"""Evaluator Scenarios for BharatSim.

Provides pre-packaged, authenticated demonstration scenarios for instant evaluator
inspection without requiring a local ADB device setup.
"""
from __future__ import annotations

from typing import Any

SCENARIO_A_UPI_LOGCAT = """11-21 15:42:01.120 18450 18450 I ActivityTaskManager: START u0 {act=android.intent.action.VIEW dat=upi://pay?pa=merchant@bharatpay&pn=QuickStore&am=499.00&cu=INR cmp=com.fintech.upi/.PaymentActivity}
11-21 15:42:01.250 18450 18450 D PaymentActivity: Initializing UPI transaction with gateway intent ID tx_98214_in
11-21 15:42:01.310 18450 18512 D OkHttpClient: --> POST https://api.payments.gov.in/v1/upi/initiate (256 bytes)
11-21 15:42:01.890 18450 18512 D OkHttpClient: <-- 200 OK https://api.payments.gov.in/v1/upi/initiate (580ms)
11-21 15:42:05.100 18450 18512 D PaymentActivity: User entered UPI PIN. Dispatching authorize request to NPCI gateway...
11-21 15:42:05.150 18450 18520 D OkHttpClient: --> POST https://npci.upi.net.in/v2/transaction/authorize (512 bytes)
11-21 15:42:20.165 18450 18520 W OkHttpClient: java.net.SocketTimeoutException: failed to connect to npci.upi.net.in/185.199.111.133 (port 443) after 15000ms
11-21 15:42:20.166 18450 18520 W OkHttpClient: 	at okhttp3.internal.connection.RealConnection.connectSocket(RealConnection.kt:297)
11-21 15:42:20.166 18450 18520 W OkHttpClient: 	at okhttp3.internal.connection.RealConnection.connect(RealConnection.kt:207)
11-21 15:42:20.167 18450 18520 W PaymentActivity: Network failure during UPI authorization: java.net.SocketTimeoutException: failed to connect to npci.upi.net.in after 15000ms
11-21 15:42:20.200 18450 18450 E PaymentActivity: retrofit2.HttpException: HTTP 504 Gateway Timeout on endpoint /v2/transaction/authorize
11-21 15:42:20.201 18450 18450 E PaymentActivity: Transaction verification aborted due to packet loss and 450ms network latency
11-21 15:42:20.300 18450 18450 W ViewRootImpl: Skipped 48 frames! The application may be doing too much work on its main thread.
"""

SCENARIO_B_OOM_LOGCAT = """11-21 16:10:02.100 21300 21300 I ActivityTaskManager: START u0 {act=android.intent.action.MAIN cmp=com.quickcommerce.app/.CatalogActivity}
11-21 16:10:02.450 21300 21300 D CatalogActivity: Loading 50 flash-sale grocery items into multi-column RecyclerView...
11-21 16:10:03.120 21300 21340 D ImageLoader: Decoding high-res banner asset 3840x2160 ARGB_8888 (33.1 MB uncompressed)
11-21 16:10:03.540 21300 21300 I art: Clamp target GC heap from 128MB to 64MB: low memory threshold exceeded
11-21 16:10:04.200 21300 21345 E art: Throwing OutOfMemoryError 'Failed to allocate a 33177616 byte allocation with 4194304 free bytes and 12MB until OOM'
11-21 16:10:04.205 21300 21345 E AndroidRuntime: FATAL EXCEPTION: Glide-Source-Manager-1
11-21 16:10:04.205 21300 21345 E AndroidRuntime: Process: com.quickcommerce.app, PID: 21300
11-21 16:10:04.206 21300 21345 E AndroidRuntime: java.lang.OutOfMemoryError: Failed to allocate a 33177616 byte allocation with 4194304 free bytes and 12MB until OOM
11-21 16:10:04.206 21300 21345 E AndroidRuntime: 	at dalvik.system.VMRuntime.newNonMovableArray(Native Method)
11-21 16:10:04.207 21300 21345 E AndroidRuntime: 	at android.graphics.Bitmap.createBitmap(Bitmap.java:1180)
11-21 16:10:04.207 21300 21345 E AndroidRuntime: 	at com.bumptech.glide.load.resource.bitmap.Downsampler.decode(Downsampler.java:312)
11-21 16:10:04.220   850   920 I lmkd: Kill process 'com.quickcommerce.app' (pid 21300) uid 10142 to free 72MB memory under high memory pressure
11-21 16:10:04.225   850   920 I ActivityManager: Process com.quickcommerce.app (pid 21300) has died
"""

EVALUATOR_SCENARIOS = {
    "fintech-upi-timeout": {
        "id": "fintech-upi-timeout",
        "title": "Scenario A: UPI Checkout Timeout & 504 Gateway Error",
        "category": "fintech",
        "app_name": "BharatPay UPI",
        "package_name": "com.fintech.upi",
        "persona_id": "edge-village",
        "persona_name": "Edge / weak signal (Rural 2G · 450ms · 8% Loss)",
        "simulated_failure": "Network Timeout / HTTP 504 / Packet Loss",
        "logcat": SCENARIO_A_UPI_LOGCAT.strip(),
        "baseline_telemetry": {
            "cold_start_ms": 780,
            "jank_percentage": 4.2,
            "peak_memory_mb": 94,
            "network_latency_ms": 42,
            "success": True,
        },
        "constrained_telemetry": {
            "cold_start_ms": 2450,
            "jank_percentage": 28.5,
            "peak_memory_mb": 118,
            "network_latency_ms": 15000,
            "success": False,
        },
        "description": "Simulates an authentic UPI checkout authorization failure in rural Bihar/UP with 450ms latency and 8% packet loss resulting in a 15-second socket timeout.",
        "is_evaluator_fixture": True,
    },
    "quick-commerce-oom": {
        "id": "quick-commerce-oom",
        "title": "Scenario B: Quick-Commerce Low-Memory Killer Crash",
        "category": "delivery",
        "app_name": "QuickStore 10m Delivery",
        "package_name": "com.quickcommerce.app",
        "persona_id": "budget-android",
        "persona_name": "Budget Android (2 GB RAM · 720p · Battery Saver)",
        "simulated_failure": "OutOfMemoryError / Low Memory Killer termination",
        "logcat": SCENARIO_B_OOM_LOGCAT.strip(),
        "baseline_telemetry": {
            "cold_start_ms": 850,
            "jank_percentage": 5.1,
            "peak_memory_mb": 112,
            "network_latency_ms": 38,
            "success": True,
        },
        "constrained_telemetry": {
            "cold_start_ms": 3100,
            "jank_percentage": 42.0,
            "peak_memory_mb": 512,
            "network_latency_ms": 190,
            "success": False,
        },
        "description": "Simulates an authentic uncompressed ARGB_8888 bitmap allocation on an entry-level 2 GB RAM phone triggering an immediate OutOfMemoryError and system LMK kill.",
        "is_evaluator_fixture": True,
    },
}


# Display fields the dashboard's Evaluator Tour reads (name, expected failure,
# ML category, headline metrics and a short Indic briefing).
_DISPLAY = {
    "fintech-upi-timeout": {
        "expected_ml_category": "network",
        "sarvam_insight": {
            "hi": "ग्रामीण 2G नेटवर्क पर UPI भुगतान की पुष्टि 15 सेकंड बाद टाइमआउट हो गई। अनुरोध को बैकऑफ़ के साथ दोबारा भेजें और टाइमआउट बढ़ाएँ ताकि भुगतान पूरा हो सके।",
            "en": "On a rural 2G connection the UPI authorization timed out after 15 s. Retry with backoff and a longer timeout so the payment can complete.",
        },
    },
    "quick-commerce-oom": {
        "expected_ml_category": "oom",
        "sarvam_insight": {
            "hi": "2 GB RAM वाले फ़ोन पर बड़ी बैनर इमेज लोड करते समय ऐप की मेमोरी खत्म हो गई और सिस्टम ने ऐप बंद कर दिया। इमेज को स्क्रीन के आकार में छोटा करके डिकोड करें।",
            "en": "On a 2 GB RAM phone, decoding a full-size banner image ran the app out of memory and the system killed it. Decode images at display size.",
        },
    },
}


def _with_display(scenario: dict[str, Any]) -> dict[str, Any]:
    constrained = scenario.get("constrained_telemetry") or {}
    extra = _DISPLAY.get(scenario["id"], {})
    return {
        **scenario,
        "name": scenario.get("title", scenario["id"]),
        "expected_failure": scenario.get("simulated_failure", ""),
        "expected_ml_category": extra.get("expected_ml_category", "other"),
        "metrics": {
            "cold_start_ms": constrained.get("cold_start_ms"),
            "jank_frame_pct": constrained.get("jank_percentage"),
            "memory_peak_mb": constrained.get("peak_memory_mb"),
            "network_latency_ms": constrained.get("network_latency_ms"),
        },
        "sarvam_insight": extra.get("sarvam_insight", {"hi": "", "en": scenario.get("description", "")}),
    }


def get_all_scenarios() -> list[dict[str, Any]]:
    return [_with_display(s) for s in EVALUATOR_SCENARIOS.values()]


def get_scenario_by_id(scenario_id: str) -> dict[str, Any] | None:
    scenario = EVALUATOR_SCENARIOS.get(scenario_id)
    return _with_display(scenario) if scenario else None

