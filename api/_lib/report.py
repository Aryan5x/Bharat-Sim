"""Turn stored run results into compact facts for the explanation model, and a
deterministic English fallback when Sarvam is unavailable."""
from __future__ import annotations

from typing import Any


def _fmt_ms(value: Any) -> str:
    return f"{int(value)} ms" if isinstance(value, (int, float)) else "not measured"


def build_facts(run: dict[str, Any], app: dict[str, Any], results: list[dict[str, Any]], profiles: dict[str, dict]) -> str:
    lines = [
        f"App: {app.get('label')} ({app.get('package_name') or 'package unknown'}), version {app.get('version_name') or 'unknown'}.",
        f"Bharat Readiness Score: {run.get('readiness_score')}/100.",
        "Test device: Android 11 emulator with 2 GB RAM and a 720p screen.",
    ]
    for result in results:
        metrics = result.get("metrics") or {}
        name = profiles.get(result["profile_key"], {}).get("name", result["profile_key"])
        parts = [f"Profile {name}: verdict {result['verdict']}"]
        parts.append(f"cold start median {_fmt_ms(metrics.get('cold_start_ms_median'))}")
        if metrics.get("jank_percent") is not None:
            parts.append(f"janky frames {metrics['jank_percent']}%")
        parts.append(f"crashes {metrics.get('crashes', 0)}, ANRs {metrics.get('anrs', 0)}")
        if metrics.get("network_errors") is not None:
            parts.append(f"network errors {metrics['network_errors']}")
        if metrics.get("offline_behavior"):
            parts.append(f"when the network dropped: {metrics['offline_behavior']}")
        if metrics.get("recovery_seconds") is not None:
            parts.append(f"recovered in {metrics['recovery_seconds']} s")
        if metrics.get("memory_pss_mb") is not None:
            parts.append(f"memory {metrics['memory_pss_mb']} MB")
        if metrics.get("data_used_kb") is not None:
            parts.append(f"mobile data used {metrics['data_used_kb']} KB")
        lines.append("; ".join(parts) + ".")
        for finding in (result.get("findings") or [])[:3]:
            lines.append(
                f"  Finding ({finding.get('category')}, confidence {finding.get('confidence')}): {finding.get('message')}"
            )
    return "\n".join(lines)


def fallback_explanation(run: dict[str, Any], results: list[dict[str, Any]], profiles: dict[str, dict]) -> dict[str, Any]:
    failing = [r for r in results if r["verdict"] in ("fail", "error")]
    warning = [r for r in results if r["verdict"] == "warn"]
    score = run.get("readiness_score")
    if failing:
        verdict = f"Not ready yet: the app failed on {len(failing)} of {len(results)} conditions (score {score}/100)."
    elif warning:
        verdict = f"Mostly ready: no failures, but {len(warning)} condition(s) need attention (score {score}/100)."
    else:
        verdict = f"Ready: the app held up on every tested condition (score {score}/100)."
    issues = []
    for result in failing + warning:
        for finding in (result.get("findings") or [])[:1]:
            name = profiles.get(result["profile_key"], {}).get("name", result["profile_key"])
            issues.append({"issue": f"{name}: {finding.get('message')}", "fix": finding.get("fix") or ""})
    return {"verdict": verdict, "issues": issues[:4], "generated_by": "rules"}


def speech_text(explanation: dict[str, Any]) -> str:
    parts = [explanation.get("verdict", "")]
    for item in explanation.get("issues", [])[:2]:
        parts.append(item.get("issue", ""))
    return " ".join(p for p in parts if p)[:900]
