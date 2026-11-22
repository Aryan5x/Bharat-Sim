import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Laptop, SlidersHorizontal } from "lucide-react";
import { type Capabilities, type Worker } from "../api";
import ConnectLaptopView from "./ConnectLaptopView";
import SettingsView from "./SettingsView";

interface LabSettingsViewProps {
  capabilities: Capabilities | null;
  apiStatus: string;
  previewMode: boolean;
  workers: Worker[];
}

type SettingsTab = "workers" | "preferences";

export default function LabSettingsView({
  capabilities,
  apiStatus,
  previewMode,
  workers
}: LabSettingsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "preferences" ? "preferences" : "workers";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "preferences" || tab === "workers") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (tab === "workers") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  const onlineWorkersCount = workers.filter((w) => w.online).length;

  return (
    <div className="lab-settings-hub page-enter">
      {/* Hub Header with Segmented Navigation */}
      <div className="hub-header">
        <div>
          <div className="section-kicker">INFRASTRUCTURE & PREFERENCES</div>
          <h2>Lab & Workers</h2>
          <p>Connect your laptop as an emulator worker node, manage worker keys, and configure workspace settings.</p>
        </div>

        <div className="segmented-nav" role="tablist" aria-label="Settings navigation">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "workers"}
            className={"segmented-tab " + (activeTab === "workers" ? "active" : "")}
            onClick={() => handleTabChange("workers")}
          >
            <Laptop size={15} />
            <span>Workers & Connect Laptop</span>
            <span className={"tab-badge " + (onlineWorkersCount > 0 ? "online" : "")}>
              {onlineWorkersCount} online
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "preferences"}
            className={"segmented-tab " + (activeTab === "preferences" ? "active" : "")}
            onClick={() => handleTabChange("preferences")}
          >
            <SlidersHorizontal size={15} />
            <span>Workspace & Preferences</span>
          </button>
        </div>
      </div>

      {activeTab === "workers" ? (
        <ConnectLaptopView previewMode={previewMode} />
      ) : (
        <SettingsView capabilities={capabilities} apiStatus={apiStatus} />
      )}
    </div>
  );
}
