# Judge demo script (about 12 minutes)

Live: https://bharatsim.onrender.com. The team worker (laptop + Android emulator) must be online:
the sidebar shows "Android Worker · ONLINE". Each run takes about 4–5 minutes, so start the two
runs early (step 3) and talk through steps 4–6 while they execute.

1. **Sign in** (top-right). Sarvam features and runs need an account.
2. **Speak to Test** (sidebar).
   - Press **Speak** and say, in Hindi or Hinglish: *"Mera payment app slow network mein payment ke baad pending dikhata hai. Check karo retry par double charge toh nahi hota."* Or click **Hinglish example**.
   - Point out: the transcript (Sarvam `saaras:v4`) and the interpreted plan (Sarvam `sarvam-105b`, request id and latency shown). Journey: payment; matched scenario: *UPI-style payment pending + retry*; three machine-checked pass criteria.
   - Click **Show JSON**: schema-validated output; only the scenario id and persona reach the worker.
3. **Run BharatPay Mock 1.0 (original)**, then come back and **Run BharatPay Mock 1.1 (fixed)**.
   - These are test fixtures; no real money is involved.
4. While they run, show honesty handling:
   - Click **Unsupported example** (telemedicine + incoming call + CPU throttling). The plan lists *incoming call* and *CPU throttle* as **not applied**, with the reason.
   - Type something vague (*"app ko achhe se test karo"*). It asks a clarifying question instead of running.
5. **Test Runs → the original run** when it completes. Scenario section:
   - *Payment failed. Please retry.* while the bank had already confirmed: honest pending state **FAILED**.
   - Gateway charge log shows **2 charges** for one order: no duplicate charge **FAILED**.
   - Scroll to **Explain this result** → *Public-service decision maker* → *Hindi* → **Explain** → **Listen** (Bulbul v3). The explanation cites the evidence ids it used.
6. **The fixed run**: the app shows *pending* and the gateway records **1 charge**, so all assertions pass.
7. **FixProof** (sidebar): original vs fixed → **Fixed and verified**, with the per-assertion before/after table and preconditions checked (same scenario, same spec, different APK hash, both executed).
8. Optional: pick the same run twice, or a run without a scenario. FixProof refuses or returns **Verification blocked**; it never claims a fix it did not measure.

## If something fails during the demo
- Worker offline: runs stay *queued*. FixProof says *Verification blocked*, which is the intended behaviour.
- Sarvam down: Speak-to-Test falls back to the labelled rule-based interpreter; explanations return a clear error.
