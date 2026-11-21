"""BharatSim execution engine.

Runs one APK twice on a disposable Android emulator, first on a normal baseline,
then under the selected Bharat persona, and returns a report built only from
what was measured on the device:

  install -> cold start x3 -> automated exploration (adb monkey, app-only)
  -> optional network drop and recovery -> gfxinfo / meminfo / logcat
  -> ML failure classification -> baseline-vs-persona anomaly detection
  -> Bharat Readiness Score

Network conditions are enforced by the host shaping proxy (see shaper.py)
because the emulator kernel has no netem and console throttling did not slow
TCP traffic in our measurements. Every metric carries its source command.
"""
from __future__ import annotations

import hashlib
import json
import random
import re
import statistics
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from . import ml
from .device import ApkInfo, Device, DeviceError, apk_info
from .shaper import Shape, Shaper, shape_for

ENGINE_VERSION = "bharatsim-engine-2.0"
SCORING_PATH = Path(__file__).resolve().parent / "scoring.json"
HISTORY_PATH = Path(__file__).resolve().parent / ".cache" / "baseline_history.jsonl"

NETWORK_RE = re.compile(
    r"UnknownHostException|SocketTimeoutException|ConnectException|SSLHandshakeException|SSLException|"
    r"NoRouteToHostException|Network is unreachable|ECONNRESET|ETIMEDOUT|Connection reset|HTTP FAILED|"
    r"unexpected end of stream|failed to connect",
    re.I,
)
FIXES = {
    "crash": "Catch exceptions on background threads and report them instead of letting them escape; check the stack trace in the evidence for the throwing call.",
    "anr": "Move disk, network and heavy work off the main thread (coroutines, WorkManager or an executor) and keep onCreate/onResume short.",
    "oom": "Cut memory on 2 GB phones: downsample images, use a bounded LRU cache, release caches in onTrimMemory and avoid holding large arrays in statics.",
    "network": "Set realistic timeouts for slow links (15-30 s), retry with exponential backoff, show cached content and an offline state instead of failing.",
    "storage": "Check free space before writing, cap cache size, and handle SQLiteFullException / ENOSPC with a clear message instead of crashing.",
}
SEVERITY = {"crash": "critical", "anr": "critical", "oom": "critical", "network": "high", "storage": "high"}


def utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------- measurement helpers

def cold_start(dev: Device, pkg: str, activity: str) -> dict[str, Any]:
    dev.shell(f"am force-stop {pkg}")
    time.sleep(1.0)
    out = dev.shell(f"am start -W -n {pkg}/{activity}", timeout=60)
    total = re.search(r"TotalTime:\s*(\d+)", out)
    wait = re.search(r"WaitTime:\s*(\d+)", out)
    ok = "Error" not in out and total is not None
    return {"ok": ok, "total_ms": int(total.group(1)) if total else None, "wait_ms": int(wait.group(1)) if wait else None,
            "raw": out.strip()[-300:], "at": utc()}


def gfx(dev: Device, pkg: str) -> dict[str, Any]:
    out = dev.shell(f"dumpsys gfxinfo {pkg}", timeout=30)
    total = re.search(r"Total frames rendered:\s*(\d+)", out)
    janky = re.search(r"Janky frames:\s*(\d+)\s*\(([\d.]+)%\)", out)
    p90 = re.search(r"90th percentile:\s*(\d+)ms", out)
    p99 = re.search(r"99th percentile:\s*(\d+)ms", out)
    frozen = re.search(r"Number Frozen Frames:\s*(\d+)", out) or re.search(r"Number Slow UI thread:\s*(\d+)", out)
    return {
        "total_frames": int(total.group(1)) if total else None,
        "janky_frames": int(janky.group(1)) if janky else None,
        "jank_percent": float(janky.group(2)) if janky else None,
        "frame_p90_ms": int(p90.group(1)) if p90 else None,
        "frame_p99_ms": int(p99.group(1)) if p99 else None,
        "slow_ui_thread": int(frozen.group(1)) if frozen else None,
        "source": "dumpsys gfxinfo", "at": utc(),
    }


def meminfo(dev: Device, pkg: str) -> dict[str, Any]:
    out = dev.shell(f"dumpsys meminfo {pkg}", timeout=30)
    m = re.search(r"TOTAL PSS:\s*(\d+)", out) or re.search(r"^\s*TOTAL\s+(\d+)", out, re.M)
    return {"pss_mb": round(int(m.group(1)) / 1024, 1) if m else None, "source": "dumpsys meminfo", "at": utc()}


def monkey(dev: Device, pkg: str, events: int, throttle: int, seed: int) -> dict[str, Any]:
    cmd = (f"monkey -p {pkg} -s {seed} --throttle {throttle} --pct-touch 70 --pct-motion 20 "
           f"--pct-syskeys 0 --pct-appswitch 0 --pct-nav 0 --pct-majornav 0 --pct-anyevent 0 "
           f"--ignore-crashes --ignore-timeouts --monitor-native-crashes -v {events}")
    out = dev.shell(cmd, timeout=events * throttle / 1000 + 120)
    injected = re.search(r"Events injected:\s*(\d+)", out)
    return {
        "events_requested": events,
        "events_injected": int(injected.group(1)) if injected else 0,
        "crash_reported": "// CRASH:" in out,
        "anr_reported": "// NOT RESPONDING:" in out,
        "source": "adb shell monkey (app-only, system keys and app switching disabled)", "at": utc(),
    }


def read_logcat(dev: Device) -> list[str]:
    return dev.adb("logcat", "-d", "-v", "threadtime", "-b", "main,system,crash", timeout=60).splitlines()


def app_lines(lines: list[str], pkg: str, pids: set[int]) -> list[str]:
    keep = []
    for line in lines:
        parts = line.split()
        pid = int(parts[2]) if len(parts) > 3 and parts[2].isdigit() else None
        if (pid in pids) or pkg in line or "AndroidRuntime" in line or "ANR in" in line:
            if pkg in line or pid in pids or "FATAL EXCEPTION" in line:
                keep.append(line)
    return keep


def count_signals(lines: list[str], pkg: str) -> dict[str, int]:
    text = "\n".join(lines)
    crashes = len(re.findall(rf"Process: {re.escape(pkg)}, PID", text))
    anrs = len(re.findall(rf"ANR in {re.escape(pkg)}", text))
    ooms = len(re.findall(r"OutOfMemoryError", text))
    network = sum(1 for l in lines if NETWORK_RE.search(l))
    storage = sum(1 for l in lines if re.search(r"ENOSPC|No space left|SQLiteFullException", l))
    displayed = re.findall(rf"Displayed {re.escape(pkg)}/\S+: \+(\d+)s?(\d+)?ms", text)
    return {"crashes": crashes, "anrs": anrs, "ooms": ooms, "network_errors": network, "storage_errors": storage,
            "displayed_events": len(displayed)}


# ---------------------------------------------------------------- one profile

def run_profile(dev: Device, shaper: Shaper, apk: Path, info: ApkInfo, activity: str, profile: dict[str, Any],
                cfg: dict[str, Any], stage: Callable[[str], None]) -> dict[str, Any]:
    key = profile["key"]
    label = profile["label"]
    pkg = info.package
    started = utc()
    result: dict[str, Any] = {"profile": key, "label": label, "started_at": started, "conditions_applied": {}, "timeline": []}

    def mark(text: str) -> None:
        result["timeline"].append({"stage": text, "at": utc()})
        stage(f"{label}: {text}")

    dev.reset_conditions()
    dev.uninstall(pkg)
    mark("installing APK")
    try:
        dev.install(str(apk))
    except DeviceError as exc:
        result.update({"installed": False, "error": str(exc), "finished_at": utc()})
        return result
    result["installed"] = True

    # Device constraints
    applied: dict[str, Any] = {}
    if profile.get("battery_saver"):
        applied["battery_saver"] = "on" if dev.battery_saver(True) else "requested, not confirmed"
    if profile.get("free_storage_mb"):
        free = dev.fill_storage(int(profile["free_storage_mb"]))
        applied["free_storage_mb"] = free
    # Network constraints
    mark("applying network constraints")
    shape = shape_for(profile)
    shaper.set_shape(shape)
    shaper.reset_counters()
    dev.set_proxy(shaper.port)
    applied["network"] = {
        "down_kbps": shape.down_kbps, "up_kbps": shape.up_kbps, "delay_ms": list(shape.delay_ms),
        "packet_loss_pct": shape.loss_pct, "reset_pct": shape.reset_pct,
        "variable_kbps": profile.get("variable_kbps"),
        "enforced_by": "host shaping proxy (Android system proxy -> 10.0.2.2)",
    }
    applied["device"] = {"ram_mb": 2048, "android": "11 (API 30)", "screen": "720x1280"}
    result["conditions_applied"] = applied

    variable = profile.get("variable_kbps")
    stop_var = threading.Event()
    if variable:
        def vary():
            while not stop_var.wait(5):
                kbps = random.uniform(float(variable[0]), float(variable[1]))
                shaper.set_shape(Shape(down_kbps=kbps, up_kbps=kbps / 3, delay_ms=shape.delay_ms,
                                       loss_pct=shape.loss_pct, reset_pct=shape.reset_pct))
        threading.Thread(target=vary, daemon=True).start()

    try:
        dev.adb("logcat", "-c", timeout=20)
        # Cold starts
        launches = []
        for i in range(cfg["cold_starts"]):
            mark(f"cold start {i + 1} of {cfg['cold_starts']}")
            launches.append(cold_start(dev, pkg, activity))
        result["launches"] = launches
        ok_launch = [l["total_ms"] for l in launches if l["ok"] and l["total_ms"] is not None]
        result["launched"] = bool(ok_launch)
        result["cold_start_ms_median"] = statistics.median(ok_launch) if ok_launch else None

        # Steady session + exploration
        cold_start(dev, pkg, activity)
        dev.shell(f"dumpsys gfxinfo {pkg} reset", timeout=20)
        time.sleep(cfg["settle_seconds"])
        mark("running automated exploration")
        result["exploration"] = monkey(dev, pkg, cfg["monkey_events"], cfg["monkey_throttle_ms"], cfg["monkey_seed"])

        # Network drop and recovery
        drop = int(profile.get("drop_seconds") or 0)
        if drop:
            mark(f"dropping the network for {drop} s")
            if dev.pid(pkg) is None:
                cold_start(dev, pkg, activity)
            pid_before = dev.pid(pkg)
            dev.airplane(True)
            alive_during = True
            for _ in range(drop):
                time.sleep(1)
                if dev.pid(pkg) != pid_before:
                    alive_during = False
            dev.airplane(False)
            t0 = time.monotonic()
            recovered_s = None
            for _ in range(30):
                time.sleep(1)
                if dev.pid(pkg) is not None and dev.focused_package() == pkg:
                    recovered_s = round(time.monotonic() - t0, 1)
                    break
            behaviour = "stayed open" if alive_during and dev.pid(pkg) == pid_before else "crashed or closed"
            result["drop"] = {"seconds": drop, "behaviour": behaviour, "recovery_seconds": recovered_s,
                              "source": "cmd connectivity airplane-mode + pidof/dumpsys window", "at": utc()}

        mark("collecting telemetry")
        result["frames"] = gfx(dev, pkg)
        result["memory"] = meminfo(dev, pkg)
        pids = {p for p in [dev.pid(pkg)] if p}
        lines = read_logcat(dev)
        pids |= {int(m) for m in re.findall(rf"Start proc (\d+):{re.escape(pkg)}", "\n".join(lines))}
        mine = app_lines(lines, pkg, pids)
        result["signals"] = count_signals(lines, pkg)
        result["app_log_lines"] = mine[-400:]
        c = shaper.counters
        result["network"] = {
            "bytes_down": c.bytes_down, "bytes_up": c.bytes_up, "connections": c.connections,
            "refused_while_offline": c.refused, "loss_stalls": c.loss_stalls, "resets": c.resets,
            "hosts": sorted(c.hosts)[:20], "source": "shaping proxy counters",
            "note": None if c.connections else "No traffic went through the shaping proxy; the app may not use the network or may bypass the system proxy.",
        }
    finally:
        stop_var.set()
        dev.set_proxy(None)
        dev.reset_conditions()
        dev.shell(f"am force-stop {pkg}")
        dev.uninstall(pkg)
    result["finished_at"] = utc()
    return result


# ---------------------------------------------------------------- analysis

def classify_findings(res: dict[str, Any]) -> list[dict[str, Any]]:
    lines = res.get("app_log_lines") or []
    candidates = [l for l in lines if re.search(r"\s[EWF]\s", l) or "FATAL" in l or "ANR in" in l]
    if not candidates:
        return []
    labels = ml.classify(candidates)
    groups: dict[str, dict[str, Any]] = {}
    for line, (label, prob) in zip(candidates, labels):
        if label == "other":
            continue
        g = groups.setdefault(label, {"confidences": [], "evidence": []})
        g["confidences"].append(prob)
        if len(g["evidence"]) < 6:
            g["evidence"].append(ml._PREFIX.sub("", line)[:300])
    findings = []
    sig = res.get("signals", {})
    for label, g in groups.items():
        conf = round(max(g["confidences"]), 3)
        counted = {"crash": sig.get("crashes"), "anr": sig.get("anrs"), "oom": sig.get("ooms"),
                   "network": sig.get("network_errors"), "storage": sig.get("storage_errors")}.get(label)
        message = {
            "crash": f"The app crashed {counted or len(g['confidences'])} time(s) under {res['label']}.",
            "anr": "The app stopped responding (ANR).",
            "oom": "The app ran out of memory.",
            "network": f"{counted or len(g['confidences'])} network failure line(s): timeouts, DNS or connection errors.",
            "storage": "The app hit a storage-full error.",
        }[label]
        findings.append({
            "category": label, "severity": SEVERITY[label], "confidence": conf,
            "low_confidence": conf < 0.6, "message": message, "fix": FIXES[label],
            "evidence": g["evidence"], "lines_classified": len(g["confidences"]),
            "source": "model", "model_version": ml.MODEL_VERSION,
        })
    findings.sort(key=lambda f: ({"critical": 0, "high": 1}.get(f["severity"], 2), -f["confidence"]))
    return findings


def _history() -> list[float]:
    if not HISTORY_PATH.exists():
        return []
    vals = []
    for row in HISTORY_PATH.read_text(encoding="utf-8").splitlines()[-500:]:
        try:
            vals.append(float(json.loads(row)["cold_start_ms"]))
        except Exception:
            pass
    return vals


def anomalies(base: dict[str, Any], cons: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    b = [l["total_ms"] for l in base.get("launches", []) if l.get("ok") and l.get("total_ms")]
    c = [l["total_ms"] for l in cons.get("launches", []) if l.get("ok") and l.get("total_ms")]
    if b and c:
        mean = statistics.mean(b)
        sd = max(statistics.pstdev(b), 0.08 * mean, 30.0)  # floor: 3 samples underestimate spread
        z = (statistics.median(c) - mean) / sd
        q = sorted(b)
        iqr_hi = q[-1] + 1.5 * (q[-1] - q[0])
        flagged = z > 3 and statistics.median(c) > iqr_hi and statistics.median(c) - mean > 250
        out.append({"metric": "cold_start_ms", "method": "z-score + IQR vs baseline launches",
                    "baseline_mean": round(mean), "persona_median": round(statistics.median(c)),
                    "z_score": round(z, 2), "iqr_upper": round(iqr_hi), "regression": bool(flagged)})
        # IsolationForest on accumulated baseline launches from this worker
        hist = _history() + b
        if len(hist) >= 8:
            from sklearn.ensemble import IsolationForest
            import numpy as np
            iso = IsolationForest(n_estimators=150, contamination="auto", random_state=7).fit(np.array(hist).reshape(-1, 1))
            scores = iso.decision_function(np.array(c).reshape(-1, 1))
            out.append({"metric": "cold_start_ms", "method": f"IsolationForest on {len(hist)} baseline launches",
                        "anomalous_launches": int((scores < 0).sum()), "of": len(c),
                        "regression": bool((scores < 0).sum() >= max(2, len(c) - 1))})
        else:
            out.append({"metric": "cold_start_ms", "method": "IsolationForest", "skipped": True,
                        "reason": f"needs at least 8 baseline launches in history, has {len(hist)}"})
        HISTORY_PATH.parent.mkdir(exist_ok=True)
        with HISTORY_PATH.open("a", encoding="utf-8") as f:
            for v in b:
                f.write(json.dumps({"cold_start_ms": v, "at": utc()}) + "\n")
    def ratio(metric, bval, cval, threshold, unit):
        if bval is None or cval is None:
            return
        rel = (cval - bval) / bval if bval else None
        out.append({"metric": metric, "method": "relative change vs baseline", "baseline": bval, "persona": cval,
                    "change_pct": round(rel * 100, 1) if rel is not None else None, "unit": unit,
                    "regression": bool(rel is not None and rel > threshold)})
    ratio("jank_percent", base.get("frames", {}).get("jank_percent"), cons.get("frames", {}).get("jank_percent"), 0.5, "%")
    ratio("memory_pss_mb", base.get("memory", {}).get("pss_mb"), cons.get("memory", {}).get("pss_mb"), 0.3, "MB")
    bs, cs = base.get("signals", {}), cons.get("signals", {})
    for k in ("crashes", "anrs", "network_errors"):
        if cs.get(k, 0) > bs.get(k, 0):
            out.append({"metric": k, "method": "count vs baseline", "baseline": bs.get(k, 0), "persona": cs.get(k, 0), "regression": True})
    return out


def score(base: dict[str, Any], cons: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    w = cfg["weights"]
    cats: dict[str, dict[str, Any]] = {}
    s = cons.get("signals", {})
    # startup
    med, bmed = cons.get("cold_start_ms_median"), base.get("cold_start_ms_median")
    if not cons.get("launched"):
        cats["startup"] = {"score": 0, "why": "the app did not launch"}
    else:
        pts = 100
        if med and med > cfg["cold_start_fail_ms"]:
            pts = 20
        elif med and med > cfg["cold_start_warn_ms"]:
            pts = 60
        if med and bmed and med > 2 * bmed and med - bmed > 500:
            pts = min(pts, 50)
        cats["startup"] = {"score": pts, "why": f"median cold start {med} ms vs baseline {bmed} ms"}
    # stability
    pts = 100 - 60 * min(s.get("crashes", 0), 1) - 25 * max(0, s.get("crashes", 0) - 1) - 40 * min(s.get("anrs", 0), 1) - 30 * min(s.get("ooms", 0), 1)
    cats["stability"] = {"score": max(0, pts), "why": f"{s.get('crashes', 0)} crash(es), {s.get('anrs', 0)} ANR(s), {s.get('ooms', 0)} OOM(s)"}
    # UI
    jank = cons.get("frames", {}).get("jank_percent")
    cats["ui"] = {"score": 100 if jank is None else max(0, round(100 - max(0.0, jank - 5) * 2.5)),
                  "why": "no frames rendered" if jank is None else f"{jank}% janky frames"}
    # memory
    pss, bpss = cons.get("memory", {}).get("pss_mb"), base.get("memory", {}).get("pss_mb")
    mpts = 100
    if pss:
        if pss > cfg["memory_fail_mb"]:
            mpts = 30
        elif pss > cfg["memory_warn_mb"]:
            mpts = 70
    cats["memory"] = {"score": mpts, "why": f"{pss} MB PSS vs baseline {bpss} MB"}
    # network reliability
    ne = s.get("network_errors", 0)
    cats["network"] = {"score": max(0, 100 - 12 * ne), "why": f"{ne} network failure line(s) in the app log"}
    # recovery
    drop = cons.get("drop")
    if drop:
        rpts = 100 if drop["behaviour"] == "stayed open" else 20
        if drop.get("recovery_seconds") is None:
            rpts = min(rpts, 30)
        cats["recovery"] = {"score": rpts, "why": f"{drop['behaviour']} during a {drop['seconds']} s drop"}
    total_w = sum(w[k] for k in cats)
    overall = round(sum(cats[k]["score"] * w[k] for k in cats) / total_w)
    # never a perfect score from "it ran": cap when exploration barely happened
    if (cons.get("exploration") or {}).get("events_injected", 0) < cfg["monkey_events"] * 0.5:
        overall = min(overall, 85)
    for k, v in cats.items():
        v["status"] = "pass" if v["score"] >= 75 else "warn" if v["score"] >= 50 else "fail"
    return {"overall": overall, "categories": cats, "weights": {k: w[k] for k in cats},
            "status": "pass" if overall >= 75 else "warn" if overall >= 50 else "fail",
            "methodology": "Weighted category scores from measured telemetry; thresholds in worker/scoring.json."}


# ---------------------------------------------------------------- entry point

def execute(apk: Path, job: dict[str, Any], dev: Device, shaper: Shaper, stage: Callable[[str], None]) -> dict[str, Any]:
    cfg = json.loads(SCORING_PATH.read_text(encoding="utf-8"))
    started = utc()
    stage("Validating APK")
    digest = sha256_file(apk)
    info = apk_info(str(apk))
    stage("Provisioning emulator")
    dev.wait_ready(60)
    props = dev.props()
    activity = info.launch_activity
    persona = job.get("persona_profile") or {}
    profiles = [
        {"key": "baseline", "label": "Baseline", "network_speed": "full", "network_delay": "none"},
        {"key": persona.get("id", "persona"), "label": persona.get("name", "Persona"),
         "network_speed": f"{persona.get('up_kbps')}:{persona.get('down_kbps')}" if persona.get("down_kbps") else "full",
         "network_delay": f"{persona['delay_ms'][0]}:{persona['delay_ms'][1]}" if persona.get("delay_ms") else "none",
         "packet_loss_pct": persona.get("packet_loss_pct", 0), "reset_pct": persona.get("reset_pct", 0),
         "variable_kbps": persona.get("variable_kbps"), "drop_seconds": persona.get("drop_seconds", 0),
         "battery_saver": persona.get("battery_saver"), "free_storage_mb": persona.get("storage_free_mb") if persona.get("fill_storage") else None},
    ]
    results = {}
    for p in profiles:
        if activity is None:
            # Install once to resolve the launcher activity when aapt2 did not report one.
            dev.install(str(apk))
            activity = dev.resolve_activity(info.package)
            dev.uninstall(info.package)
            if not activity:
                raise DeviceError("The APK has no launchable activity")
        results[p["key"]] = run_profile(dev, shaper, apk, info, activity, p, cfg, stage)
    stage("Analysing results")
    base, cons = results["baseline"], results[profiles[1]["key"]]
    for r in (base, cons):
        r["findings"] = classify_findings(r) if r.get("installed") else []
    anomaly = anomalies(base, cons) if base.get("installed") and cons.get("installed") else []
    readiness = score(base, cons, cfg) if cons.get("installed") else {"overall": 0, "status": "fail", "categories": {}, "methodology": "install failed"}
    stage("Generating report")
    for r in (base, cons):
        r.pop("app_log_lines", None)
    return {
        "status": "completed" if cons.get("installed") else "failed",
        "error": None if cons.get("installed") else cons.get("error"),
        "engine": ENGINE_VERSION,
        "execution": {"real_emulator": True, "fixture_playback": False, "device": props, "started_at": started, "finished_at": utc()},
        "apk_sha256": digest,
        "apk": {"package": info.package, "version_name": info.version_name, "min_sdk": info.min_sdk,
                "target_sdk": info.target_sdk, "native_code": info.native_code, "label": info.label},
        "persona": persona,
        "baseline": base,
        "constrained": cons,
        "anomalies": anomaly,
        "readiness": readiness,
        "ml": {"model_version": ml.MODEL_VERSION, **ml.metadata()},
    }
