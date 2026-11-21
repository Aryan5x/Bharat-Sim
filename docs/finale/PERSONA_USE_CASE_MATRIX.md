# Persona Use Case Matrix (BharatSim, Team Deccans)

Status key: **WORKING** = runs end to end on the live product today; **PARTIAL** = works with stated limits;
**ARCHITECTURE ONLY** = designed, not built.

| Segment | Use case | Status | How it works / what is missing |
|---|---|---|---|
| **1. Startup Android developers and QA (primary)** | Describe a payment bug in Hindi/Hinglish by voice or text and get a runnable test plan | WORKING | Speak-to-Test → Sarvam `saaras:v4` (voice) and `sarvam-105b` (structured JSON) → validated spec with supported/unsupported conditions |
| | Reproduce "payment pending, retry charges twice" and verify the fix | WORKING (fixture) | Janjeevan pack A on the BharatPay Mock fixture: real emulator, uiautomator journey, mock gateway, 3 machine-checked assertions; FixProof compares original vs fixed build. Assertions only run on the fixture, not on arbitrary APKs |
| | Budget-phone resilience run on their own APK | WORKING | Upload APK → baseline vs persona run (cold start ×3, monkey, gfxinfo, meminfo, logcat, ML classifier, anomalies, readiness score, PDF) |
| **2. Regional product managers / founders** | Understand a failed test in their language without reading logs | WORKING | Run page → "Explain this result" → Product manager audience → Hindi/Tamil/Marathi via Sarvam, cites evidence ids, spoken with Bulbul v3 |
| | Ship / no-ship decision across builds | PARTIAL | FixProof verdict + readiness score; no release dashboard across many builds yet |
| **3. Digital-public-service app vendors / decision makers** | Plain-language impact summary for officials | WORKING | Same explanation flow with the "Public-service decision maker" audience |
| | Government form survives a dropped connection without duplicate submission | ARCHITECTURE ONLY | Janjeevan pack B listed as planned: needs a form fixture and mock submission backend (same pattern as pack A) |
| | Accessibility basics (large font, screen reader labels) | ARCHITECTURE ONLY | Pack F planned: needs font-scale automation and accessibility-tree checks |
| **4. Education / health app teams** | Assignment upload interrupted; telemedicine reconnection | ARCHITECTURE ONLY | Packs C and D planned; network drop + recovery already measured by the engine, assertions not built |

## Architecture for the remaining journeys
Every pack follows pack A: a small fixture app (one source, original and fixed builds), a mock backend hosted by
the worker on 127.0.0.1, a scripted uiautomator journey, and assertions computed from screen text and backend
records. The scenario id is allowlisted server-side; Speak-to-Test can only select packs that exist.

## Limitations stated to users
- CPU throttling, incoming calls, app switching, screen lock, GPS and font scaling are not applied (Speak-to-Test lists them as unsupported).
- Network shaping only affects apps that use the Android system proxy; each report says whether app traffic went through it.
- Pack A's delay is injected by the mock gateway, not by network shaping.
- Execution needs the team's worker (laptop + emulator) to be online.
