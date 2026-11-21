# BharatSim finale audit (21 Nov 2026)

Audited commit `9699864` on `kaustubhdua/Bharat-Sim` main, live at https://bharatsim.onrender.com.
The one-page build plan (verified commit `f725583`) was treated as a baseline, not proof. Every row below was
re-checked against source, tests or the live deployment.

## Status matrix (before the finale slice)

| Feature | Status | Evidence / reason |
|---|---|---|
| Dashboard, personas, landing | VERIFIED WORKING | Live; 5 personas from `/api/v1/personas` |
| Risk planner (Interaction Hunter) | VERIFIED WORKING | `POST /api/v1/plan` returns 200 live |
| Failure DNA log analysis + BharatScore | VERIFIED WORKING | `POST /api/v1/analyze/logs`; Evaluator Tour crash fixed in `9699864` |
| PostgreSQL readiness | VERIFIED WORKING | `/health/ready` → `database: available` |
| Authentication (Supabase JWT, JWKS) | VERIFIED WORKING | Anonymous `GET /api/v1/runs` → 401 live |
| Tenant isolation | PARTIALLY VERIFIED | Every run query is `owner_id`-scoped in code and covered by tests; not penetration-tested |
| APK upload (signed PUT to private bucket) | VERIFIED WORKING | Real uploads of Rooftop.apk completed today |
| Worker execution (real emulator) | WORKER-GATED | Laptop worker + AVD `bharat_low`; runs `3b1ee9a4` (score 90) and `cb497274` (89) completed. Stops when the laptop or emulator is off (the emulator was found stopped during this audit) |
| Network shaping | PARTIALLY WORKING | Host shaping proxy applies latency, bandwidth, loss stalls, resets and outages. It only shapes traffic that uses the Android system proxy; for Rooftop the report shows no app traffic went through it |
| RAM limits | PARTIALLY WORKING | Below 2 GB (in-guest balloon) or 3–4 GB (AVD restart); 2 GB personas run as is |
| CPU throttling | UNSUPPORTED | No per-app throttle on the emulator; stated in UI and reports |
| Run report, PDF, JSON export | VERIFIED WORKING | Engine report view shipped in `9699864` |
| Run comparison | VERIFIED IN TESTS | Engine reports compared by persona leg; not re-checked live while signed in |
| Sarvam translation | VERIFIED WORKING | `sarvam-translate:v1`, Hindi/Tamil/Marathi; probed today |
| Sarvam voice (Bulbul TTS) | FAILING | Code calls `bulbul:v1` with speaker `meera`; Sarvam now rejects that (400). Live endpoint returns "Sarvam TTS service unavailable" |
| Sarvam TTS endpoint auth | SECURITY GAP | `/api/v1/translate/audio` is reachable without sign-in (credit abuse) |
| "Sarvam explanation" on findings | NOT SARVAM | `explain_failure_with_sarvam` returns fixed English templates; only the optional Hindi path calls Sarvam Translate |
| Speech-to-text, chat/LLM | NOT IMPLEMENTED | Probed today: `saaras:v4` and `sarvam-105b` (JSON-schema output) both work with the server key |
| Microphone in browser | BLOCKED | `Permissions-Policy: microphone=()` |
| Render auto-deploy | FAILING | Pushes to `kaustubhdua/Bharat-Sim` do not trigger deploys; manual deploy needed |

## Sarvam API facts verified today
- Chat: `POST https://api.sarvam.ai/v1/chat/completions`, model `sarvam-105b`, `response_format: json_schema` — 200, schema-valid JSON, ~0.4 s.
- Speech-to-text: `POST /speech-to-text`, model `saaras:v4`, `language_code=unknown` — 200, Hindi transcript, ~0.5 s.
- Text-to-speech: `POST /text-to-speech`, model `bulbul:v3`, speaker `priya`, field `language_code` — 200.
- Translate: `sarvam-translate:v1` en→ta — 200.

## Priorities chosen
1. Speak-to-Test (voice/text → validated test spec) on Sarvam, in the core flow.
2. One controlled scenario pack (UPI-style payment pending + retry) with machine-checked assertions on a mock fixture.
3. FixProof: deterministic verdict from two real runs of the same scenario.
4. Fix Bulbul TTS, lock Sarvam endpoints behind sign-in, allow microphone for this origin.
