import { useState } from "react";
import { CircleAlert, Languages, LoaderCircle, ShieldCheck } from "lucide-react";
import SarvamAudioPlayer from "./SarvamAudioPlayer";
import { explainRun, type RunExplanation } from "../speak";

const AUDIENCES = [
  { id: "developer", label: "Developer" },
  { id: "product", label: "Product manager" },
  { id: "public", label: "Public-service decision maker" }
] as const;

const LANGUAGES = [
  { code: "hi-IN", label: "Hindi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "mr-IN", label: "Marathi" },
  { code: "en-IN", label: "English" }
] as const;

export default function ExplainPanel({ runId }: { runId: string }) {
  const [audience, setAudience] = useState<string>("public");
  const [language, setLanguage] = useState<string>("hi-IN");
  const [result, setResult] = useState<RunExplanation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function explain() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await explainRun(runId, audience, language));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not explain this report.");
    } finally {
      setBusy(false);
    }
  }

  const spoken = result ? result.translated_text || [result.english.headline, ...result.english.points, result.english.recommendation].join(" ") : "";

  return (
    <section className="panel sarvam-panel" aria-labelledby="explain-title">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">CITIZEN IMPACT TRANSLATOR · SARVAM AI</div>
          <h2 id="explain-title">Explain this result</h2>
          <p>Sarvam explains only the measured evidence above, for the person who has to act on it, in their language.</p>
        </div>
        <div className="panel-icon"><Languages size={19} /></div>
      </div>
      <div className="explain-controls">
        <div className="audience-toggle" role="radiogroup" aria-label="Audience">
          {AUDIENCES.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={audience === a.id}
              className={"chip-button " + (audience === a.id ? "active" : "")} onClick={() => setAudience(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
        <label htmlFor="explain-lang" className="field-label">Language</label>
        <select id="explain-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <button type="button" className="primary-button" onClick={() => void explain()} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="spin" /> : <Languages size={14} />} Explain
        </button>
      </div>
      <div className="evidence-note">
        <ShieldCheck size={15} />
        Only the report's summary facts (scores, assertions, findings) are sent, with secrets and personal data removed. Raw logcat is never sent.
      </div>
      {error && <div className="alert error-alert" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
      {result && (
        <div className="explain-result">
          {result.translated_text && <p className="explain-translated" lang={result.language_code.slice(0, 2)}>{result.translated_text}</p>}
          {result.translation_failed && <p className="speak-note">Translation is unavailable right now; showing English.</p>}
          <h3>{result.english.headline}</h3>
          <ul>{result.english.points.map((p) => <li key={p}>{p}</li>)}</ul>
          <p><b>Recommendation:</b> {result.english.recommendation}</p>
          <details>
            <summary>Evidence this explanation is based on ({result.cited_evidence.length})</summary>
            <ul>{result.cited_evidence.map((e) => <li key={e.id}><code>{e.id}</code> {e.fact}</li>)}</ul>
          </details>
          <small className="speak-note">Sarvam {result.interpreter.model} · {result.interpreter.latency_ms} ms · request {result.interpreter.request_id}</small>
          <SarvamAudioPlayer text={spoken.slice(0, 500)} defaultLang={language === "en-IN" ? "en-IN" : language} label="Listen (Bulbul voice)" />
        </div>
      )}
    </section>
  );
}
