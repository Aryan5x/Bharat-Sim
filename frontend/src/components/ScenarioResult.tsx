import { CheckCircle2, CircleAlert, ShieldCheck, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;

export default function ScenarioResult({ scenario, spec }: { scenario: Obj; spec?: Obj | null }) {
  const navigate = useNavigate();
  const assertions: Obj[] = scenario.assertions || [];
  const charges: Obj[] = scenario.gateway?.charges || [];
  const verdictTone = scenario.verdict === "pass" ? "low" : scenario.verdict === "fail" ? "critical" : "medium";

  return (
    <div className="evidence-section scenario-result">
      <div className="section-kicker">SCENARIO · {String(scenario.pack || "").toUpperCase()}</div>
      <div className="scenario-head">
        <h3>{scenario.title || scenario.id}</h3>
        <span className={"risk-badge " + verdictTone}>
          {scenario.status === "completed" ? (scenario.verdict === "pass" ? "ALL ASSERTIONS PASS" : "ASSERTIONS FAILED") : String(scenario.status || "").toUpperCase()}
        </span>
      </div>
      {spec?.objective && (
        <p className="section-desc">
          Requested in Speak-to-Test ({spec.language_detected}): “{spec.request_text || spec.objective}”
        </p>
      )}
      {scenario.status !== "completed" ? (
        <div className="alert notice-alert"><CircleAlert size={16} /><span>{scenario.reason || "The scenario did not run."}</span></div>
      ) : (
        <>
          <div className="assertion-list">
            {assertions.map((a) => (
              <div key={a.id} className={"assertion-row " + (a.passed ? "pass" : "fail")}>
                {a.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <div>
                  <b>{a.label}</b>
                  <small>{a.observed}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="scenario-evidence">
            <div>
              <b>Journey driven on the emulator</b>
              <ol>
                {(scenario.steps || []).map((s: Obj, i: number) => (
                  <li key={i}>{s.step}{s.screen ? <>: <q>{s.screen}</q></> : null}</li>
                ))}
              </ol>
            </div>
            <div>
              <b>Mock gateway charge log</b>
              {charges.length === 0 ? <p className="no-evidence">No charges recorded.</p> : (
                <table className="mini-evidence-table">
                  <thead><tr><th>#</th><th>ORDER</th><th>IDEMPOTENCY KEY</th><th>TIME (UTC)</th></tr></thead>
                  <tbody>
                    {charges.map((c, i) => (
                      <tr key={i}><td>{i + 1}</td><td>{c.order_id}</td><td><code>{String(c.idempotency_key).slice(0, 18)}</code></td><td>{String(c.at).slice(11, 19)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {scenario.app_log?.length > 0 && (
                <details>
                  <summary>App log lines ({scenario.app_log.length})</summary>
                  <div className="evidence-box">{scenario.app_log.map((l: string, i: number) => <code key={i}>{l}</code>)}</div>
                </details>
              )}
            </div>
          </div>
        </>
      )}
      <p className="section-desc scenario-fault"><ShieldCheck size={13} /> {scenario.fault_injection}</p>
      {scenario.status === "completed" && (
        <button type="button" className="secondary-button" onClick={() => navigate("/fixproof")}>Compare builds in FixProof</button>
      )}
    </div>
  );
}
