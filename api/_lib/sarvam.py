"""Sarvam AI: plain-language explanation, Indian-language translation and speech.

All three calls sit in the core report flow. The key is server-only.
"""
from __future__ import annotations

import base64
import re
from typing import Any

from .config import settings
from .supa import client

BASE = "https://api.sarvam.ai"

LANGUAGES: dict[str, str] = {
    "hi-IN": "Hindi",
    "ta-IN": "Tamil",
    "mr-IN": "Marathi",
    "bn-IN": "Bengali",
    "te-IN": "Telugu",
    "kn-IN": "Kannada",
    "gu-IN": "Gujarati",
    "ml-IN": "Malayalam",
    "pa-IN": "Punjabi",
    "od-IN": "Odia",
}


class SarvamError(Exception):
    pass


def _headers() -> dict[str, str]:
    if not settings.sarvam_api_key:
        raise SarvamError("Sarvam is not configured on the server")
    return {"api-subscription-key": settings.sarvam_api_key, "Content-Type": "application/json"}


async def _post(path: str, body: dict[str, Any], timeout: float = 45.0) -> dict[str, Any]:
    resp = await client().post(f"{BASE}{path}", json=body, headers=_headers(), timeout=timeout)
    if resp.status_code >= 400:
        raise SarvamError(f"Sarvam {path} failed with {resp.status_code}")
    return resp.json()


SYSTEM_PROMPT = (
    "You explain Android app test results to a startup founder or product manager who is not an engineer. "
    "Use plain, specific English. No markdown, no headings, no emoji. "
    "Answer in exactly this format:\n"
    "VERDICT: one sentence saying whether the app is ready for users on cheap phones and slow networks.\n"
    "ISSUE: what went wrong, in one plain sentence | FIX: what the developers should change, in one sentence\n"
    "(one ISSUE line per real problem, at most 4; if there are no problems, write one ISSUE line saying so with FIX: none)"
)


async def explain(facts: str) -> dict[str, Any]:
    data = await _post(
        "/v1/chat/completions",
        {
            "model": settings.sarvam_chat_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": facts[:6000]},
            ],
            "max_tokens": 3000,
            "reasoning_effort": "low",
            "temperature": 0.2,
        },
        timeout=55.0,
    )
    text = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    return parse_explanation(text)


def parse_explanation(text: str) -> dict[str, Any]:
    verdict = ""
    issues: list[dict[str, str]] = []
    for raw in text.splitlines():
        line = raw.strip().lstrip("-*• ").strip()
        if not line:
            continue
        if line.upper().startswith("VERDICT:"):
            verdict = line.split(":", 1)[1].strip()
        elif line.upper().startswith("ISSUE:"):
            body = line.split(":", 1)[1]
            issue, _, fix = body.partition("|")
            fix = re.sub(r"^\s*FIX:\s*", "", fix, flags=re.I).strip()
            issues.append({"issue": issue.strip(), "fix": fix})
    if not verdict and text.strip():
        verdict = text.strip().split("\n")[0][:400]
    if not verdict:
        raise SarvamError("Sarvam returned an empty explanation")
    return {"verdict": verdict, "issues": issues[:4]}


async def translate(text: str, target: str) -> str:
    if target not in LANGUAGES:
        raise SarvamError("Unsupported language")
    if not text.strip():
        return text
    chunks = _chunks(text, 900)
    out = []
    for chunk in chunks:
        data = await _post(
            "/translate",
            {
                "input": chunk,
                "source_language_code": "en-IN",
                "target_language_code": target,
                "mode": "formal",
                "enable_preprocessing": True,
            },
        )
        out.append(data.get("translated_text", ""))
    return " ".join(out).strip()


async def speak(text: str, target: str) -> bytes:
    if target not in LANGUAGES:
        raise SarvamError("Unsupported language")
    data = await _post(
        "/text-to-speech",
        {"text": text[:1400], "target_language_code": target},
        timeout=55.0,
    )
    audios = data.get("audios") or []
    if not audios:
        raise SarvamError("Sarvam returned no audio")
    return base64.b64decode(audios[0])


def _chunks(text: str, size: int) -> list[str]:
    parts: list[str] = []
    current = ""
    for sentence in re.split(r"(?<=[.!?।])\s+", text):
        if len(current) + len(sentence) + 1 > size and current:
            parts.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        parts.append(current)
    return parts
