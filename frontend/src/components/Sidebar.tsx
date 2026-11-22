import {
  Layers3,
  FlaskConical,
  Activity,
  Settings,
  Moon,
  Sun,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  LogOut
} from "lucide-react";
import { useTheme } from "../theme";
import { type Worker } from "../api";
import { readSession, signOut } from "../auth";

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  workers: Worker[];
  previewMode: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  runsCount: number;
}

export default function Sidebar({
  currentTab,
  onSelectTab,
  workers,
  previewMode,
  collapsed,
  onToggleCollapse,
  runsCount
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const session = readSession();
  const onlineWorkers = workers.filter((w) => w.online);
  const isOnline = onlineWorkers.length > 0;

  return (
    <aside className={"sidebar page-enter " + (collapsed ? "collapsed" : "")}>
      {/* Brand Header */}
      <div className="brand">
        <div className="brand-mark">
          <span style={{ background: "linear-gradient(135deg, #7667F8, #9A8BFF)" }}>B</span>
        </div>
        {!collapsed && (
          <div className="brand-copy">
            <b>BharatSim</b>
            <small>THE CHEAP PHONE TEST</small>
          </div>
        )}
        <button
          type="button"
          className="collapse-toggle-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Workspace Indicator */}
      {!collapsed && (
        <div className="workspace-pill">
          <div className="workspace-icon">
            <Smartphone size={14} />
          </div>
          <div className="workspace-copy">
            <b>Production Workspace</b>
            <small>{previewMode ? "Guest Preview" : session?.user?.email || "Enterprise Tier"}</small>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <div className="nav-label">{!collapsed && "NAVIGATION"}</div>
      <nav className="sidebar-nav">
        <button
          type="button"
          className={"nav-item " + (currentTab === "overview" || currentTab === "landing" ? "active" : "")}
          onClick={() => onSelectTab("overview")}
          title="Overview & Dashboard"
        >
          <Layers3 size={17} />
          {!collapsed && <span>Overview</span>}
        </button>

        <button
          type="button"
          className={"nav-item " + (currentTab === "test" || currentTab === "speak" || currentTab === "new-test" ? "active" : "")}
          onClick={() => onSelectTab("test")}
          title="Test Lab: Speak-to-Test or Configure Persona"
        >
          <FlaskConical size={17} />
          {!collapsed && (
            <>
              <span>Test Lab</span>
              <span className="nav-badge-pill">TEST</span>
            </>
          )}
        </button>

        <button
          type="button"
          className={"nav-item " + (currentTab === "runs" || currentTab === "compare" || currentTab === "fixproof" || currentTab === "analysis" ? "active" : "")}
          onClick={() => onSelectTab("runs")}
          title="Test Runs, Telemetry Comparison & FixProof"
        >
          <Activity size={17} />
          {!collapsed && (
            <>
              <span>Test Runs</span>
              <span className="nav-count">{previewMode ? "DEMO" : runsCount}</span>
            </>
          )}
        </button>

        <button
          type="button"
          className={"nav-item " + (currentTab === "settings" || currentTab === "connect" ? "active" : "")}
          onClick={() => onSelectTab("settings")}
          title="Lab Workers & Settings"
        >
          <Settings size={17} />
          {!collapsed && <span>Lab & Workers</span>}
        </button>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-bottom">
        {/* Worker Heartbeat Card */}
        {!collapsed && (
          <div className="worker-card">
            <span
              className={"pulse-dot " + (isOnline ? "worker-online" : "")}
              style={{ color: isOnline ? "#36C995" : "#4A5570" }}
            />
            <div>
              <b>Android Worker</b>
              <small>
                {previewMode
                  ? "Operational"
                  : !session
                  ? "Sign in to see status"
                  : isOnline
                  ? `${onlineWorkers.length} heartbeat(s)`
                  : "No recent heartbeat"}
              </small>
            </div>
            <span
              className="status-pill"
              style={
                isOnline
                  ? { background: "rgba(54,201,149,0.1)", color: "#36C995", border: "1px solid rgba(54,201,149,0.3)" }
                  : { background: "rgba(74,85,112,0.15)", color: "#727F98", border: "1px solid rgba(74,85,112,0.3)" }
              }
            >
              {isOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        )}

        {/* Theme and Account Action Buttons */}
        <div className="sidebar-actions-row">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
          </button>

          {!previewMode && !collapsed && (
            <button
              type="button"
              className="signout-btn"
              onClick={() => void signOut().then(() => window.location.reload())}
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
