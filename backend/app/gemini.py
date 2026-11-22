"""Google Gemini Integration for BharatSim.

Provides:
1. Multi-turn reasoning & test plan generation.
2. Structured output parsing for Android resilience test plans.
3. Diagnostic analysis & vernacular explanation support.
"""
from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class GeminiProviderError(Exception):
    """The upstream Gemini service failed or returned an invalid response."""


class GeminiNotConfigured(GeminiProviderError):
    """Gemini API credentials are not set."""


def get_gemini_api_key() -> str:
    """Retrieve server-side Gemini key from environment."""
    return (
        os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("gemini_api", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
    )


def is_gemini_configured() -> bool:
    return len(get_gemini_api_key()) >= 16


def gemini_chat_json(system_prompt: str, prompt: str, schema: dict[str, Any] | None = None) -> dict[str, Any]:
    """Call Google Gemini generateContent with JSON response format."""
    api_key = get_gemini_api_key()
    if not api_key:
        raise GeminiNotConfigured("GEMINI_API_KEY is not set.")

    model = os.getenv("BHARATSIM_GEMINI_MODEL", "gemini-1.5-flash").strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    generation_config: dict[str, Any] = {
        "temperature": 0.2,
        "responseMimeType": "application/json",
    }
    if schema:
        generation_config["responseSchema"] = schema

    contents = []
    if system_prompt:
        contents.append({"role": "user", "parts": [{"text": f"System Instructions:\n{system_prompt}"}]})
        contents.append({"role": "model", "parts": [{"text": "Understood. I will strictly generate structured JSON according to the instructions."}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = json.dumps({
        "contents": contents,
        "generationConfig": generation_config,
    }).encode("utf-8")

    req = Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    t0 = time.perf_counter()
    try:
        with urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read(256 * 1024).decode("utf-8"))
    except HTTPError as exc:
        raise GeminiProviderError(f"Gemini API returned status {exc.code}") from None
    except (URLError, TimeoutError, OSError) as exc:
        raise GeminiProviderError(f"Gemini connection failed: {exc}") from None

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    try:
        text_content = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise GeminiProviderError("Gemini response missing candidate parts.")

    return {
        "content": text_content,
        "model": model,
        "request_id": f"gemini-{uuid.uuid4().hex[:8]}",
        "latency_ms": elapsed_ms,
        "provider": "gemini",
    }
