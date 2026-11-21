import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Cpu, FileDown, FileSearch, Gauge, ShieldAlert, Wrench } from "lucide-react";
import ScoreRing from "./ScoreRing";
import SarvamTranslation from "./SarvamTranslation";
import { api, type Capabilities } from "../api";
import { downloadEngineRunPdf } from "../pdfExport";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;

export function isEngineReport(report: unknown): boolean {
  return Boolean(report && typeof report === "object" && "engine" in (report as Obj) && "readiness" in (report as Obj));
}

export function engineScore(report: unknown): number | null {
  if (!isEngineReport(report)) return null;
  const overall = (report as Obj).readiness?.overall;
  return typeof overall === "number" ? Math.round(overall) : null;
}

const CATEGORY_LABELS: Record<string, string> = {
  stability: "Stability",
  startup: "Startup",
  ui: "UI smoothness",
  memory: "Memory",
  network: "Network",
  recovery: "Outage recovery"
};

const METRIC_LABELS: Record<string, string> = {
  cold_start_ms: "Cold start",
  jank_percent: "Janky frames",
  memory_pss_mb: "Memory (PSS)"
};

function num(value: unknown, unit = "", digits = 0): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits }) + (unit ? " " + unit : "");
}

function statusTone(status: string | undefined): "low" | "medium" | "critical" {
  if (status === "pass") return "low";
  if (status === "warn") return "medium";
  return "critical";
}

function delta(base: unknown, persona: unknown, lowerIsBetter = true): string {
  if (typeof base !== "number" || typeof persona !== "number" || base === 0) return "";
  const pct = ((persona - base) / Math.abs(base)) * 100;
  if (Math.abs(pct) < 0.5) return "same";
  const worse = lowerIsBetter ? pct > 0 : pct < 0;
  return (pct > 0 ? "+" : "") + pct.toFixed(0) + "%" + (worse ? " worse" : " better");
}

export function engineSummaryText(report: Obj): string {
  const r = report.readiness || {};
  const cons = report.constrained || {};
  const findings: Obj[] = [...(report.baseline?.findings || []), ...(cons.findings || [])];
  const parts = [
    `BharatSim readiness score ${r.overall ?? "n/a"}/100 (${r.status ?? "unknown"}) for ${report.apk?.label || report.apk?.package || "the app"} on persona ${cons.label || report.persona?.name || ""}.`
  ];
  for (const [key, cat] of Object.entries<Obj>(r.categories || {})) {
    parts.push(`${CATEGORY_LABELS[key] || key}: ${cat.score}/100 - ${cat.why}.`);
  }
  for (const f of findings.slice(0, 4)) parts.push(`${f.message} Fix: ${f.fix}`);
  if (!findings.length) parts.push("No crash, ANR, out-of-memory, network or storage failure was found in the app log.");
  return parts.join(" ");
}

export default function EngineReportView({ report, runId }: { report: Obj; runId: string }) {
  const [sarvamEnabled, setSarvamEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    api<Capabilities>("/api/v1/capabilities")
      .then((caps) => live && setSarvamEnabled(Boolean((caps as Obj).sarvam_translation)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const readiness: Obj = report.readiness || {};
  const base: Obj = report.baseline || {};
  const cons: Obj = report.constrained || {};
  const persona: Obj = report.persona || {};
  const applied: Obj = cons.conditions_applied || {};
  const net: Obj = applied.network || {};
  const device: Obj = report.execution?.device || {};
  const ml: Obj = report.ml || {};
  const findings: Obj[] = [
    ...(cons.findings || []).map((f: Obj) => ({ ...f, run: cons.label || "Persona" })),
    ...(base.findings || []).map((f: Obj) => ({ ...f, run: "Baseline" }))
  ];
  const anomalies: Obj[] = report.anomalies || [];
  const score = typeof readiness.overall === "number" ? Math.round(readiness.overall) : 0;
  const personaLabel = cons.label || persona.name || "Persona";

  const rows: Array<[string, unknown, unknown, string, number, boolean]> = [
    ["Median cold start", base.cold_start_ms_median, cons.cold_start_ms_median, "ms", 0, true],
    ["Janky frames", base.frames?.jank_percent, cons.frames?.jank_percent, "%", 1, true],
    ["Frame time p90", base.frames?.frame_p90_ms, cons.frames?.frame_p90_ms, "ms", 0, true],
    ["Memory (PSS)", base.memory?.pss_mb, cons.memory?.pss_mb, "MB", 1, true],
    ["Crashes", base.signals?.crashes, cons.signals?.crashes, "", 0, true],
    ["ANRs (not responding)", base.signals?.anrs, cons.signals?.anrs, "", 0, true],
    ["Out-of-memory errors", base.signals?.ooms, cons.signals?.ooms, "", 0, true],
    ["Low-memory process kills", base.signals?.lmk_kills, cons.signals?.lmk_kills, "", 0, true],
    ["Network failure lines", base.signals?.network_errors, cons.signals?.network_errors, "", 0, true],
    ["Storage failure lines", base.signals?.storage_errors, cons.signals?.storage_errors, "", 0, true],
    ["Monkey events injected", base.exploration?.events_injected, cons.exploration?.events_injected, "", 0, false]
  ];

  return (
    <div className="run-evidence-body engine-report">
      {/* 00 Readiness */}
      <div className="evidence-section">
        <div className="section-kicker">00 / BHARAT READINESS SCORE</div>
        <div className="score-summary engine-score">
          <ScoreRing score={score} />
          <div className="score-copy">
            <span className={"risk-badge " + statusTone(readiness.status)}>{String(readiness.status || "unknown").toUpperCase()}</span>
            <h3>
              {report.apk?.label || report.apk?.package || "App"} on {personaLabel}
            </h3>
            <p>{readiness.methodology || "Weighted category scores from measured telemetry."}</p>
            <small>
              Package <code>{report.apk?.package || "—"}</code> · version {report.apk?.version_name || "—"} · target SDK{" "}
              {report.apk?.target_sdk ?? "—"} · engine {report.engine}
            </small>
          </div>
          <button className="secondary-button" onClick={() => downloadEngineRunPdf(runId, report)}>
            <FileDown size={14} /> Download PDF
          </button>
        </div>
        <div className="category-grid">
          {Object.entries<Obj>(readiness.categories || {}).map(([key, cat]) => (
            <div key={key} className="category-card">
              <div className="category-top">
                <b>{CATEGORY_LABELS[key] || key}</b>
                <span className={"risk-badge " + statusTone(cat.status)}>{cat.score}/100</span>
              </div>
              <div className="category-bar" aria-hidden="true">
                <i className={statusTone(cat.status)} style={{ width: Math.max(0, Math.min(100, Number(cat.score) || 0)) + "%" }} />
              </div>
              <p>{cat.why}</p>
              {readiness.weights?.[key] != null && <small>weight {readiness.weights[key]}%</small>}
            </div>
          ))}
        </div>
      </div>

      {/* 01 Findings */}
      <div className="evidence-section">
        <div className="section-kicker">01 / FINDINGS</div>
        <h3>What went wrong, and how to fix it</h3>
        <p className="section-desc">
          App log lines (warnings, errors, fatal) were classified by the failure model ({ml.model_version || "failure classifier"}). Each finding
          quotes the log lines it came from.
        </p>
        {findings.length === 0 ? (
          <div className="no-evidence">
            No crash, ANR, out-of-memory, network or storage failure lines were found in the app log on either run.
          </div>
        ) : (
          <div className="finding-list">
            {findings.map((f, idx) => (
              <article key={idx} className="finding-card">
                <div className="finding-top">
                  <span className={"severity-icon " + (f.severity === "critical" ? "critical" : f.severity === "high" ? "high" : "medium")}>
                    <ShieldAlert size={16} />
                  </span>
                  <div className="finding-title">
                    <span className="finding-kind">
                      {String(f.category).toUpperCase()} · {f.run} · confidence {Math.round((f.confidence || 0) * 100)}%
                      {f.low_confidence ? " (low)" : ""}
                    </span>
                    <h3>{f.message}</h3>
                  </div>
                  <span className={"risk-badge " + (f.severity === "critical" ? "critical" : f.severity === "high" ? "high" : "medium")}>
                    {String(f.severity || "").toUpperCase()}
                  </span>
                </div>
                {Array.isArray(f.evidence) && f.evidence.length > 0 && (
                  <div className="evidence-box">
                    <div>
                      <FileSearch size={14} /> LOG EVIDENCE ({f.lines_classified} line(s) classified)
                    </div>
                    {f.evidence.map((line: string, i: number) => (
                      <code key={i}>{line}</code>
                    ))}
                  </div>
                )}
                {f.fix && (
                  <div className="recommendation">
                    <Wrench size={14} />
                    <span>
                      <b>Suggested fix</b>
                      {f.fix}
                    </span>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* 02 Baseline vs persona */}
      <div className="evidence-section">
        <div className="section-kicker">02 / BASELINE VS PERSONA</div>
        <h3>Same app, normal phone vs {personaLabel}</h3>
        <p className="section-desc">
          Both runs use the same emulator: 3 cold starts, 150 monkey events, then gfxinfo, meminfo and logcat. The baseline has no network or
          device limits.
        </p>
        <div className="table-wrap">
          <table className="mini-evidence-table">
            <thead>
              <tr>
                <th>METRIC</th>
                <th>BASELINE</th>
                <th>{personaLabel.toUpperCase()}</th>
                <th>CHANGE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, b, p, unit, digits, lower]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{num(b, unit, digits)}</td>
                  <td>{num(p, unit, digits)}</td>
                  <td>{lower ? delta(b, p) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cons.drop && (
          <div className={"alert " + (cons.drop.behaviour === "stayed open" ? "notice-alert" : "error-alert")}>
            {cons.drop.behaviour === "stayed open" ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
            <span>
              Network outage test: airplane mode for {cons.drop.seconds} s. The app {cons.drop.behaviour}
              {cons.drop.recovery_seconds != null
                ? ` and was back in the foreground ${cons.drop.recovery_seconds} s after the network returned.`
                : " and did not return to the foreground within 30 s."}
            </span>
          </div>
        )}
      </div>

      {/* 03 Anomalies */}
      <div className="evidence-section">
        <div className="section-kicker">03 / ANOMALY DETECTION</div>
        <h3>Did the persona run regress?</h3>
        <p className="section-desc">Statistical checks against the baseline launches (z-score, IQR, IsolationForest) and relative change.</p>
        {anomalies.length === 0 ? (
          <div className="no-evidence">Not enough measurements to compare.</div>
        ) : (
          <div className="table-wrap">
            <table className="mini-evidence-table">
              <thead>
                <tr>
                  <th>METRIC</th>
                  <th>METHOD</th>
                  <th>RESULT</th>
                  <th>VERDICT</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a, idx) => (
                  <tr key={idx}>
                    <td>{METRIC_LABELS[a.metric] || a.metric}</td>
                    <td>{a.method}</td>
                    <td>
                      {a.z_score != null
                        ? `persona median ${num(a.persona_median, "ms")} vs baseline mean ${num(a.baseline_mean, "ms")} (z ${a.z_score})`
                        : a.anomalous_launches != null
                        ? `${a.anomalous_launches} of ${a.of} persona launches flagged`
                        : `${num(a.baseline, a.unit, 1)} → ${num(a.persona, a.unit, 1)} (${a.change_pct > 0 ? "+" : ""}${a.change_pct}%)`}
                    </td>
                    <td>
                      <span className={"risk-badge " + (a.regression ? "critical" : "low")}>{a.regression ? "REGRESSION" : "OK"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 04 Conditions */}
      <div className="evidence-section">
        <div className="section-kicker">04 / CONDITIONS APPLIED</div>
        <h3>What the persona run actually used</h3>
        <p className="section-desc">Values read back from the device and the shaping proxy during the persona run.</p>
        <div className="condition-summary-bar">
          <span className="summary-item">
            <small>DEVICE</small>
            <b>
              Android {device.android || "—"} · {num(applied.device?.ram_mb_reported ?? device.hardware?.ram_mb, "MB")} RAM ·{" "}
              {applied.device?.cpu_cores ?? device.hardware?.cores ?? "—"} cores
            </b>
          </span>
          <span className="summary-item">
            <small>NETWORK</small>
            <b>
              {net.down_kbps ? `${num(net.down_kbps)} / ${num(net.up_kbps)} kbps` : "unshaped"}
              {Array.isArray(net.delay_ms) ? ` · ${net.delay_ms[0]}–${net.delay_ms[1]} ms` : ""}
              {net.packet_loss_pct ? ` · ${net.packet_loss_pct}% loss` : ""}
            </b>
          </span>
          <span className="summary-item">
            <small>BATTERY SAVER</small>
            <b>{applied.battery_saver || "off"}</b>
          </span>
          <span className="summary-item">
            <small>FREE STORAGE</small>
            <b>{applied.free_storage_mb != null ? num(applied.free_storage_mb, "MB") : "not limited"}</b>
          </span>
          {applied.screen && (
            <span className="summary-item">
              <small>SCREEN</small>
              <b>{typeof applied.screen === "string" ? applied.screen : JSON.stringify(applied.screen)}</b>
            </span>
          )}
        </div>
        {net.enforced_by && <p className="section-desc">Network shaping: {net.enforced_by}.</p>}
        {report.constraint_verification && (
          <div className={"alert " + (report.network_constraints_applied ? "notice-alert" : "error-alert")}>
            <Gauge size={16} />
            <span>
              {report.network_constraints_applied
                ? `App traffic went through the shaping proxy (${num(cons.network?.connections)} connection(s), ${num(
                    (cons.network?.bytes_down || 0) / 1024,
                    "KB",
                    1
                  )} down).`
                : "Network limits were set, but " + report.constraint_verification + "."}
            </span>
          </div>
        )}
        {persona.cpu_constraint && <p className="section-desc">CPU: {persona.cpu_constraint}.</p>}
      </div>

      {/* 05 Method */}
      <div className="evidence-section">
        <div className="section-kicker">05 / METHOD AND LIMITS</div>
        <h3>How this was measured</h3>
        <div className="limitations">
          <b>
            <Cpu size={13} /> Real emulator run
          </b>
          <p>
            {report.result_interpretation} Started {report.execution?.started_at ? new Date(report.execution.started_at).toLocaleString() : "—"},
            finished {report.execution?.finished_at ? new Date(report.execution.finished_at).toLocaleString() : "—"}.
          </p>
          {ml.holdout_accuracy != null && (
            <p>
              Failure classifier: {ml.samples?.toLocaleString?.() ?? ml.samples} training lines, {ml.evaluation}. Accuracy{" "}
              {(ml.holdout_accuracy * 100).toFixed(1)}%, macro F1 {(ml.holdout_macro_f1 * 100).toFixed(1)}%. {ml.caveat}
            </p>
          )}
          <p>A clean log is not proof the app is healthy; monkey exploration covers only part of the app.</p>
        </div>
      </div>

      <SarvamTranslation enabled={sarvamEnabled} text={engineSummaryText(report)} />
    </div>
  );
}
