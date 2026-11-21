import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Copy, Laptop, LoaderCircle, Smartphone, Trash2 } from "lucide-react";
import { api, date } from "../api";

type MyWorker = { id: string; label: string; created_at: string; last_seen: string; online: boolean; busy: boolean };
type NewWorker = { worker_id: string; worker_key: string; label: string; api_url: string; note: string };

const OS_TABS = ["Windows", "macOS / Linux"] as const;

function commandFor(os: (typeof OS_TABS)[number], key: string, origin: string) {
  if (os === "Windows") {
    return `$env:BHARATSIM_WORKER_KEY="${key}"; irm ${origin}/install/windows.ps1 | iex`;
  }
  return `curl -fsSL ${origin}/install/unix.sh -o bharatsim-install.sh && BHARATSIM_WORKER_KEY="${key}" bash bharatsim-install.sh`;
}

export default function ConnectLaptopView({ previewMode }: { previewMode: boolean }) {
  const [workers, setWorkers] = useState<MyWorker[]>([]);
  const [max, setMax] = useState(3);
  const [label, setLabel] = useState("My laptop");
  const [created, setCreated] = useState<NewWorker | null>(null);
  const [os, setOs] = useState<(typeof OS_TABS)[number]>(
    typeof navigator !== "undefined" && /Mac|Linux/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent) ? "macOS / Linux" : "Windows"
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://bharatsim.onrender.com";

  async function load() {
    try {
      const res = await api<{ items: MyWorker[]; max: number }>("/api/v1/my-workers");
      setWorkers(res.items);
      setMax(res.max);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your laptops.");
    }
  }

  useEffect(() => {
    if (previewMode) return;
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [previewMode]);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await api<NewWorker>("/api/v1/my-workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || "My laptop" })
      });
      setCreated(res);
      setCopied(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a worker key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Remove this laptop? Its key stops working immediately.")) return;
    try {
      await api("/api/v1/my-workers/" + encodeURIComponent(id), { method: "DELETE" });
      if (created?.worker_id === id) setCreated(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the laptop.");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (previewMode) {
    return (
      <section className="panel full-panel">
        <div className="empty-state"><Laptop size={28} /><b>Sign in to connect your laptop</b><p>Each account gets its own worker key that runs only that account's tests.</p></div>
      </section>
    );
  }

  const command = created ? commandFor(os, created.worker_key, origin) : "";

  return (
    <div className="speak-view">
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">YOUR OWN TEST LAB</div>
            <h2>Run BharatSim tests on your laptop</h2>
            <p>
              Connect any Windows, macOS or Linux laptop. The installer asks before downloading anything, sets up the Android emulator
              (about 3 GB) and starts a worker that runs <b>only your own tests</b>, using a personal key.
            </p>
          </div>
          <div className="panel-icon"><Laptop size={19} /></div>
        </div>

        <div className="spec-grid">
          <div className="spec-block">
            <b>1. Create a key</b>
            <label className="field-label" htmlFor="laptop-label">Name this laptop</label>
            <input id="laptop-label" className="connect-input" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
            <button type="button" className="primary-button connect-create" onClick={() => void create()} disabled={busy || workers.length >= max}>
              {busy ? <LoaderCircle size={14} className="spin" /> : <Laptop size={14} />} Create worker key
            </button>
            {workers.length >= max && <small>You have {max} laptops connected. Remove one to add another.</small>}
          </div>
          <div className="spec-block">
            <b>What you need</b>
            <ul>
              <li>8 GB RAM (16 GB recommended) and about 6 GB free disk</li>
              <li>Hardware virtualization on (Intel VT-x / AMD-V; Windows Hypervisor Platform on Windows)</li>
              <li>Internet for the first setup; the installer brings its own Python, so your installed Python does not matter</li>
            </ul>
          </div>
        </div>

        {error && <div className="alert error-alert" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}

        {created && (
          <div className="spec-run connect-key">
            <div>
              <div className="section-kicker">2. INSTALL ON "{created.label.toUpperCase()}"</div>
              <p><b>Copy this now.</b> {created.note}</p>
              <div className="audience-toggle" role="tablist" aria-label="Operating system">
                {OS_TABS.map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={os === t} className={"chip-button " + (os === t ? "active" : "")} onClick={() => setOs(t)}>{t}</button>
                ))}
              </div>
              <p>{os === "Windows" ? "Open PowerShell (not as administrator) and paste:" : "Open Terminal and paste:"}</p>
              <pre className="spec-json connect-command">{command}</pre>
              <button type="button" className="secondary-button" onClick={() => void copy(command)}>
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy command"}
              </button>
              <small>The installer shows what it will download and waits for you to type YES. You can review it first: <a href={os === "Windows" ? "/install/windows.ps1" : "/install/unix.sh"} target="_blank" rel="noreferrer">view the script</a>.</small>
            </div>
          </div>
        )}
      </section>

      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">3. CONNECTED LAPTOPS</div>
            <h2>Your workers</h2>
            <p>A laptop shows online once its emulator has booted and the worker checks in. Tests you start are picked up by your laptop or the team worker, whichever is free.</p>
          </div>
        </div>
        {workers.length === 0 ? (
          <p className="no-evidence">No laptops connected yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="mini-evidence-table">
              <thead><tr><th>NAME</th><th>WORKER ID</th><th>STATUS</th><th>LAST SEEN</th><th></th></tr></thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id}>
                    <td>{w.label}</td>
                    <td><code>{w.id}</code></td>
                    <td><span className={"risk-badge " + (w.online ? "low" : "medium")}>{w.online ? (w.busy ? "RUNNING A TEST" : "ONLINE") : "OFFLINE"}</span></td>
                    <td>{w.last_seen.startsWith("1970") ? "never" : date(w.last_seen)}</td>
                    <td><button type="button" className="row-delete" onClick={() => void revoke(w.id)} aria-label={`Remove ${w.label}`}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">ANDROID PHONES · NEXT</div>
            <h2>Testing on a real phone</h2>
            <p>
              A BharatSim Android app is planned. Android does not let one app silently install, drive or measure another, so the phone
              app will need a one-time Wireless debugging pairing to run the same tests as the emulator. Until then, phones can use this
              website to start tests and read results.
            </p>
          </div>
          <div className="panel-icon"><Smartphone size={19} /></div>
        </div>
      </section>
    </div>
  );
}
