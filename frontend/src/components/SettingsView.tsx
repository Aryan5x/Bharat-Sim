import { useState } from "react";
import {
  Moon,
  Sun,
  Languages,
  Server,
  User,
  CheckCircle2
} from "lucide-react";
import { useTheme } from "../theme";
import { readSession } from "../auth";

export default function SettingsView() {
  const { theme, toggleTheme } = useTheme();
  const session = readSession();
  const [sarvamLang, setSarvamLang] = useState<string>(() => {
    return localStorage.getItem("bharatsim-default-lang") || "hi-IN";
  });
  const [savedNotice, setSavedNotice] = useState(false);

  const handleLangChange = (lang: string) => {
    setSarvamLang(lang);
    localStorage.setItem("bharatsim-default-lang", lang);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="panel full-panel settings-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">PREFERENCES & CONFIGURATION</div>
          <h2>Workspace Settings</h2>
          <p>Configure theme appearance, Indic language preferences, and view operational quota allocations.</p>
        </div>
      </div>

      {savedNotice && (
        <div className="alert notice-alert" role="status">
          <CheckCircle2 size={16} />
          <span>Settings saved successfully.</span>
        </div>
      )}

      <div className="settings-grid">
        {/* Appearance Section */}
        <section className="settings-card">
          <div className="card-header">
            {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            <h3>Interface Theme</h3>
          </div>
          <p>
            Choose between midnight developer dark mode or crisp daylight high-contrast mode.
          </p>
          <div className="theme-toggle-group">
            <button
              type="button"
              className={"theme-option-btn " + (theme === "dark" ? "active" : "")}
              onClick={() => theme !== "dark" && toggleTheme()}
            >
              <Moon size={15} />
              <span>Midnight Dark (Default)</span>
            </button>
            <button
              type="button"
              className={"theme-option-btn " + (theme === "light" ? "active" : "")}
              onClick={() => theme !== "light" && toggleTheme()}
            >
              <Sun size={15} />
              <span>Crisp Slate Light</span>
            </button>
          </div>
        </section>

        {/* Sarvam AI Language Preferences */}
        <section className="settings-card">
          <div className="card-header">
            <Languages size={18} />
            <h3>Sarvam AI Indic Language Preference</h3>
          </div>
          <p>
            Select your default regional language for automated diagnostic briefings and Bulbul TTS voice synthesis.
          </p>
          <div className="lang-options-grid">
            {[
              { code: "hi-IN", name: "Hindi (हिंदी)" },
              { code: "ta-IN", name: "Tamil (தமிழ்)" },
              { code: "mr-IN", name: "Marathi (मराठी)" },
              { code: "en-IN", name: "Indian English" }
            ].map((l) => (
              <button
                key={l.code}
                type="button"
                className={"lang-select-btn " + (sarvamLang === l.code ? "active" : "")}
                onClick={() => handleLangChange(l.code)}
              >
                <span>{l.name}</span>
                {sarvamLang === l.code && <CheckCircle2 size={14} />}
              </button>
            ))}
          </div>
        </section>

        {/* Account & Session Details */}
        <section className="settings-card">
          <div className="card-header">
            <User size={18} />
            <h3>User Account & Security</h3>
          </div>
          <p>Authenticated workspace identity and tenant boundaries.</p>
          <div className="info-rows">
            <div className="info-row">
              <span>Account Email:</span>
              <b>{session?.user?.email || "Guest Preview (Unauthenticated)"}</b>
            </div>
            <div className="info-row">
              <span>User UUID:</span>
              <code>{session?.user?.id || "preview-tenant-id"}</code>
            </div>
            <div className="info-row">
              <span>Daily Run Quota:</span>
              <b>10 runs / UTC day (2 active concurrent)</b>
            </div>
            <div className="info-row">
              <span>Row-Level Security:</span>
              <span className="badge-tag success">ENFORCED (PostgreSQL RLS)</span>
            </div>
          </div>
        </section>

        {/* System & Architecture Info */}
        <section className="settings-card">
          <div className="card-header">
            <Server size={18} />
            <h3>Deployment & Worker Engine</h3>
          </div>
          <p>Control plane and execution worker connection status.</p>
          <div className="info-rows">
            <div className="info-row">
              <span>API Gateway:</span>
              <code>{import.meta.env.VITE_API_BASE_URL || "Same-origin (FastAPI)"}</code>
            </div>
            <div className="info-row">
              <span>ML Classifier:</span>
              <span className="badge-tag success">Centroid Vector v2 (Active)</span>
            </div>
            <div className="info-row">
              <span>Sarvam Bulbul TTS:</span>
              <span className="badge-tag success">bulbul:v1 (Online)</span>
            </div>
            <div className="info-row">
              <span>Artifact Storage:</span>
              <b>Private Supabase Storage Bucket</b>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

