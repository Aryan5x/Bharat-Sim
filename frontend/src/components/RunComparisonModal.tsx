import { useState, useEffect } from "react";
import { X, GitCompare, AlertTriangle, CheckCircle2, TrendingUp, LoaderCircle } from "lucide-react";
import { compareRuns, type ComparisonResult, type Run } from "../api";

interface RunComparisonModalProps {
  currentRunId?: string;
  runs: Run[];
  onClose: () => void;
}

export default function RunComparisonModal({
  currentRunId,
  runs,
  onClose
}: RunComparisonModalProps) {
  const completedRuns = runs.filter((r) => r.status === "completed" || r.id === currentRunId);
  const [baselineId, setBaselineId] = useState<string>(() => {
    const base = completedRuns.find((r) => r.persona_id === "baseline");
    return base ? base.id : completedRuns[0]?.id || "";
  });
  const [constrainedId, setConstrainedId] = useState<string>(() => {
    return currentRunId || completedRuns.find((r) => r.persona_id !== "baseline")?.id || completedRuns[1]?.id || "";
  });
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runComparison = async () => {
    if (!baselineId || !constrainedId) {
      setError("Please select both a baseline and a constrained run to compare.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await compareRuns(baselineId, constrainedId);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (baselineId && constrainedId) {
      void runComparison();
    }
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog comparison-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="section-kicker">ANOMALY DETECTION & COMPARATIVE TELEMETRY</span>
            <h2>Compare Baseline vs. Constrained Execution</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="comparison-selectors">
            <div className="selector-group">
              <label htmlFor="baseline-select">Baseline Run (Ideal Network / Device)</label>
              <select
                id="baseline-select"
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.apk_name || "APK"} · {r.persona_id} ({r.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>

            <div className="selector-icon">
              <GitCompare size={20} />
            </div>

            <div className="selector-group">
              <label htmlFor="constrained-select">Constrained Run (BharatSim Persona)</label>
              <select
                id="constrained-select"
                value={constrainedId}
                onChange={(e) => setConstrainedId(e.target.value)}
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.apk_name || "APK"} · {r.persona_id} ({r.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="comparison-action">
            <button
              type="button"
              className="primary-button"
              disabled={loading || !baselineId || !constrainedId}
              onClick={() => void runComparison()}
            >
              {loading ? <LoaderCircle size={15} className="spin" /> : <GitCompare size={15} />}
              {loading ? "Computing Covariance Anomalies…" : "Run ML Anomaly Comparison"}
            </button>
          </div>

          {error && <div className="alert error-alert">{error}</div>}

          {result && (
            <div className="comparison-results">
              <div className={"verdict-banner " + (result.anomaly_detected ? "anomaly-fail" : "anomaly-pass")}>
                <div className="verdict-icon">
                  {result.anomaly_detected ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                </div>
                <div>
                  <h3>{result.verdict}</h3>
                  <p>{result.details}</p>
                  <small>Multivariate statistical anomaly score: <b>{result.anomaly_score.toFixed(2)}</b> / 100</small>
                </div>
              </div>

              <h4>Telemetry Metric Divergence</h4>
              <div className="anomaly-metric-grid">
                {result.anomalies.map((an) => (
                  <div key={an.metric} className={"anomaly-card " + an.status}>
                    <div className="metric-header">
                      <span>{an.metric.replace(/_/g, " ").toUpperCase()}</span>
                      <span className={"status-tag " + an.status}>{an.status.replace("_", " ").toUpperCase()}</span>
                    </div>
                    <div className="metric-values">
                      <div className="base-val">
                        <small>Baseline</small>
                        <b>{an.baseline}</b>
                      </div>
                      <div className="arrow">→</div>
                      <div className="const-val">
                        <small>Constrained</small>
                        <b>{an.constrained}</b>
                      </div>
                    </div>
                    <div className="delta-bar">
                      <TrendingUp size={12} />
                      <span>{an.delta_pct >= 0 ? `+${an.delta_pct}%` : `${an.delta_pct}%`} divergence</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

