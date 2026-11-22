import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleAlert, Clock3, FileUp, LoaderCircle, Mic, ShieldCheck, Sparkles, Square, XCircle } from "lucide-react";
import { type Persona, type Run } from "../api";
import {
  fetchSampleBuild,
  interpretRequest,
  listScenarioPacks,
  runScenarioPayload,
  transcribeVoice,
  type ScenarioPack,
  type TestSpec
} from "../speak";

export type SubmitRunOptions = {
  personaId: string;
  customPersona?: Record<string, unknown> | null;
  scenario: ReturnType<typeof runScenarioPayload>;
};

interface SpeakToTestViewProps {
  personas: Persona[];
  previewMode: boolean;
  busy: boolean;
  onSubmitRun: (file: File, options: SubmitRunOptions) => Promise<void>;
  runs?: Run[];
}

const EXAMPLES = [
  { label: "Crash on 2G", text: "Meri app 2G network par crash ho rahi hai, why is it happening and how can I fix that?" },
  { label: "Freeze on drop", text: "App freezes when network drops, tell me why and how to fix." },
  { label: "Out of memory", text: "Images load karte waqt out of memory error se band ho jata hai, fix batao." },
  { label: "UPI Pending", text: "Mera payment app slow network mein payment karne ke baad pending dikha raha hai. Check karo retry par duplicate request toh nahi hoti." },
  { label: "Hindi", text: "मेरा पेमेंट ऐप धीमे नेटवर्क में पेमेंट के बाद पेंडिंग दिखा रहा है। जाँच करो कि रीट्राई करने पर डुप्लिकेट रिक्वेस्ट तो नहीं जाती।" },
  { label: "Hinglish", text: "Mera payment app slow network mein payment karne ke baad pending dikha raha hai. Check karo ki retry karne par duplicate request toh nahi hoti." },
  { label: "Tamil", text: "என் பேமெண்ட் ஆப் மெதுவான நெட்வொர்க்கில் பணம் செலுத்திய பிறகு pending காட்டுகிறது. மீண்டும் முயற்சி செய்தால் இரண்டு முறை பணம் எடுக்கப்படுகிறதா என்று சோதிக்கவும்." },
  { label: "Unsupported", text: "Test my telemedicine app when a phone call comes in and the CPU is throttled on 2G." }
];

const MAX_RECORD_MS = 25000;
const STORE_KEY = "bharatsim.speak.plan";

function loadPlan(): { text: string; spec: TestSpec | null } {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // storage blocked or corrupted: start empty
  }
  return { text: "", spec: null };
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export default function SpeakToTestView({ personas, previewMode, busy, onSubmitRun, runs = [] }: SpeakToTestViewProps) {
  // The plan survives navigating to a run and back, so the second build can reuse it.
  const [text, setText] = useState(() => loadPlan().text);
  const [spec, setSpec] = useState<TestSpec | null>(() => loadPlan().spec);
  const [error, setError] = useState("");
  const [working, setWorking] = useState<"" | "interpret" | "transcribe">("");
  const [recording, setRecording] = useState(false);
  const [transcriptNote, setTranscriptNote] = useState("");
  const [packs, setPacks] = useState<ScenarioPack[]>([]);
  const [showJson, setShowJson] = useState(false);
  const [ownApk, setOwnApk] = useState<File | null>(null);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stopTimer = useRef<number | null>(null);

  useEffect(() => {
    listScenarioPacks().then(setPacks).catch(() => setPacks([]));
    return () => {
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ text, spec }));
    } catch {
      // per-tab convenience only
    }
  }, [text, spec]);

  const scenario = packs.find((p) => p.id === spec?.execution.scenario_id);
  const personaName = (id: string) => personas.find((p) => p.id === id)?.name || id;

  async function interpret(value = text) {
    if (value.trim().length < 3) {
      setError("Describe what you want to test (at least a few words).");
      return;
    }
    setError("");
    setWorking("interpret");
    setSpec(null);
    try {
      setSpec(await interpretRequest(value.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not interpret the request.");
    } finally {
      setWorking("");
    }
  }

  async function startRecording() {
    setError("");
    setTranscriptNote("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not available in this browser. Type the request instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) return;
        setWorking("transcribe");
        try {
          const result = await transcribeVoice(blob);
          if (!result.transcript.trim()) {
            setError("Sarvam did not hear any speech in that recording. Check that the right microphone is selected, speak for a few seconds, then stop.");
            return;
          }
          setText(result.transcript);
          setTranscriptNote(`Sarvam ${result.model} heard ${result.language_code || "an Indian language"} in ${result.latency_ms} ms.`);
          if (result.transcript.trim().length >= 3) await interpret(result.transcript);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not transcribe the recording.");
        } finally {
          setWorking("");
        }
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      stopTimer.current = window.setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORD_MS);
    } catch {
      setError("Microphone access was blocked. Allow the microphone for this site or type the request.");
    }
  }

  function stopRecording() {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function runSample(path: string, variant: string) {
    if (!spec) return;
    setError("");
    try {
      const file = await fetchSampleBuild(path, `bharatpay-${variant}.apk`);
      await onSubmitRun(file, { personaId: spec.execution.persona_id, scenario: runScenarioPayload(spec, spec.execution.scenario_id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run.");
    }
  }

  async function runGenericSample() {
    if (!spec) return;
    setError("");
    try {
      const file = await fetchSampleBuild("/samples/fragile-news.apk", "fragile-news.apk");
      await onSubmitRun(file, {
        personaId: spec.execution.persona_id,
        customPersona: spec.execution.custom_persona ?? null,
        scenario: runScenarioPayload(spec, spec.execution.scenario_id)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run.");
    }
  }

  async function runOwnApk() {
    if (!spec || !ownApk) return;
    await onSubmitRun(ownApk, {
      personaId: spec.execution.persona_id,
      customPersona: spec.execution.custom_persona ?? null,
      scenario: runScenarioPayload(spec, spec.execution.scenario_id)
    });
  }

  return (
    <div className="speak-view">
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">SPEAK-TO-TEST · SARVAM AI</div>
            <h2>Describe the problem. Get a test you can run.</h2>
            <p>
              Speak or type in Hindi, Hinglish, Tamil, Marathi or English. Sarvam turns it into a structured test plan; BharatSim checks it against
              what the emulator can really do, then runs it and records evidence.
            </p>
          </div>
          <div className="panel-icon"><Sparkles size={19} /></div>
        </div>

        {previewMode && (
          <div className="alert notice-alert" role="status">
            <ShieldCheck size={16} />
            <span>Sign in to use Speak-to-Test. AI requests and runs are tied to your account and rate limited.</span>
          </div>
        )}

        {/* Step 1: Choose APK to test */}
        <div className="speak-section">
          <label className="field-label">1. Choose APK to test</label>
          <div className="apk-selector-row">
            <label className="secondary-button file-upload-button">
              <FileUp size={14} />
              <span>{ownApk ? "Change APK" : "Upload your APK"}</span>
              <input
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                aria-label="Choose your APK"
                className="sr-only"
                disabled={busy || previewMode}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setOwnApk(f);
                    setSelectedSample(null);
                  }
                }}
              />
            </label>

            <span className="or-divider">or choose sample app:</span>

            <button
              type="button"
              className={"chip-button " + (selectedSample === "fragile-news" ? "active" : "")}
              onClick={() => { setSelectedSample("fragile-news"); setOwnApk(null); }}
            >
              📰 Fragile News <small>(General APK · 2G crash)</small>
            </button>
            <button
              type="button"
              className={"chip-button " + (selectedSample === "bharatpay-original" ? "active" : "")}
              onClick={() => { setSelectedSample("bharatpay-original"); setOwnApk(null); }}
            >
              💳 BharatPay 1.0 <small>(UPI retry bug)</small>
            </button>
            <button
              type="button"
              className={"chip-button " + (selectedSample === "bharatpay-fixed" ? "active" : "")}
              onClick={() => { setSelectedSample("bharatpay-fixed"); setOwnApk(null); }}
            >
              ✓ BharatPay 1.1 <small>(Fixed)</small>
            </button>
          </div>

          {(ownApk || selectedSample) && (
            <div className="selected-apk-badge">
              <CheckCircle2 size={14} className="ok" />
              <span>
                Target: <b>{ownApk ? ownApk.name : selectedSample === "fragile-news" ? "Fragile News (fragile-news.apk)" : selectedSample === "bharatpay-original" ? "BharatPay Mock 1.0 (original)" : "BharatPay Mock 1.1 (fixed)"}</b>
                {ownApk ? ` (${(ownApk.size / (1024 * 1024)).toFixed(1)} MB)` : ""}
              </span>
              <button
                type="button"
                className="text-button remove-apk-button"
                onClick={() => { setOwnApk(null); setSelectedSample(null); }}
              >
                ✕ Clear
              </button>
            </div>
          )}

          {runs && runs.length > 0 && (
            <div className="recent-runs-preview">
              <span className="or-divider">or diagnose an existing run:</span>
              <div className="recent-runs-chips">
                {runs.slice(0, 3).map((r) => (
                  <Link key={r.id} to={`/runs/${r.id}`} className="chip-button" title="View run and diagnosis">
                    <span>{r.apk_name || "APK"}</span>
                    <small>({r.status})</small>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <label className="field-label" htmlFor="speak-text">2. Describe the problem or ask for a fix</label>
        <textarea
          id="speak-text"
          className="speak-textarea"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Meri app 2G network par crash ho rahi hai, why is it happening and how can I fix that? Or: App freezes on slow connection, ask for fix"
          rows={3}
        />
        <div className="speak-examples" aria-label="Example requests">
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" className="chip-button" onClick={() => setText(ex.text)}>
              {ex.label} example
            </button>
          ))}
        </div>
        <div className="speak-actions">
          <button
            type="button"
            className={"secondary-button " + (recording ? "recording" : "")}
            onClick={recording ? stopRecording : () => void startRecording()}
            disabled={previewMode || working !== ""}
            aria-pressed={recording}
          >
            {recording ? <Square size={14} /> : <Mic size={14} />}
            {recording ? "Stop recording" : "Speak (up to 25 s)"}
          </button>
          <button type="button" className="primary-button" onClick={() => void interpret()} disabled={previewMode || working !== "" || recording}>
            {working === "interpret" ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
            {working === "interpret" ? "Sarvam is reading your request…" : "Create test plan"}
          </button>
          {working === "transcribe" && (
            <span className="speak-status"><LoaderCircle size={14} className="spin" /> Transcribing with Sarvam…</span>
          )}
        </div>
        {transcriptNote && <p className="speak-note">{transcriptNote}</p>}
        {error && (
          <div className="alert error-alert" role="alert"><CircleAlert size={16} /><span>{error}</span></div>
        )}
      </section>

      {spec && (
        <section className="panel full-panel spec-panel" aria-live="polite">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">INTERPRETED TEST PLAN · {spec.spec_id}</div>
              <h2>{spec.objective}</h2>
              <p>
                Journey: <b>{humanize(spec.journey)}</b> · Persona: <b>{personaName(spec.execution.persona_id)}</b> · Language heard:{" "}
                <b>{spec.language_detected}</b>
              </p>
            </div>
            <span className={"risk-badge " + (spec.execution.eligible ? "low" : spec.execution.mode === "blocked" ? "critical" : "medium")}>
              {spec.execution.mode === "scenario" ? "SCENARIO" : spec.execution.mode === "generic" ? "GENERIC RUN" : spec.execution.mode === "blocked" ? "BLOCKED" : "NEEDS DETAIL"}
            </span>
          </div>

          <div className={"alert " + (spec.execution.eligible ? "notice-alert" : "error-alert")}>
            {spec.execution.eligible ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
            <span>{spec.execution.reason}</span>
          </div>

          {spec.clarifications_needed.length > 0 && (
            <div className="spec-block">
              <b>Questions before testing</b>
              <ul>{spec.clarifications_needed.map((q) => <li key={q}>{q}</li>)}</ul>
              <small>Add the answer to your request above and create the plan again.</small>
            </div>
          )}

          {spec.symptom && spec.execution.mode !== "scenario" && (
            <div className="spec-block symptom-block">
              <b>Problem to check</b>
              <span>{spec.symptom_label}</span>
              <small>
                {spec.symptom_checkable
                  ? "After the run, BharatSim checks whether this actually happened, then explains why and how to fix it."
                  : "This can't be detected automatically on any app; the run reports what it did observe and explains it."}
              </small>
            </div>
          )}

          <div className="spec-grid">
            <div className="spec-block">
              <b>Conditions</b>
              {spec.supported_conditions.length === 0 && spec.unsupported_conditions.length === 0 && <small>No special conditions requested.</small>}
              {spec.supported_conditions.map((c) => (
                <div key={c.condition} className="spec-row"><CheckCircle2 size={13} className="ok" /><span><b>{humanize(c.condition)}</b> · {c.note}</span></div>
              ))}
              {spec.unsupported_conditions.map((c) => (
                <div key={c.condition} className="spec-row"><XCircle size={13} className="bad" /><span><b>{humanize(c.condition)}</b> · not applied: {c.note}</span></div>
              ))}
            </div>
            <div className="spec-block">
              <b>Pass criteria</b>
              {spec.machine_checked_assertions.map((a) => (
                <div key={a.id} className="spec-row"><CheckCircle2 size={13} className="ok" /><span>{a.label} <small>· machine-checked</small></span></div>
              ))}
              {spec.not_machine_verified.map((a) => (
                <div key={a} className="spec-row"><Clock3 size={13} className="warn" /><span>{humanize(a)} <small>· not machine-verified</small></span></div>
              ))}
              {spec.machine_checked_assertions.length === 0 && spec.not_machine_verified.length === 0 && <small>None stated.</small>}
            </div>
            <div className="spec-block">
              <b>Evidence to collect</b>
              <div className="condition-chips">{spec.evidence.map((e) => <span key={e} className="condition-chip verifiable">{humanize(e)}</span>)}</div>
              {spec.expected_behaviour.length > 0 && (
                <>
                  <b className="spec-sub">Expected behaviour</b>
                  <ul>{spec.expected_behaviour.map((e) => <li key={e}>{e}</li>)}</ul>
                </>
              )}
            </div>
          </div>

          <div className="spec-interpreter">
            <ShieldCheck size={14} />
            <span>
              {spec.interpreter.fallback
                ? `Rule-based fallback used (${spec.interpreter.fallback_reason}). Sarvam did not interpret this request.`
                : `Interpreted by Sarvam ${spec.interpreter.model} in ${spec.interpreter.latency_ms} ms · request ${spec.interpreter.request_id}.`}
              {" "}Output validated against a strict schema; only the scenario id and persona reach the worker.
              {spec.interpreter.redacted_input ? " Personal data and secrets were redacted before sending." : ""}
            </span>
            <button type="button" className="text-button" onClick={() => setShowJson(!showJson)}>{showJson ? "Hide" : "Show"} JSON</button>
          </div>
          {showJson && <pre className="spec-json">{JSON.stringify(spec, null, 2)}</pre>}

          {spec.execution.eligible && spec.execution.mode === "scenario" && scenario && (
            <div className="spec-run">
              <div>
                <div className="section-kicker">{scenario.pack.toUpperCase()}</div>
                <h3>{scenario.title}</h3>
                <p>{scenario.setup}</p>
              </div>
              <div className="spec-run-actions">
                {scenario.sample_builds?.map((b) => (
                  <button key={b.variant} type="button" className={b.variant === "original" ? "secondary-button" : "primary-button"}
                    disabled={busy || previewMode} onClick={() => void runSample(b.path, b.variant)}>
                    {busy ? <LoaderCircle size={14} className="spin" /> : <FileUp size={14} />} Run {b.label}
                  </button>
                ))}
              </div>
              <small>Run the original first, then the fixed build, and compare them in FixProof. Each run takes about 4 minutes on the emulator.</small>
            </div>
          )}

          {spec.execution.eligible && (
            <div className="spec-run">
              <div>
                <div className="section-kicker">
                  {ownApk ? "READY TO RUN YOUR APK" : selectedSample ? "READY TO RUN SAMPLE" : (spec.execution.mode === "scenario" ? "YOUR OWN APK" : "RUN IT ON YOUR APK")}
                </div>
                <h3>
                  {ownApk
                    ? `Run ${ownApk.name} & Diagnose`
                    : selectedSample === "fragile-news"
                    ? "Run Fragile News & Diagnose"
                    : selectedSample === "bharatpay-original"
                    ? "Run BharatPay Mock 1.0 (original)"
                    : selectedSample === "bharatpay-fixed"
                    ? "Run BharatPay Mock 1.1 (fixed)"
                    : (spec.execution.mode === "scenario" ? "Your own APK" : "Choose your APK or try Fragile News")}
                </h3>
                <p>{spec.execution.mode === "scenario"
                  ? "Your APK gets the generic baseline vs persona run; the scenario assertions need the BharatPay Mock fixture and will be reported as blocked for other apps."
                  : `Choose your APK. BharatSim runs it ${spec.execution.custom_persona ? "under the conditions you described" : "on the budget phone"}, compares it with a normal phone, then the run page shows whether the problem happened, why, and how to fix it.`}</p>
              </div>
              <div className="spec-run-actions">
                {ownApk ? (
                  <button type="button" className="primary-button" disabled={busy || previewMode} onClick={() => void runOwnApk()}>
                    {busy ? <LoaderCircle size={14} className="spin" /> : <FileUp size={14} />} Run {ownApk.name} & Diagnose
                  </button>
                ) : selectedSample === "fragile-news" ? (
                  <button type="button" className="primary-button" disabled={busy || previewMode} onClick={() => void runGenericSample()}>
                    {busy ? <LoaderCircle size={14} className="spin" /> : <FileUp size={14} />} Run Fragile News & Diagnose
                  </button>
                ) : selectedSample === "bharatpay-original" ? (
                  <button type="button" className="primary-button" disabled={busy || previewMode} onClick={() => void runSample("/samples/bharatpay-original.apk", "original")}>
                    {busy ? <LoaderCircle size={14} className="spin" /> : <FileUp size={14} />} Run BharatPay Mock 1.0
                  </button>
                ) : selectedSample === "bharatpay-fixed" ? (
                  <button type="button" className="primary-button" disabled={busy || previewMode} onClick={() => void runSample("/samples/bharatpay-fixed.apk", "fixed")}>
                    {busy ? <LoaderCircle size={14} className="spin" /> : <FileUp size={14} />} Run BharatPay Mock 1.1
                  </button>
                ) : (
                  <>
                    <input type="file" accept=".apk,application/vnd.android.package-archive" aria-label="Choose your APK"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setOwnApk(f); setSelectedSample(null); }
                      }} disabled={busy || previewMode} />
                    <button type="button" className="secondary-button" disabled={!ownApk || busy || previewMode} onClick={() => void runOwnApk()}>
                      <FileUp size={14} /> Run with this plan
                    </button>
                    {spec.execution.mode === "generic" && (
                      <button type="button" className="text-button" disabled={busy || previewMode} onClick={() => void runGenericSample()}
                        title="A small test app (no real data) whose news feed crashes on slow networks">
                        No APK handy? Try the sample Fragile News app
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">JANJEEVAN SCENARIO PACKS</div>
            <h2>Moments users cannot afford to lose</h2>
            <p>Only packs with a controlled fixture and machine-checked assertions can run. The rest are listed with what they still need.</p>
          </div>
        </div>
        <div className="pack-grid">
          {packs.map((p) => (
            <article key={p.id} className={"pack-card " + p.status}>
              <div className="pack-top">
                <small>{p.pack}</small>
                <span className={"risk-badge " + (p.status === "executable" ? "low" : "medium")}>{p.status === "executable" ? "RUNS NOW" : "PLANNED"}</span>
              </div>
              <b>{p.title}</b>
              <p>{p.user_problem}</p>
              {p.status === "planned" && <small className="pack-reason">{p.reason}</small>}
              {p.status === "executable" && p.assertions && (
                <ul>{p.assertions.map((a) => <li key={a.id}>{a.label}</li>)}</ul>
              )}
            </article>
          ))}
          {packs.length === 0 && <p className="no-evidence">Scenario packs could not be loaded.</p>}
        </div>
      </section>
    </div>
  );
}
