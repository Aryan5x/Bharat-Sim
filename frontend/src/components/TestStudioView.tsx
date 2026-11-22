import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Mic, SlidersHorizontal } from "lucide-react";
import { type Persona, type Run } from "../api";
import { type CustomPersona } from "./CustomPersonaBuilder";
import SpeakToTestView, { type SubmitRunOptions } from "./SpeakToTestView";
import NewTestWizard from "./NewTestWizard";

interface TestStudioViewProps {
  personas: Persona[];
  selectedPersona: string;
  onSelectPersona: (id: string) => void;
  previewMode: boolean;
  busy: boolean;
  uploadAvailable: boolean;
  maxUploadMb?: number;
  lockedReason?: string;
  onSubmitRun: (apkFile: File, options?: SubmitRunOptions) => Promise<void>;
  runs: Run[];
  customPersona: CustomPersona;
  onCustomPersonaChange: (p: CustomPersona) => void;
}

export default function TestStudioView({
  personas,
  selectedPersona,
  onSelectPersona,
  previewMode,
  busy,
  uploadAvailable,
  maxUploadMb = 500,
  lockedReason,
  onSubmitRun,
  runs,
  customPersona,
  onCustomPersonaChange
}: TestStudioViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "manual" ? "manual" : "speak";
  const [mode, setMode] = useState<"speak" | "manual">(initialMode);

  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "manual" || urlMode === "speak") {
      setMode(urlMode);
    }
  }, [searchParams]);

  const handleModeChange = (newMode: "speak" | "manual") => {
    setMode(newMode);
    setSearchParams({ mode: newMode }, { replace: true });
  };

  return (
    <div className="test-studio-hub page-enter">
      {/* Studio Segmented Switcher */}
      <div className="hub-header">
        <div>
          <div className="section-kicker">BUDGET-PHONE TESTING STUDIO</div>
          <h2>Test Lab</h2>
          <p>Test any Android app under real Indian network personas and budget device constraints.</p>
        </div>

        <div className="segmented-nav" role="tablist" aria-label="Testing method selection">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "speak"}
            className={"segmented-tab " + (mode === "speak" ? "active" : "")}
            onClick={() => handleModeChange("speak")}
          >
            <Mic size={15} />
            <span>Speak or Describe Problem</span>
            <span className="tab-badge">Sarvam AI</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "manual"}
            className={"segmented-tab " + (mode === "manual" ? "active" : "")}
            onClick={() => handleModeChange("manual")}
          >
            <SlidersHorizontal size={15} />
            <span>Configure Persona & APK</span>
          </button>
        </div>
      </div>

      {mode === "speak" ? (
        <SpeakToTestView
          personas={personas}
          previewMode={previewMode}
          busy={busy}
          onSubmitRun={onSubmitRun}
          runs={runs}
        />
      ) : (
        <NewTestWizard
          personas={personas}
          selectedPersona={selectedPersona}
          onSelectPersona={onSelectPersona}
          busy={busy}
          uploadAvailable={uploadAvailable}
          maxUploadMb={maxUploadMb}
          lockedReason={lockedReason}
          onSubmit={(file) => onSubmitRun(file)}
          onCancel={() => handleModeChange("speak")}
          customPersona={customPersona}
          onCustomPersonaChange={onCustomPersonaChange}
        />
      )}
    </div>
  );
}
