import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { date, type Run } from "../api";
import { runFixProof, type FixProofVerdict } from "../speak";

interface FixProofViewProps {
  runs: Run[];
  previewMode: boolean;
}

const TONE: Record<string, "low" | "medium" | "critical"> = {
  FIXED_AND_VERIFIED: "low",
  NOT_REPRODUCED: "medium",
  VERIFICATION_BLOCKED: "medium",
  UNSUPPORTED: "medium",
  STILL_FAILING: "critical",
  REGRESSION_INTRODUCED: "critical",
  DIFFERENT_FAILURE: "critical"
};

function cell(value: boolean | null) {
  if (value === true) return <span className="fp-pass"><CheckCircle2 size={13} /> pass</span>;
  if (value === false) return <span className="fp-fail"><XCircle size={13} /> fail</span>;
  return <span className="fp-none">not run</span>;
}

export default function FixProofView({ runs, previewMode }: FixProofViewProps) {
  const navigate = useNavigate();
  const scenarioRuns = useMemo(() => runs.filter((r) => r.scenario_id), [runs]);
  const [originalId, setOriginalId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [verdict, setVerdict] = useState<FixProofVerdict | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (originalId || candidateId || scenarioRuns.length < 2) return;
    // Default: the most recent failing run as original, the most recent passing run as candidate.
    const failing = scenarioRuns.find((r) => r.scenario_verdict === "fail");
    const passing = scenarioRuns.find((r) => r.scenario_verdict === "pass" && r.id !== failing?.id);
    setOriginalId((failing || scenarioRuns[1]).id);
    setCandidateId((passing || scenarioRuns.find((r) => r.id !== (failing || scenarioRuns[1]).id) || scenarioRuns[0]).id);
  }, [scenarioRuns, originalId, candidateId]);

  async function compare() {
    setError("");
    setVerdict(null);
    setLoading(true);
    try {
      setVerdict(await runFixProof(originalId, candidateId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "FixProof failed.");
    } finally {
      setLoading(false);
    }
  }

  const label = (r: Run) => `${r.apk_name || "APK"} · ${date(r.created_at)} · ${r.scenario_verdict || r.status} (${r.id.slice(0, 8)})`;

  return (
    <section className="panel full-panel fixproof-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">FIXPROOF · EVIDENCE-BACKED FIX VERIFICATION</div>
          <h2>Did the new build actually fix it?</h2>
          <p>
            Pick the run of the original build and the run of the corrected build. Both must have completed the same scenario. FixProof
            compares the measured assertions; it never calls something fixed because a change looks right.
          </p>
        </div>
        <div className="panel-icon"><ShieldCheck size={19} /></div>
      </div>

      {previewMode ? (
        <div className="alert notice-alert"><ShieldCheck size={16} /><span>Sign in to compare your own runs.</span></div>
      ) : scenarioRuns.length < 2 ? (
        <div className="empty-state">
          <b>FixProof needs two scenario runs</b>
          <p>Create a plan in Speak-to-Test, run the original sample build and then the fixed one. They will appear here when finished.</p>
          <button type="button" className="primary-button" onClick={() => navigate("/speak")}>Open Speak-to-Test</button>
        </div>
      ) : (
        <>
          <div className="comparison-selectors fp-selectors">
            <div className="selector-group">
              <label htmlFor="fp-original">Original build run</label>
              <select id="fp-original" value={originalId} onChange={(e) => setOriginalId(e.target.value)}>
                {scenarioRuns.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
              </select>
            </div>
            <div className="selector-group">
              <label htmlFor="fp-candidate">Corrected build run</label>
              <select id="fp-candidate" value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
                {scenarioRuns.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
              </select>
            </div>
          </div>
          <button type="button" className="primary-button" onClick={() => void compare()} disabled={loading || !originalId || !candidateId || originalId === candidateId}>
            {loading ? <LoaderCircle size={14} className="spin" /> : <ShieldCheck size={14} />} Verify the fix
          </button>
          {originalId === candidateId && originalId && <p className="speak-note">Choose two different runs.</p>}
        </>
      )}

      {error && <div className="alert error-alert" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}

      {verdict && (
        <div className="fp-result" aria-live="polite">
          <div className={"fp-verdict " + TONE[verdict.verdict]}>
            <span className={"risk-badge " + TONE[verdict.verdict]}>{verdict.label.toUpperCase()}</span>
            <p>{verdict.summary}</p>
          </div>
          {verdict.assertions.length > 0 && (
            <div className="table-wrap">
              <table className="mini-evidence-table fp-table">
                <thead><tr><th>ASSERTION</th><th>ORIGINAL</th><th>CORRECTED</th><th>OBSERVED ON CORRECTED BUILD</th></tr></thead>
                <tbody>
                  {verdict.assertions.map((a) => (
                    <tr key={a.id}>
                      <td>{a.label}</td>
                      <td title={a.original_observed}>{cell(a.original)}</td>
                      <td>{cell(a.candidate)}</td>
                      <td>{a.candidate_observed || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="spec-block">
            <b>Preconditions checked</b>
            {verdict.preconditions.map((c) => (
              <div key={c.check} className="spec-row">
                {c.passed ? <CheckCircle2 size={13} className="ok" /> : <XCircle size={13} className="bad" />}
                <span><b>{c.check}</b> · {c.detail}</span>
              </div>
            ))}
          </div>
          <p className="speak-note">
            Original run <button type="button" className="text-button" onClick={() => navigate("/runs/" + verdict.original.run_id)}>{verdict.original.run_id.slice(0, 8)}</button>
            {" "}(APK {verdict.original.apk_sha256?.slice(0, 12)}…) vs corrected run{" "}
            <button type="button" className="text-button" onClick={() => navigate("/runs/" + verdict.candidate.run_id)}>{verdict.candidate.run_id.slice(0, 8)}</button>
            {" "}(APK {verdict.candidate.apk_sha256?.slice(0, 12)}…).
          </p>
        </div>
      )}
    </section>
  );
}
