import { useEffect, useRef, useState } from "react";
import { CircleAlert, Download, FileText, LoaderCircle, Mic, Send, Square, Volume2, VolumeX } from "lucide-react";
import { api } from "../api";
import { transcribeVoice } from "../speak";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;
type Turn = { role: "user" | "assistant"; content: string; translated?: string | null; audio?: string | null; cites?: string[] };

const LANGS = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "mr-IN", label: "Marathi" }
];

const VERDICT_LABEL: Record<string, string> = {
  ready: "Ready to release",
  ready_with_fixes: "Release after fixes",
  not_ready: "Not ready to release",
  insufficient_evidence: "Not enough evidence"
};

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportText(r: Obj): string {
  const a = r.analysis || {};
  const m = r.metadata || {};
  const lines = [
    `BharatSim developer report v${r.version}  (${r.generated_at})`,
    `App: ${m.app_name} (${m.package}) ${m.version || ""}   Run: ${m.run_id}   Persona: ${m.persona}`,
    `Bharat Readiness Score: ${r.readiness?.overall}/100 (${r.readiness?.status})   Verdict: ${VERDICT_LABEL[a.verdict] || r.status}`,
    "", "EXECUTIVE SUMMARY", a.executive_summary || "(AI analysis unavailable)", "",
    "BASELINE VS CONSTRAINED",
    ...(r.comparison || []).map((c: Obj) => `  ${c.metric}: ${c.baseline ?? "-"} -> ${c.constrained ?? "-"} ${c.unit}${c.percent != null ? ` (${c.percent > 0 ? "+" : ""}${c.percent}%)` : ""}${c.regression ? "  REGRESSION" : ""}`),
    "", "ISSUES",
    ...(a.issues || []).flatMap((i: Obj) => [
      `- [${i.issue_id}] ${i.title}`, `  Observed: ${i.observed_behaviour}`, `  Likely cause: ${i.likely_root_cause}`,
      `  Impact: ${i.user_impact}`, ...(i.remediation || []).map((s: string) => `  Fix: ${s}`),
      ...(i.reproduction_steps || []).map((s: string, n: number) => `  Repro ${n + 1}: ${s}`), `  Evidence: ${(i.evidence_ids || []).join(", ")}`
    ]),
    "", "NETWORK RESILIENCE", a.network_resilience || "-", "",
    "RELEASE CONDITIONS", ...(a.release_conditions || []).map((s: string) => `  - ${s}`), "",
    "EVIDENCE APPENDIX", ...(r.evidence || []).map((e: Obj) => `  ${e.id}: ${e.fact}`)
  ];
  return lines.join("\n");
}

export default function AiReportAssistant({ runId, runFinished }: { runId: string; runFinished: boolean }) {
  const [report, setReport] = useState<Obj | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("hi-IN");
  const [asking, setAsking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [chatError, setChatError] = useState("");
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    api<Obj>("/api/v1/runs/" + encodeURIComponent(runId) + "/developer-report").then(setReport).catch(() => undefined);
    return () => audioRef.current?.pause();
  }, [runId]);

  async function generate() {
    setReportBusy(true);
    setReportError("");
    try {
      setReport(await api<Obj>("/api/v1/runs/" + encodeURIComponent(runId) + "/developer-report", { method: "POST" }));
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Could not generate the report.");
    } finally {
      setReportBusy(false);
    }
  }

  function play(b64?: string | null) {
    if (!b64) return;
    audioRef.current?.pause();
    const audio = new Audio("data:audio/wav;base64," + b64);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    setPlaying(true);
    void audio.play().catch(() => setPlaying(false));
  }

  function stopAudio() {
    audioRef.current?.pause();
    setPlaying(false);
  }

  async function ask(text: string) {
    const q = text.trim();
    if (q.length < 2 || asking) return;
    const history = [...turns, { role: "user" as const, content: q }];
    setTurns(history);
    setInput("");
    setAsking(true);
    setChatError("");
    try {
      const res = await api<Obj>("/api/v1/runs/" + encodeURIComponent(runId) + "/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-8).map((t) => ({ role: t.role, content: t.content })), language_code: lang, speak: true })
      });
      const turn: Turn = { role: "assistant", content: res.answer, translated: res.translated_text, audio: res.audio?.audio_base64 || null,
        cites: (res.cited_evidence || []).map((e: Obj) => e.id) };
      setTurns([...history, turn]);
      play(turn.audio);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "The assistant could not answer.");
    } finally {
      setAsking(false);
    }
  }

  async function toggleMic() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    setChatError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        try {
          const t = await transcribeVoice(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
          if (!t.transcript.trim()) setChatError("No speech was heard. Try again.");
          else await ask(t.transcript);
        } catch (err) {
          setChatError(err instanceof Error ? err.message : "Could not transcribe.");
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      setTimeout(() => rec.state === "recording" && rec.stop(), 25000);
    } catch {
      setChatError("Microphone access was blocked.");
    }
  }

  const a = report?.analysis;
  return (
    <>
      <section className="panel sarvam-panel ai-report" aria-labelledby="devreport-title">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">DEVELOPER REPORT · GEMINI</div>
            <h2 id="devreport-title">Release-readiness report</h2>
            <p>Facts come from this run's measurements. Gemini writes only the analysis, and every issue cites the evidence it is based on.</p>
          </div>
          <div className="panel-icon"><FileText size={19} /></div>
        </div>
        <div className="explain-controls">
          <button type="button" className="primary-button" onClick={() => void generate()} disabled={reportBusy || !runFinished}>
            {reportBusy ? <LoaderCircle size={14} className="spin" /> : <FileText size={14} />} {report ? "Regenerate report" : "Generate report"}
          </button>
          {report && (
            <>
              <button type="button" className="secondary-button" onClick={() => download(`bharatsim-report-${runId.slice(0, 8)}-v${report.version}.json`, JSON.stringify(report, null, 2), "application/json")}>
                <Download size={14} /> JSON
              </button>
              <button type="button" className="secondary-button" onClick={() => download(`bharatsim-report-${runId.slice(0, 8)}-v${report.version}.txt`, reportText(report), "text/plain")}>
                <Download size={14} /> Text report
              </button>
            </>
          )}
        </div>
        {reportError && <div className="alert error-alert" role="alert"><CircleAlert size={16} /><span>{reportError}</span></div>}
        {report && (
          <div className="explain-result">
            <p className="speak-note">Version {report.version} · {report.generated_at} · {report.model || report.status}</p>
            <div className={"fp-verdict " + (a?.verdict === "ready" ? "low" : a?.verdict === "not_ready" ? "critical" : "medium")}>
              <span className={"risk-badge " + (a?.verdict === "ready" ? "low" : a?.verdict === "not_ready" ? "critical" : "medium")}>
                {(VERDICT_LABEL[a?.verdict] || "AI analysis unavailable").toUpperCase()}
              </span>
              <p>Bharat Readiness Score {report.readiness?.overall}/100 · critical {report.severity_counts?.critical} · high {report.severity_counts?.high}</p>
            </div>
            {a && <p>{a.executive_summary}</p>}
            <div className="table-wrap">
              <table className="mini-evidence-table">
                <thead><tr><th>METRIC</th><th>BASELINE</th><th>CONSTRAINED</th><th>CHANGE</th></tr></thead>
                <tbody>
                  {(report.comparison || []).map((c: Obj) => (
                    <tr key={c.metric}><td>{c.metric}</td><td>{c.baseline ?? "—"} {c.unit}</td><td>{c.constrained ?? "—"} {c.unit}</td>
                      <td>{c.percent != null ? `${c.percent > 0 ? "+" : ""}${c.percent}%` : c.difference ?? ""}{c.regression ? " · regression" : ""}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(a?.issues || []).map((i: Obj) => (
              <details key={i.issue_id} className="ai-issue" open>
                <summary><b>[{i.issue_id}]</b> {i.title}</summary>
                <p><b>Observed:</b> {i.observed_behaviour}</p>
                <p><b>Likely root cause:</b> {i.likely_root_cause}</p>
                <p><b>User impact:</b> {i.user_impact}</p>
                {i.remediation?.length > 0 && <><b>Recommended fixes</b><ol>{i.remediation.map((s: string) => <li key={s}>{s}</li>)}</ol></>}
                {i.code_snippet && <pre className="spec-json">{i.code_snippet}</pre>}
                {i.reproduction_steps?.length > 0 && <><b>Reproduction {i.reproduction_is_recorded ? "(recorded)" : "(proposed)"}</b><ol>{i.reproduction_steps.map((s: string) => <li key={s}>{s}</li>)}</ol></>}
                <small className="speak-note">Evidence: {(i.evidence_ids || []).join(", ")}</small>
              </details>
            ))}
            {a?.network_resilience && <><h3>Network resilience</h3><p>{a.network_resilience}</p></>}
            {a?.release_conditions?.length > 0 && <><h3>Before release</h3><ul>{a.release_conditions.map((s: string) => <li key={s}>{s}</li>)}</ul></>}
            <details><summary>Evidence appendix ({report.evidence?.length})</summary>
              <ul>{(report.evidence || []).map((e: Obj) => <li key={e.id}><code>{e.id}</code> {e.fact}</li>)}</ul>
            </details>
          </div>
        )}
      </section>

      <section className="panel sarvam-panel ai-assistant" aria-labelledby="assistant-title">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">VOICE ASSISTANT · SARVAM AI</div>
            <h2 id="assistant-title">Ask about this run</h2>
            <p>Speak or type a question. Sarvam answers from this run's evidence and speaks the answer back. One question and answer at a time.</p>
          </div>
        </div>
        <div className="assistant-log">
          {turns.length === 0 && <p className="speak-note">Try: “Why did my app crash?”, “Sabse pehle kya fix karun?”, “Compare baseline and constrained.”</p>}
          {turns.map((t, n) => (
            <div key={n} className={"assistant-turn " + t.role}>
              <b>{t.role === "user" ? "You" : "BharatSim"}</b>
              <p>{t.translated || t.content}</p>
              {t.translated && <small className="speak-note">{t.content}</small>}
              {t.role === "assistant" && t.audio && <button type="button" className="text-button" onClick={() => play(t.audio)}><Volume2 size={13} /> Replay</button>}
              {t.cites && t.cites.length > 0 && <small className="speak-note">Evidence: {t.cites.join(", ")}</small>}
            </div>
          ))}
          {asking && <p className="speak-note"><LoaderCircle size={13} className="spin" /> Thinking…</p>}
        </div>
        <div className="explain-controls">
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Answer language">
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button type="button" className={"secondary-button " + (recording ? "recording" : "")} onClick={() => void toggleMic()} disabled={asking || !runFinished}>
            {recording ? <Square size={14} /> : <Mic size={14} />} {recording ? "Stop" : "Speak"}
          </button>
          <input className="connect-input assistant-input" value={input} maxLength={600} placeholder="Type a question" onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void ask(input)} disabled={!runFinished} />
          <button type="button" className="primary-button" onClick={() => void ask(input)} disabled={asking || input.trim().length < 2}><Send size={14} /> Ask</button>
          {playing && <button type="button" className="text-button" onClick={stopAudio}><VolumeX size={13} /> Stop audio</button>}
        </div>
        {chatError && <div className="alert error-alert" role="alert"><CircleAlert size={16} /><span>{chatError}</span></div>}
      </section>
    </>
  );
}
