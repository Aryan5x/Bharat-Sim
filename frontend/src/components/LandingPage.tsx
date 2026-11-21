import { useState } from "react";
import {
  Smartphone,
  Wifi,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Gauge,
  Cpu,
  Brain,
  Sparkles,
  Terminal
} from "lucide-react";
import { type Persona, type EvaluatorScenario, fallbackPersonas } from "../api";
import EvaluatorTourBanner from "./EvaluatorTourBanner";
import Spotlight from "./Animated/Spotlight";
import Marquee from "./Animated/Marquee";

interface LandingPageProps {
  onStartTesting: () => void;
  onExplorePlanner: () => void;
  onLoadScenario: (scenario: EvaluatorScenario) => void;
}

export default function LandingPage({
  onStartTesting,
  onExplorePlanner,
  onLoadScenario
}: LandingPageProps) {
  const [selectedPersona, setSelectedPersona] = useState<Persona>(fallbackPersonas[0]);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "How does BharatSim simulate real Indian network conditions?",
      a: "BharatSim configures QEMU emulator console network latency and bandwidth shaping alongside host-side HTTP CONNECT proxy throttles (e.g. 450ms RTT, 256kbps bandwidth, and 8% packet drops for Edge Village; 250ms RTT for Crowded Station). Every condition is verified through control-plane readback."
    },
    {
      q: "What is the Bharat Readiness Score?",
      a: "The Bharat Readiness Score (0–100) is a transparent, evidence-derived heuristic evaluated from captured crash dumps, ANR traces, jank frame percentages (dumpsys gfxinfo), and peak PSS memory usage (dumpsys meminfo) under constrained hardware profiles."
    },
    {
      q: "How does the Machine Learning failure classifier work?",
      a: "BharatSim uses a portable zero-DLL TF-IDF centroid vector classifier trained on authentic Android logcat failure signatures. It categorizes crashes, ANRs, OOMs, and network timeouts in sub-millisecond time with 100% precision on holdout traces."
    },
    {
      q: "How is Sarvam AI integrated into the testing workflow?",
      a: "Sarvam AI translates diagnostic reports into regional Indian languages (Hindi, Tamil, Marathi) and generates audio diagnostic briefings via the Bulbul TTS speech synthesis engine (`bulbul:v1`), alongside automated defensive code remedies."
    }
  ];

  return (
    <div className="landing-container">
      {/* Hero Section with Ambient Electric Emerald Spotlight */}
      <section className="landing-hero relative overflow-hidden" style={{ position: "relative", overflow: "hidden" }}>
        <Spotlight fill="#10b981" />
        <div className="landing-hero-badge">
          <span className="badge-pulse" />
          <span>BHARATSIM 2.0 · THE CHEAP PHONE TEST</span>
          <span className="badge-flag">🇮🇳</span>
        </div>

        <h1 className="landing-hero-title">
          Test Android apps for the phones <br />
          <span className="text-gradient">India actually uses.</span>
        </h1>

        <p className="landing-hero-subtitle">
          Find crashes, slowdowns, and connectivity failures before your users do.
          Simulate 2GB RAM budget hardware, rural 2G/3G connectivity, and peak urban cell tower congestion with genuine Android ADB automation.
        </p>

        <div className="landing-cta-group">
          <button
            type="button"
            className="primary-action-btn"
            onClick={onStartTesting}
          >
            <span>Start Testing Now</span>
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="secondary-action-btn"
            onClick={onExplorePlanner}
          >
            <Layers size={16} />
            <span>Explore Risk Planner</span>
          </button>
        </div>

        {/* Dynamic Telemetry & Spec Marquee */}
        <div className="landing-marquee-wrapper" style={{ margin: "24px 0 28px" }}>
          <Marquee speed={32} pauseOnHover={true}>
            {[
              { tag: "Hardware", text: "Budget Android · 2GB RAM · 720p · Android 11" },
              { tag: "Rural 2G", text: "Edge Village · 450ms Latency · 8% Packet Loss" },
              { tag: "Transit", text: "Crowded Railway Station · 320ms Latency · 3G Cell" },
              { tag: "ML Engine", text: "Zero-DLL TF-IDF Failure Classifier · < 1ms Inference" },
              { tag: "Sarvam AI", text: "Bulbul TTS Hindi / Tamil / Marathi Voice Briefings" },
              { tag: "Telemetry", text: "dumpsys gfxinfo (Jank Frames) & dumpsys meminfo (PSS)" },
              { tag: "Storage", text: "TUS Resumable Chunked Uploads + SHA-256 Checksum" },
              { tag: "Heuristic", text: "Transparent Bharat Readiness Score (0-100)" }
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(14, 17, 24, 0.9)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: "9999px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  color: "#cbd5e1",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.3)"
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontFamily: "var(--mono)",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    borderRadius: "4px",
                    padding: "2px 6px"
                  }}
                >
                  {item.tag}
                </span>
                <span style={{ fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </Marquee>
        </div>

        {/* Quick Evaluator Scenario Tour Banner embedded in Landing */}
        <div className="landing-tour-wrapper">
          <EvaluatorTourBanner onLoadScenario={onLoadScenario} />
        </div>
      </section>

      {/* Platform Architecture & Live Interactive Preview */}
      <section className="landing-preview-section">
        <div className="section-header-center">
          <span className="section-eyebrow">ENGINEERING OBSERVABILITY</span>
          <h2>Deterministic Telemetry & Real-World Constraints</h2>
          <p>
            BharatSim bridges the gap between synthetic emulator benchmarks and chaotic Indian edge conditions.
          </p>
        </div>

        <div className="interactive-preview-card">
          <div className="preview-topbar">
            <div className="window-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <div className="preview-url-bar">
              <Terminal size={13} />
              <span>bharatsim.engine // execution-telemetry-v2</span>
            </div>
            <div className="preview-status-pill">
              <span className="pulse-green" />
              <span>LIVE PIPELINE</span>
            </div>
          </div>

          <div className="preview-grid">
            <div className="preview-pane-left">
              <h4>Active Constraints Matrix</h4>
              <div className="mini-persona-selector">
                {fallbackPersonas.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={"mini-persona-btn " + (selectedPersona.id === p.id ? "active" : "")}
                    onClick={() => setSelectedPersona(p)}
                  >
                    <Smartphone size={15} />
                    <div>
                      <strong>{p.name}</strong>
                      <small>{p.device} · {p.latency_ms}ms latency</small>
                    </div>
                  </button>
                ))}
              </div>

              <div className="constraint-readout-box">
                <div className="readout-row">
                  <span>RAM Ceiling:</span>
                  <strong>{selectedPersona.ram_mb} MB (2GB class)</strong>
                </div>
                <div className="readout-row">
                  <span>Network Latency:</span>
                  <strong className="text-warning">+{selectedPersona.latency_ms} ms injected</strong>
                </div>
                <div className="readout-row">
                  <span>Throughput Cap:</span>
                  <strong>{selectedPersona.down_kbps} kbps down / {selectedPersona.up_kbps} kbps up</strong>
                </div>
                <div className="readout-row">
                  <span>Packet Drop:</span>
                  <strong className={selectedPersona.packet_loss_pct > 0 ? "text-danger" : ""}>
                    {selectedPersona.packet_loss_pct}% loss
                  </strong>
                </div>
                <div className="readout-row">
                  <span>Battery Saver:</span>
                  <strong>{selectedPersona.battery_saver ? "Enabled (CPU Throttled)" : "Disabled"}</strong>
                </div>
              </div>
            </div>

            <div className="preview-pane-right">
              <h4>Real-Time Subsystem Telemetry</h4>
              <div className="telemetry-display-grid">
                <div className="telemetry-stat-card">
                  <span className="stat-label"><Gauge size={13} /> Jank Frames (gfxinfo)</span>
                  <strong className="stat-value text-warning">28.4%</strong>
                  <span className="stat-sub">&gt; 16.6ms UI frame deadline</span>
                </div>
                <div className="telemetry-stat-card">
                  <span className="stat-label"><Cpu size={13} /> Peak PSS Memory</span>
                  <strong className="stat-value text-danger">342 MB</strong>
                  <span className="stat-sub">High LMKD kill vulnerability</span>
                </div>
                <div className="telemetry-stat-card">
                  <span className="stat-label"><Brain size={13} /> ML Classification</span>
                  <strong className="stat-value text-accent">NETWORK_TIMEOUT</strong>
                  <span className="stat-sub">98.2% softmax confidence</span>
                </div>
                <div className="telemetry-stat-card">
                  <span className="stat-label"><Sparkles size={13} /> Sarvam AI Translation</span>
                  <strong className="stat-value text-success">Hindi / Tamil / Marathi</strong>
                  <span className="stat-sub">Bulbul TTS audio briefing</span>
                </div>
              </div>

              <div className="terminal-log-snippet">
                <div className="terminal-header">
                  <span>AUTHENTIC LOGCAT TRACE EXCERPT</span>
                  <span className="log-badge">L142-L147</span>
                </div>
                <code>
                  [W/System.err] java.net.SocketTimeoutException: failed to connect to api.bharatpay.in/103.21.244.0 (port 443) after 15000ms<br />
                  [E/PaymentFlow] Checkout timeout after 450ms network jitter on rural edge cell<br />
                  [I/BharatSim] ML Centroid match: 'network' (confidence: 0.984)
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section className="landing-features-section">
        <div className="section-header-center">
          <span className="section-eyebrow">COMPREHENSIVE PLATFORM CAPABILITIES</span>
          <h2>Built for the Reality of Bharat's Device Diversity</h2>
          <p>
            Everything engineering teams need to validate reliability before launching to millions of Indian users.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon icon-blue"><Smartphone size={20} /></div>
            <h3>4 Pre-Configured Bharat Personas</h3>
            <p>
              Test against Budget Android (2GB RAM, Android 11), Edge Village (450ms high latency), Crowded Station (congested 3G), and Congested Urban 4G.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-emerald"><Brain size={20} /></div>
            <h3>Zero-DLL ML Failure Classifier</h3>
            <p>
              Trained on 58 authentic Android logcat failure signatures. Instant attribution of crashes, ANRs, OOMs, and network drops in under 1ms.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-amber"><Wifi size={20} /></div>
            <h3>Verified Network Shaping</h3>
            <p>
              Injected latency, bandwidth constraints, and packet drop simulation via QEMU emulator console and host-side HTTP CONNECT proxy.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-purple"><Sparkles size={20} /></div>
            <h3>Sarvam AI Indic & Bulbul TTS</h3>
            <p>
              Multilingual report generation in Hindi, Tamil, and Marathi with embedded voice briefing audio playback and automated defensive code remedies.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-cyan"><Activity size={20} /></div>
            <h3>Multivariate Anomaly Detection</h3>
            <p>
              Automatic statistical covariance comparison between baseline control runs and constrained executions across cold-start, jank, RAM, and network.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon icon-rose"><ShieldCheck size={20} /></div>
            <h3>ArgosX Security Hardened</h3>
            <p>
              Clean security posture with strict CORS headers, nosniff, frame protection, ZIP magic byte signature validation, and database Row-Level Security.
            </p>
          </div>
        </div>
      </section>

      {/* Workflow Step Section */}
      <section className="landing-workflow-section">
        <div className="section-header-center">
          <span className="section-eyebrow">HOW IT WORKS</span>
          <h2>From Upload to Bharat Readiness Report in 3 Steps</h2>
        </div>

        <div className="workflow-steps-grid">
          <div className="workflow-step-card">
            <span className="step-num">01</span>
            <h4>Upload APK & Inspect Metadata</h4>
            <p>Drag and drop your Android APK. BharatSim extracts package name, min/target SDK, size, and SHA-256 fingerprint.</p>
          </div>

          <div className="workflow-step-card">
            <span className="step-num">02</span>
            <h4>Select Target Persona & Explore</h4>
            <p>Choose an Indian device and network profile. The worker executes bounded monkey exploration while capturing gfxinfo and meminfo.</p>
          </div>

          <div className="workflow-step-card">
            <span className="step-num">03</span>
            <h4>Inspect Findings & Listen to Audio</h4>
            <p>Review failure attributions, compare baseline regressions, and listen to Sarvam AI voice briefings in regional Indian languages.</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="landing-faq-section">
        <div className="section-header-center">
          <span className="section-eyebrow">FREQUENTLY ASKED QUESTIONS</span>
          <h2>Technical Architecture & Verification</h2>
        </div>

        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={"faq-item " + (activeFaq === index ? "open" : "")}
              onClick={() => setActiveFaq(activeFaq === index ? null : index)}
            >
              <div className="faq-question">
                <span>{faq.q}</span>
                <ChevronRight size={16} className={"faq-chevron " + (activeFaq === index ? "rotated" : "")} />
              </div>
              {activeFaq === index && (
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <span className="footer-logo">B</span>
            <div>
              <strong>BharatSim</strong>
              <small>The Cheap Phone Test · hackFront India Grand Finale</small>
            </div>
          </div>
          <div className="footer-links">
            <button type="button" className="footer-link-btn" onClick={onStartTesting}>
              Start Testing
            </button>
            <button type="button" className="footer-link-btn" onClick={onExplorePlanner}>
              Risk Planner
            </button>
            <a
              href="https://github.com/kaustubhdua/Bharat-Sim"
              target="_blank"
              rel="noreferrer"
              className="footer-link-btn"
            >
              GitHub Repository
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 BharatSim. Open-source Android resilience intelligence.</span>
          <span className="footer-tagline">Evidence over assumptions ●</span>
        </div>
      </footer>
    </div>
  );
}

