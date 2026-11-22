import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ListFilter,
  GitCompare,
  ShieldCheck,
  FileSearch,
  RefreshCw,
  LoaderCircle,
  CircleAlert,
  ArrowDownToLine,
  Activity
} from "lucide-react";
import { type Run, type Persona, type Analysis, type Capabilities } from "../api";
import RunsTable from "./RunsTable";
import CompareRunsView from "./CompareRunsView";
import FixProofView from "./FixProofView";
import ScoreRing from "./ScoreRing";
import FindingCard from "./FindingCard";
import SarvamTranslation from "./SarvamTranslation";

interface RunsHubViewProps {
  runs: Run[];
  personas: Persona[];
  loading: boolean;
  apiStatus: string;
  previewMode: boolean;
  capabilities: Capabilities | null;
  onRefresh: () => Promise<void> | void;
  // Log analysis props
  analysis: Analysis | null;
  logText: string;
  setLogText: (text: string) => void;
  onAnalyzeLogs: (text?: string, personaId?: string) => Promise<void>;
  analysisBusy: boolean;
  onExportJson: () => void;
  onExportPdf: () => void;
}

type RunsTab = "runs" | "compare" | "fixproof" | "analysis";

export default function RunsHubView({
  runs,
  personas,
  loading,
  apiStatus,
  previewMode,
  capabilities,
  onRefresh,
  analysis,
  logText,
  setLogText,
  onAnalyzeLogs,
  analysisBusy,
  onExportJson,
  onExportPdf
}: RunsHubViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const getInitialTab = (): RunsTab => {
    const tab = searchParams.get("tab");
    if (tab === "compare" || tab === "fixproof" || tab === "analysis") return tab;
    return "runs";
  };

  const [activeTab, setActiveTab] = useState<RunsTab>(getInitialTab());

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "compare" || tab === "fixproof" || tab === "analysis") {
      setActiveTab(tab);
    } else if (tab === "all" || !tab) {
      setActiveTab("runs");
    }
  }, [searchParams]);

  const handleTabChange = (tab: RunsTab) => {
    setActiveTab(tab);
    if (tab === "runs") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  return (
    <div className="runs-hub-view page-enter">
      {/* Hub Header with Navigation */}
      <div className="hub-header">
        <div>
          <div className="section-kicker">EXECUTION INTELLIGENCE</div>
          <h2>Test Runs & Evidence</h2>
          <p>Inspect test sessions, compare side-by-side telemetry anomalies, and verify bug fixes.</p>
        </div>

        <div className="segmented-nav" role="tablist" aria-label="Results view selection">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "runs"}
            className={"segmented-tab " + (activeTab === "runs" ? "active" : "")}
            onClick={() => handleTabChange("runs")}
          >
            <ListFilter size={15} />
            <span>All Runs</span>
            <span className="tab-count">{previewMode ? "DEMO" : runs.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "compare"}
            className={"segmented-tab " + (activeTab === "compare" ? "active" : "")}
            onClick={() => handleTabChange("compare")}
          >
            <GitCompare size={15} />
            <span>Compare Runs</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "fixproof"}
            className={"segmented-tab " + (activeTab === "fixproof" ? "active" : "")}
            onClick={() => handleTabChange("fixproof")}
          >
            <ShieldCheck size={15} />
            <span>FixProof</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "analysis"}
            className={"segmented-tab " + (activeTab === "analysis" ? "active" : "")}
            onClick={() => handleTabChange("analysis")}
          >
            <FileSearch size={15} />
            <span>Log Analysis</span>
          </button>
        </div>
      </div>

      {/* Tab 1: All Runs Table */}
      {activeTab === "runs" && (
        <section className="panel full-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">RUN SESSIONS</div>
              <h2>Execution History</h2>
              <p>Only worker-confirmed states count as execution results.</p>
            </div>
            <button
              className="icon-button"
              onClick={() => void onRefresh()}
              aria-label="Refresh test runs"
              disabled={loading}
              title="Refresh runs"
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>
          </div>

          {loading && runs.length === 0 ? (
            <div className="empty-state">
              <LoaderCircle className="spin" size={28} />
              <b>Loading test runs…</b>
              <p>Fetching test sessions and execution history from the API.</p>
            </div>
          ) : apiStatus === "offline" ? (
            <div className="alert error-alert" role="alert">
              <CircleAlert size={18} />
              <span>API is down or unreachable. Unable to load test runs.</span>
            </div>
          ) : previewMode ? (
            <div className="empty-state">
              <div className="empty-icon"><ShieldCheck size={22} /></div>
              <b>Private run history</b>
              <p>Sign in to view saved test runs, worker reports and lifecycle evidence.</p>
            </div>
          ) : capabilities?.database_persistence !== true ? (
            <div className="empty-state">
              <div className="empty-icon"><ListFilter size={22} /></div>
              <b>Run history unavailable</b>
              <p>Persistent PostgreSQL is not configured for this deployment. No saved run history is being reported.</p>
            </div>
          ) : runs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><ListFilter size={22} /></div>
              <b>No runs registered yet</b>
              <p>Launch your first test in the Test Lab to record execution evidence.</p>
              <button
                className="primary-button"
                onClick={() => navigate("/test")}
              >
                Open Test Lab
              </button>
            </div>
          ) : (
            <RunsTable runs={runs} personas={personas} onDeleted={() => onRefresh()} />
          )}
        </section>
      )}

      {/* Tab 2: Compare Telemetry */}
      {activeTab === "compare" && (
        previewMode ? (
          <section className="panel full-panel">
            <div className="empty-state">
              <ShieldCheck size={26} />
              <b>Private run comparison</b>
              <p>Sign in to compare owner-scoped completed runs.</p>
            </div>
          </section>
        ) : capabilities?.run_comparison === true ? (
          <CompareRunsView runs={runs} onBack={() => handleTabChange("runs")} />
        ) : (
          <section className="panel full-panel">
            <div className="empty-state">
              <CircleAlert size={26} />
              <b>Run comparison unavailable</b>
              <p>Persistent PostgreSQL is not configured for this deployment.</p>
              <button type="button" className="secondary-button" onClick={() => handleTabChange("runs")}>Back to all runs</button>
            </div>
          </section>
        )
      )}

      {/* Tab 3: FixProof Verification */}
      {activeTab === "fixproof" && (
        <FixProofView runs={runs} previewMode={previewMode} />
      )}

      {/* Tab 4: Log Analysis */}
      {activeTab === "analysis" && (
        <section className="panel full-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">LOGCAT SIGNAL DETECTOR</div>
              <h2>Log analysis results</h2>
              <p>Paste Android logcat output to detect crash, ANR, memory, network and storage anomalies.</p>
            </div>
            {analysis && (
              <div className="report-export-actions">
                <button className="secondary-button" onClick={onExportPdf}>
                  <ArrowDownToLine size={15} /> Export PDF
                </button>
                <button className="secondary-button" onClick={onExportJson}>
                  <ArrowDownToLine size={15} /> Export JSON
                </button>
              </div>
            )}
          </div>

          {/* Log input area */}
          <div className="log-input-box" style={{ marginBottom: 24 }}>
            <textarea
              aria-label="Android logcat evidence"
              disabled={previewMode}
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder="Paste Android logcat output here to inspect failure signals…"
              rows={4}
              className="speak-textarea"
            />
            <div className="log-actions" style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="primary-button"
                disabled={previewMode || analysisBusy || apiStatus !== "online" || !logText.trim()}
                onClick={() => void onAnalyzeLogs(logText)}
              >
                {analysisBusy ? <LoaderCircle className="spin" size={15} /> : <Activity size={15} />}
                {analysisBusy ? "Analyzing evidence…" : "Analyze logcat"}
              </button>
              {analysis && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setLogText("")}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Analysis Results Display */}
          {analysis && (
            <div className="analysis-results-wrapper page-enter">
              <div className="score-summary">
                <ScoreRing score={analysis.bharat_score.value} />
                <div className="score-copy">
                  <span className="section-kicker">
                    BHARATSCORE · {analysis.bharat_score.label.toUpperCase()}
                  </span>
                  <h3>
                    {analysis.summary.clean
                      ? "No known signals detected"
                      : "Signals detected in supplied logs"}
                  </h3>
                  <p>{analysis.bharat_score.method}</p>
                  <small>{analysis.bharat_score.warning}</small>
                </div>
                <div className="finding-totals">
                  <span>
                    <b>{analysis.summary.critical}</b>
                    <small>Critical</small>
                  </span>
                  <span>
                    <b>{analysis.summary.high}</b>
                    <small>High</small>
                  </span>
                  <span>
                    <b>{analysis.summary.medium}</b>
                    <small>Medium</small>
                  </span>
                </div>
              </div>

              <SarvamTranslation
                enabled={Boolean(capabilities?.sarvam_translation)}
                text={[
                  "BharatScore: " + analysis.bharat_score.value + "/100 — " + analysis.bharat_score.label + ".",
                  ...analysis.findings.slice(0, 5).map((f) => f.severity + ": " + f.title + ". " + f.explanation + " Recommendation: " + f.recommendation)
                ].join("\n").slice(0, 2000)}
              />

              <div className="findings-list" style={{ marginTop: 24 }}>
                <div className="section-heading">
                  <h3>Detected Signals ({analysis.findings.length})</h3>
                </div>
                {analysis.findings.length === 0 ? (
                  <p className="clean-note">No failure signals detected in the provided log sample.</p>
                ) : (
                  analysis.findings.map((finding) => (
                    <FindingCard key={finding.id} finding={finding} />
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
