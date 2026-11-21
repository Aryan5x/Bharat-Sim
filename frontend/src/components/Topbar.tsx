import {
  ChevronRight,
  RefreshCw,
  Zap
} from "lucide-react";

interface TopbarProps {
  currentTab: string;
  runId?: string;
  apiStatus: string;
  loading: boolean;
  onRefresh: () => void;
  onOpenEvaluatorTour: () => void;
  onNavigateTab: (tab: string) => void;
}

export default function Topbar({
  currentTab,
  runId,
  apiStatus,
  loading,
  onRefresh,
  onOpenEvaluatorTour,
  onNavigateTab
}: TopbarProps) {
  const tabTitles: Record<string, string> = {
    overview: "Overview & Dashboard",
    speak: "Speak to Test",
    fixproof: "FixProof",
    connect: "Connect a Laptop",
    "new-test": "Configure New Test",
    runs: "Test Runs",
    analysis: "Logcat & ML Analysis",
    compare: "Telemetry Anomaly Comparison",
    landing: "Platform Showcase",
    settings: "Workspace Settings"
  };

  const apiStatusStyle =
    apiStatus === "online"
      ? { background: "rgba(54,201,149,0.1)", color: "#36C995", border: "1px solid rgba(54,201,149,0.25)" }
      : apiStatus === "offline"
      ? { background: "rgba(241,109,120,0.1)", color: "#F16D78", border: "1px solid rgba(241,109,120,0.25)" }
      : { background: "rgba(118,103,248,0.1)", color: "#7667F8", border: "1px solid rgba(118,103,248,0.25)" };

  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <button
          type="button"
          className="breadcrumb-link"
          onClick={() => onNavigateTab("overview")}
        >
          Workspace
        </button>
        <ChevronRight size={13} className="breadcrumb-sep" />
        {runId ? (
          <>
            <button
              type="button"
              className="breadcrumb-link"
              onClick={() => onNavigateTab("runs")}
            >
              Test Runs
            </button>
            <ChevronRight size={13} className="breadcrumb-sep" />
            <b className="breadcrumb-current">Run {runId.slice(0, 8)}</b>
          </>
        ) : (
          <b className="breadcrumb-current">{tabTitles[currentTab] || "Overview"}</b>
        )}
      </div>

      <div className="top-actions">
        <a
          className="api-docs-link"
          href="https://github.com/kaustubhdua/Bharat-Sim#readme"
          target="_blank"
          rel="noreferrer"
          aria-label="Project documentation on GitHub"
        >
          Docs
        </a>

        {/* Evaluator Quick Tour Shortcut Button */}
        <button
          type="button"
          className="evaluator-quick-tour-btn"
          onClick={onOpenEvaluatorTour}
          title="Open Evaluator Quick Tour with 2 preloaded scenarios"
          style={{ color: "#7667F8" }}
        >
          <Zap size={14} style={{ color: "#7667F8" }} />
          <span>Evaluator Tour</span>
        </button>

        {/* API Status Pill */}
        <span
          className={"api-state " + apiStatus}
          style={apiStatusStyle}
        >
          <span />
          <span>
            API{" "}
            {apiStatus === "online"
              ? "Connected"
              : apiStatus === "offline"
              ? "Unavailable"
              : "Checking"}
          </span>
        </span>

        {/* Refresh button */}
        <button
          type="button"
          className="icon-button"
          onClick={onRefresh}
          aria-label="Refresh data"
          disabled={loading}
          title="Refresh operational state"
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} />
        </button>

        {/* User / Workspace Badge */}
        <div
          className="avatar"
          title="BharatSim Active Workspace"
          style={{ background: "linear-gradient(135deg, #7667F8, #9A8BFF)" }}
        >
          BS
        </div>
      </div>
    </header>
  );
}
