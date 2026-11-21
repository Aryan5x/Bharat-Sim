"""Live Sarvam evidence for Speak-to-Test (run locally; needs SARVAM_API_KEY in the repo-root .env).

    python scripts/sarvam_live_check.py

Calls the real API through BharatSim's own endpoints/functions and writes the responses (never the key)
to docs/evidence/sarvam_live_check.json.
"""
from __future__ import annotations

import base64
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for raw in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if raw.startswith("SARVAM_API_KEY="):
        os.environ["SARVAM_API_KEY"] = raw.split("=", 1)[1].strip()
os.environ["BHARATSIM_AUTH_REQUIRED"] = "false"
os.environ.setdefault("BHARATSIM_ENV", "development")
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient  # noqa: E402

from app import main  # noqa: E402
from app.sarvam import generate_speech_audio, transcribe_audio  # noqa: E402

client = TestClient(main.app)
REQUESTS = {
    "hindi": "मेरा पेमेंट ऐप धीमे नेटवर्क में पेमेंट के बाद पेंडिंग दिखा रहा है। जाँच करो कि रीट्राई करने पर डुप्लिकेट रिक्वेस्ट तो नहीं जाती।",
    "hinglish": "Mera payment app slow network mein payment karne ke baad pending dikha raha hai. Check karo ki retry karne par duplicate request toh nahi hoti.",
    "ambiguous": "app ko achhe se test kar do",
    "unsupported": "Test my telemedicine app when a phone call comes in and the CPU is throttled on 2G.",
    "tamil": "என் பேமெண்ட் ஆப் மெதுவான நெட்வொர்க்கில் பணம் செலுத்திய பிறகு pending காட்டுகிறது. மீண்டும் முயற்சி செய்தால் இரண்டு முறை பணம் எடுக்கப்படுகிறதா என்று சோதிக்கவும்.",
}
out: dict = {"generated_at": datetime.now(timezone.utc).isoformat(), "interpret": {}}
for name, text in REQUESTS.items():
    res = client.post("/api/v1/speak/interpret", json={"text": text})
    spec = res.json()
    out["interpret"][name] = {"status": res.status_code, "request": text, "spec": spec}
    print(f"{name}: {res.status_code} provider={spec.get('interpreter', {}).get('provider')} "
          f"mode={spec.get('execution', {}).get('mode')} scenario={spec.get('matched_scenario')} "
          f"lang={spec.get('language_detected')} unsupported={[c['condition'] for c in spec.get('unsupported_conditions', [])]} "
          f"latency={spec.get('interpreter', {}).get('latency_ms')}ms")

voice = generate_speech_audio("नमस्ते। अनुरोध भेजा गया, लेकिन पुष्टि प्राप्त नहीं हुई। दोबारा प्रयास करने से पहले स्थिति की जाँच करें।", "hi-IN")
wav = base64.b64decode(voice["audio_base64"])
stt = transcribe_audio(wav, "report.wav", "audio/wav")
out["tts"] = {k: voice[k] for k in ("format", "language_code", "speaker", "model", "request_id", "is_fixture")} | {"bytes": len(wav)}
out["stt_of_tts"] = stt
print("tts:", out["tts"])
print("stt:", stt)
ta = generate_speech_audio("கோரிக்கை அனுப்பப்பட்டது, ஆனால் உறுதிப்படுத்தல் வரவில்லை.", "ta-IN")
out["tts_tamil"] = {"request_id": ta.get("request_id"), "bytes": len(base64.b64decode(ta["audio_base64"]))}
out["stt_of_tts_tamil"] = transcribe_audio(base64.b64decode(ta["audio_base64"]), "ta.wav", "audio/wav")
print("tamil tts->stt:", out["stt_of_tts_tamil"])
dest = ROOT / "docs" / "evidence" / "sarvam_live_check.json"
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", dest.relative_to(ROOT))
