import { useState, useEffect } from "react";
import { Zap, Play, X, ChevronRight } from "lucide-react";
import { fetchEvaluatorScenarios, type EvaluatorScenario } from "../api";
import SarvamAudioPlayer from "./SarvamAudioPlayer";

interface EvaluatorTourBannerProps {
  onLoadScenario: (scenario: EvaluatorScenario) => void;
}

export default function EvaluatorTourBanner({ onLoadScenario }: EvaluatorTourBannerProps) {
  const [scenarios, setScenarios] = useState<EvaluatorScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<EvaluatorScenario | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const items = await fetchEvaluatorScenarios();
        setScenarios(items);
      } catch (err) {
        console.error("Could not load evaluator scenarios", err);
      }
    }
    void load();
  }, []);

  const handleOpenScenario = (sc: EvaluatorScenario) => {
    setSelectedScenario(sc);
    setShowModal(true);
  };

  const handleRunInAnalyzer = (sc: EvaluatorScenario) => {
    setShowModal(false);
    onLoadScenario(sc);
  };

  return (
    <>
      <section className="evaluator-tour-banner" aria-label="Evaluator Quick Tour">
        <div className="tour-badge">
          <Zap size={14} />
          <span>EVALUATOR QUICK TOUR</span>
        </div>
        <div className="tour-content">
          <h3>Test with Real Indian Network & Device Constraints</h3>
          <p>
            Load curated fixture scenarios to inspect failure classification, telemetry comparisons and optional Indic explanations. These are illustrative inputs, not executed APK runs.
          </p>
          <div className="tour-scenario-buttons">
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className="tour-scenario-btn"
                onClick={() => handleOpenScenario(sc)}
              >
                <div className="scenario-btn-text">
                  <strong>{sc.name}</strong>
                  <small>{sc.persona_name} · {sc.expected_failure}</small>
                </div>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {showModal && selectedScenario && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-dialog scenario-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="section-kicker">CURATED DEMONSTRATION FIXTURE</span>
                <h2>{selectedScenario.name}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="scenario-meta-grid">
                <div className="meta-card">
                  <small>Target Persona</small>
                  <b>{selectedScenario.persona_name}</b>
                </div>
                <div className="meta-card">
                  <small>Target Application</small>
                  <b>{selectedScenario.app_name}</b>
                </div>
                <div className="meta-card">
                  <small>Expected Failure</small>
                  <b className="fail-tag">{selectedScenario.expected_failure}</b>
                </div>
                <div className="meta-card">
                  <small>ML Category</small>
                  <b className="ml-tag">{(selectedScenario.expected_ml_category || "other").toUpperCase()}</b>
                </div>
              </div>

              <p className="scenario-desc">{selectedScenario.description}</p>

              <div className="scenario-metrics-label">Illustrative scenario inputs · not measured run telemetry</div>
              <div className="scenario-metrics-bar">
                <div className="metric-box">
                  <small>Cold Start</small>
                  <b>{selectedScenario.metrics?.cold_start_ms ?? "—"} ms</b>
                </div>
                <div className="metric-box">
                  <small>Jank Frames</small>
                  <b>{selectedScenario.metrics?.jank_frame_pct ?? "—"}%</b>
                </div>
                <div className="metric-box">
                  <small>Peak Memory</small>
                  <b>{selectedScenario.metrics?.memory_peak_mb ?? "—"} MB</b>
                </div>
                <div className="metric-box">
                  <small>Network Latency</small>
                  <b>{selectedScenario.metrics?.network_latency_ms ?? "—"} ms</b>
                </div>
              </div>

              <div className="sarvam-insight-box">
                <div className="insight-header">
                  <Zap size={14} />
                  <span>SARVAM AI INDIC DIAGNOSTIC BRIEFING</span>
                </div>
                <p className="insight-hi" lang="hi">{selectedScenario.sarvam_insight?.hi}</p>
                <small className="insight-en">{selectedScenario.sarvam_insight?.en}</small>

                <SarvamAudioPlayer
                  text={selectedScenario.sarvam_insight?.hi || selectedScenario.description}
                  defaultLang="hi-IN"
                  label="Listen in Hindi, Tamil or Marathi (Bulbul TTS)"
                />
              </div>

              <div className="scenario-log-preview">
                <small>Scenario fixture logcat (illustrative, not live device evidence):</small>
                <pre>{selectedScenario.logcat.slice(0, 400)}...</pre>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => handleRunInAnalyzer(selectedScenario)}
              >
                <Play size={15} /> Load into Live Logcat Analyzer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
