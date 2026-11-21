import { useState } from "react";
import {
  Smartphone, Wifi, Activity, Layers, ArrowRight,
  ChevronRight, Brain, Sparkles, Terminal, CheckCircle2
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
      a: "Every app is run twice on a real Android emulator: once on a normal connection, once on the persona's network. The persona run goes through a shaping proxy that adds latency, caps bandwidth, drops packets and can cut the connection, and the report says whether the app's traffic actually passed through it. CPU throttling is not applied."
    },
    {
      q: "What is the Bharat Readiness Score?",
      a: "The Bharat Readiness Score is a transparent heuristic based only on signals actually present in submitted logcat or worker evidence. Missing telemetry is not imputed; it is not a certification or a prediction of real-world user impact."
    },
    {
      q: "How does the Machine Learning failure classifier work?",
      a: "BharatSim uses a portable TF-IDF class-centroid classifier trained on a small curated set of Android logcat examples. The reported 100% figure is training-set resubstitution, not independent holdout accuracy. Treat the category as a triage hint and verify the linked source evidence."
    },
    {
      q: "How is Sarvam AI integrated into the testing workflow?",
      a: "Sarvam translation and Bulbul TTS are provider-backed features that require a server-side SARVAM_API_KEY. Remediation text currently comes from deterministic rule-based templates; BharatSim does not claim a generative Sarvam root-cause diagnosis."
    }
  ];

  const capabilities = [
    {
      icon: <Smartphone size={22} />,
      title: "Realistic Device Personas",
      desc: "Test on emulated budget Android profiles — 2GB RAM, low-end CPUs, constrained storage — matching devices real Indian users own."
    },
    {
      icon: <Wifi size={22} />,
      title: "Network Condition Simulation",
      desc: "Inject real-world network impairments: 2G edge latency, rural packet loss, crowded transit 3G. See how your app behaves."
    },
    {
      icon: <Brain size={22} />,
      title: "ML Failure Classification",
      desc: "Zero-dependency TF-IDF classifier categorizes logcat failures — crash, ANR, OOM, network — in under 1ms with evidence links."
    },
    {
      icon: <Activity size={22} />,
      title: "Bharat Readiness Score",
      desc: "A transparent, evidence-based score computed from actual telemetry. No synthetic metrics. No imputed data. Know exactly what it means."
    },
    {
      icon: <Terminal size={22} />,
      title: "Logcat Intelligence",
      desc: "Submit any Android logcat and receive structured failure analysis, severity classification, and actionable recommendations."
    },
    {
      icon: <Sparkles size={22} />,
      title: "Sarvam AI Integration",
      desc: "Speak your test scenario in natural language. Get findings explained in Indian languages with Bulbul TTS audio narration."
    }
  ];

  const workflowSteps = [
    { num: "1", title: "Upload APK or Submit Logcat", desc: "Upload your Android APK for emulator testing, or paste logcat output directly for instant ML analysis." },
    { num: "2", title: "Select Device Persona", desc: "Choose from Budget Android, Mid-Range, Rural 2G, Transit 3G or build a custom persona." },
    { num: "3", title: "Configure Network Environment", desc: "Set bandwidth limits, latency, jitter, and packet loss to replicate real Indian connectivity." },
    { num: "4", title: "Execute & Collect Telemetry", desc: "BharatSim runs your app on a real emulator, collects network traces, logcat and performance signals." },
    { num: "5", title: "Review Failure Analysis", desc: "ML classifier categorizes failures. Each finding links to source evidence in the actual logcat." },
    { num: "6", title: "Get Bharat Readiness Score", desc: "Transparent score computed from real measurements. Actionable recommendations with multilingual audio support." }
  ];

  const stats = [
    { number: "5+", label: "Device Personas" },
    { number: "4", label: "Network Profiles" },
    { number: "<1ms", label: "ML Inference" },
    { number: "100%", label: "Evidence-Backed" }
  ];

  return (
    <div className="landing-container page-enter">
      {/* ── HERO ─────────────────────────────────────── */}
      <section className="landing-hero" style={{ position: "relative", overflow: "hidden" }}>
        <Spotlight fill="#7667F8" />

        {/* Badge */}
        <div className="landing-hero-badge">
          <span className="badge-pulse" />
          <span>BHARATSIM 2.0 · THE CHEAP PHONE TEST</span>
          <span className="badge-flag">🇮🇳</span>
        </div>

        <h1 className="landing-hero-title">
          Test Android Apps Under<br />
          <span className="text-gradient">Real-World Indian Conditions.</span>
        </h1>

        <p className="landing-hero-subtitle">
          Discover crashes, performance bottlenecks and network failures before your users do.
          Test across realistic device personas and challenging Indian network environments.
        </p>

        <div className="landing-cta-group">
          <button type="button" className="primary-action-btn" onClick={onStartTesting}>
            <span>Start Testing Now</span>
            <ArrowRight size={16} />
          </button>
          <button type="button" className="secondary-action-btn" onClick={onExplorePlanner}>
            <Layers size={16} />
            <span>Explore Risk Planner</span>
          </button>
        </div>

        {/* Telemetry Marquee */}
        <div className="landing-marquee-wrapper" style={{ margin: "24px 0 28px" }}>
          <Marquee speed={32} pauseOnHover={true}>
            {[
              { tag: "Hardware", text: "Budget Android · 2GB RAM · 720p · Android 11" },
              { tag: "Rural 2G", text: "Edge Village · 450ms Latency · 8% Packet Loss" },
              { tag: "Transit", text: "Crowded Railway Station · 320ms Latency · 3G Cell" },
              { tag: "ML Engine", text: "Zero-DLL TF-IDF Failure Classifier · < 1ms Inference" },
              { tag: "Sarvam AI", text: "Bulbul TTS · Hindi · Tamil · Telugu · Kannada" },
              { tag: "Scoring", text: "Bharat Readiness Score · Evidence-Based · Transparent" },
              { tag: "Network", text: "tc-netem Shaping · Bandwidth Cap · Jitter · Packet Drop" },
            ].map((item) => (
              <span key={item.tag} className="marquee-pill">
                <span className="pill-tag">{item.tag}</span>
                <span>{item.text}</span>
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────── */}
      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="landing-stats-grid">
          {stats.map((s) => (
            <div key={s.label} className="landing-stat-item">
              <div className="landing-stat-number">{s.number}</div>
              <div className="landing-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── EVALUATOR TOUR ───────────────────────────── */}
      <section className="landing-section">
        <EvaluatorTourBanner onLoadScenario={onLoadScenario} />
      </section>

      {/* ── CAPABILITIES ─────────────────────────────── */}
      <section className="landing-section">
        <div className="landing-section-label">PLATFORM CAPABILITIES</div>
        <h2 className="landing-section-title">
          Everything you need to test for India
        </h2>
        <p className="landing-section-subtitle">
          BharatSim combines real emulator execution, network simulation, and ML-powered analysis
          into one developer workflow.
        </p>
        <div className="feature-grid stagger-child-container">
          {capabilities.map((cap, i) => (
            <div key={cap.title} className={`feature-card stagger-child`} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="feature-card-icon">{cap.icon}</div>
              <div className="feature-card-title">{cap.title}</div>
              <div className="feature-card-desc">{cap.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────── */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-label">WORKFLOW</div>
        <h2 className="landing-section-title">How BharatSim works</h2>
        <p className="landing-section-subtitle">
          From APK upload to actionable findings in minutes.
        </p>
        <div className="workflow-steps" style={{ maxWidth: 640, margin: "32px auto 0" }}>
          {workflowSteps.map((step) => (
            <div key={step.num} className="workflow-step">
              <div>
                <div className="workflow-step-num">{step.num}</div>
              </div>
              <div className="workflow-step-content">
                <h4>{step.title}</h4>
                <p>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PERSONA SHOWCASE ─────────────────────────── */}
      <section className="landing-section">
        <div className="landing-section-label">DEVICE PERSONAS</div>
        <h2 className="landing-section-title">Test on the right device profile</h2>
        <p className="landing-section-subtitle">
          Each persona emulates realistic hardware and connectivity constraints for Indian market segments.
        </p>
        <div className="persona-showcase-grid">
          {fallbackPersonas.slice(0, 4).map((p) => (
            <div
              key={p.id}
              className={`persona-showcase-card${selectedPersona.id === p.id ? " selected" : ""}`}
              onClick={() => setSelectedPersona(p)}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedPersona(p); }}
            >
              <div className="persona-showcase-name">{p.name}</div>
              <div className="persona-showcase-spec" style={{ marginTop: 8 }}>
                {p.network && <div>Network: {p.network}</div>}
                {p.ram_mb && <div>RAM: {p.ram_mb}MB</div>}
                {p.device && <div>Device: {p.device}</div>}
              </div>
              {selectedPersona.id === p.id && (
                <div style={{
                  marginTop: 12,
                  fontSize: "0.72rem",
                  color: "#7667F8",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  <CheckCircle2 size={12} />
                  <span>Selected</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────── */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-label">FREQUENTLY ASKED</div>
        <h2 className="landing-section-title">Honest answers about what BharatSim does</h2>
        <div className="landing-faq" style={{ maxWidth: 720, margin: "32px auto 0" }}>
          {faqs.map((faq, i) => (
            <div key={i} className="faq-item" style={{
              borderBottom: "1px solid #1A2540",
              paddingBottom: 16,
              marginBottom: 16
            }}>
              <button
                type="button"
                className="faq-question"
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "#F5F6FC",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  padding: "8px 0",
                  gap: 12
                }}
                aria-expanded={activeFaq === i}
              >
                <span>{faq.q}</span>
                <ChevronRight
                  size={16}
                  style={{
                    color: "#727F98",
                    minWidth: 16,
                    transform: activeFaq === i ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 200ms ease"
                  }}
                />
              </button>
              {activeFaq === i && (
                <p style={{
                  margin: "8px 0 0",
                  color: "#A1AAC0",
                  fontSize: "0.85rem",
                  lineHeight: 1.65
                }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="landing-section">
        <div className="landing-cta-section">
          <div className="landing-cta-title">Ready to test for real India?</div>
          <div className="landing-cta-subtitle">
            Start with a logcat analysis — no APK required. Upload logs, get ML-classified findings
            and a Bharat Readiness Score in seconds.
          </div>
          <div className="landing-cta-buttons">
            <button type="button" className="primary-action-btn" onClick={onStartTesting}>
              <span>Start Testing Now</span>
              <ArrowRight size={16} />
            </button>
            <button type="button" className="secondary-action-btn" onClick={onExplorePlanner}>
              <Brain size={16} />
              <span>Try Risk Planner</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────── */}
      <footer className="landing-footer-new">
        <div className="landing-footer-brand">
          <b>BharatSim</b>
          <p>The professional Android testing platform for real-world Indian conditions. Evidence-first diagnostics.</p>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.06em" }}>© 2024 BharatSim · THE CHEAP PHONE TEST</span>
        </div>
        <div className="landing-footer-col">
          <h5>Platform</h5>
          <a href="#" onClick={(e) => { e.preventDefault(); onStartTesting(); }}>Dashboard</a>
          <a href="#" onClick={(e) => { e.preventDefault(); onExplorePlanner(); }}>Risk Planner</a>
          <a href="https://github.com/kaustubhdua/Bharat-Sim" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="landing-footer-col">
          <h5>Resources</h5>
          <a href="https://github.com/kaustubhdua/Bharat-Sim#readme" target="_blank" rel="noreferrer">Documentation</a>
          <a href="https://github.com/kaustubhdua/Bharat-Sim/issues" target="_blank" rel="noreferrer">Issue Tracker</a>
        </div>
      </footer>
    </div>
  );
}
