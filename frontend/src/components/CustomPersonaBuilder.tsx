import { Cpu, HardDrive, MemoryStick, Monitor, Signal, Timer, WifiOff } from "lucide-react";

export type CustomPersona = {
  name: string;
  ram_mb: 1024 | 1536 | 2048 | 3072 | 4096;
  cpu_cores: number;
  screen_width: number;
  screen_height: number;
  density_dpi: number;
  free_storage_mb: number | null;
  battery_saver: boolean;
  down_kbps: number;
  up_kbps: number;
  latency_min_ms: number;
  latency_max_ms: number;
  packet_loss_pct: number;
  reset_pct: number;
  drop_seconds: number;
};

export const DEFAULT_CUSTOM_PERSONA: CustomPersona = {
  name: "My test phone",
  ram_mb: 2048,
  cpu_cores: 2,
  screen_width: 720,
  screen_height: 1280,
  density_dpi: 320,
  free_storage_mb: null,
  battery_saver: false,
  down_kbps: 1000,
  up_kbps: 300,
  latency_min_ms: 80,
  latency_max_ms: 200,
  packet_loss_pct: 0,
  reset_pct: 0,
  drop_seconds: 0,
};

const SCREENS = [
  { label: "480 × 854 (small, hdpi)", w: 480, h: 854, d: 240 },
  { label: "720 × 1280 (HD, xhdpi)", w: 720, h: 1280, d: 320 },
  { label: "720 × 1600 (HD+ tall)", w: 720, h: 1600, d: 320 },
  { label: "1080 × 2400 (FHD+)", w: 1080, h: 2400, d: 420 },
];

const NETWORK_PRESETS = [
  { label: "2G / EDGE", down: 240, up: 120, lo: 300, hi: 600, loss: 3 },
  { label: "3G", down: 750, up: 250, lo: 150, hi: 400, loss: 1 },
  { label: "Slow 4G", down: 2000, up: 600, lo: 80, hi: 250, loss: 0.5 },
  { label: "Good 4G", down: 8000, up: 2000, lo: 40, hi: 90, loss: 0 },
];

/** Validation mirrors the API's CustomPersona model so users see errors before upload. */
export function customPersonaErrors(p: CustomPersona): string[] {
  const errors: string[] = [];
  if (!p.name.trim() || p.name.length > 40 || !/^[\w .,()+-]+$/.test(p.name)) errors.push("Name: 1–40 letters, digits, spaces or . , ( ) + -");
  if (p.cpu_cores < 2 || p.cpu_cores > 4) errors.push("CPU cores must be 2–4");
  if (p.down_kbps < 16 || p.down_kbps > 100000) errors.push("Download must be 16–100,000 kbps");
  if (p.up_kbps < 8 || p.up_kbps > 50000) errors.push("Upload must be 8–50,000 kbps");
  if (p.latency_min_ms < 0 || p.latency_max_ms > 3000 || p.latency_max_ms < p.latency_min_ms) errors.push("Latency range must be 0–3000 ms with max ≥ min");
  if (p.packet_loss_pct < 0 || p.packet_loss_pct > 30) errors.push("Packet loss must be 0–30%");
  if (p.reset_pct < 0 || p.reset_pct > 20) errors.push("Connection resets must be 0–20%");
  if (p.drop_seconds < 0 || p.drop_seconds > 60) errors.push("Outage must be 0–60 s");
  if (p.free_storage_mb !== null && (p.free_storage_mb < 150 || p.free_storage_mb > 4000)) errors.push("Free storage must be 150–4000 MB");
  return errors;
}

function NumberField({ id, label, value, min, max, step = 1, unit, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <label className="cp-field" htmlFor={id}>
      <span>{label}</span>
      <span className="cp-input">
        <input id={id} type="number" inputMode="decimal" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
        <em>{unit}</em>
      </span>
    </label>
  );
}

export default function CustomPersonaBuilder({ value, onChange }: { value: CustomPersona; onChange: (p: CustomPersona) => void }) {
  const set = <K extends keyof CustomPersona>(key: K, v: CustomPersona[K]) => onChange({ ...value, [key]: v });
  const errors = customPersonaErrors(value);
  const screen = SCREENS.find((s) => s.w === value.screen_width && s.h === value.screen_height)?.label ?? "custom";

  return (
    <div className="custom-persona" aria-label="Custom persona builder">
      <label className="cp-field cp-wide" htmlFor="cp-name">
        <span>Persona name</span>
        <input id="cp-name" type="text" maxLength={40} value={value.name} onChange={(e) => set("name", e.target.value)} />
      </label>

      <div className="cp-group">
        <h4><MemoryStick size={14} /> Device</h4>
        <label className="cp-field" htmlFor="cp-ram">
          <span>RAM</span>
          <select id="cp-ram" value={value.ram_mb} onChange={(e) => set("ram_mb", Number(e.target.value) as CustomPersona["ram_mb"])}>
            <option value={1024}>1 GB (memory balloon)</option>
            <option value={1536}>1.5 GB (memory balloon)</option>
            <option value={2048}>2 GB</option>
            <option value={3072}>3 GB (emulator restart)</option>
            <option value={4096}>4 GB (emulator restart)</option>
          </select>
        </label>
        <label className="cp-field" htmlFor="cp-cores">
          <span><Cpu size={12} /> CPU cores</span>
          <select id="cp-cores" value={value.cpu_cores} onChange={(e) => set("cpu_cores", Number(e.target.value))}>
            <option value={2}>2 cores</option>
            <option value={3}>3 cores</option>
            <option value={4}>4 cores</option>
          </select>
        </label>
        <label className="cp-field" htmlFor="cp-screen">
          <span><Monitor size={12} /> Screen</span>
          <select id="cp-screen" value={screen} onChange={(e) => {
            const s = SCREENS.find((x) => x.label === e.target.value);
            if (s) onChange({ ...value, screen_width: s.w, screen_height: s.h, density_dpi: s.d });
          }}>
            {SCREENS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
          </select>
        </label>
        <label className="cp-field" htmlFor="cp-storage">
          <span><HardDrive size={12} /> Free storage</span>
          <select id="cp-storage" value={value.free_storage_mb ?? 0} onChange={(e) => set("free_storage_mb", Number(e.target.value) || null)}>
            <option value={0}>Leave as is</option>
            <option value={200}>200 MB left</option>
            <option value={500}>500 MB left</option>
            <option value={1000}>1 GB left</option>
          </select>
        </label>
        <label className="cp-check" htmlFor="cp-battery">
          <input id="cp-battery" type="checkbox" checked={value.battery_saver} onChange={(e) => set("battery_saver", e.target.checked)} />
          <span>Battery saver on</span>
        </label>
      </div>

      <div className="cp-group">
        <h4><Signal size={14} /> Network</h4>
        <div className="cp-presets" role="group" aria-label="Network presets">
          {NETWORK_PRESETS.map((n) => (
            <button type="button" key={n.label} className="cp-chip"
              onClick={() => onChange({ ...value, down_kbps: n.down, up_kbps: n.up, latency_min_ms: n.lo, latency_max_ms: n.hi, packet_loss_pct: n.loss })}>
              {n.label}
            </button>
          ))}
        </div>
        <NumberField id="cp-down" label="Download" unit="kbps" value={value.down_kbps} min={16} max={100000} onChange={(v) => set("down_kbps", v)} />
        <NumberField id="cp-up" label="Upload" unit="kbps" value={value.up_kbps} min={8} max={50000} onChange={(v) => set("up_kbps", v)} />
        <NumberField id="cp-lat-lo" label="Latency min" unit="ms" value={value.latency_min_ms} min={0} max={2000} onChange={(v) => set("latency_min_ms", v)} />
        <NumberField id="cp-lat-hi" label="Latency max" unit="ms" value={value.latency_max_ms} min={0} max={3000} onChange={(v) => set("latency_max_ms", v)} />
        <NumberField id="cp-loss" label="Packet loss" unit="%" step={0.5} value={value.packet_loss_pct} min={0} max={30} onChange={(v) => set("packet_loss_pct", v)} />
        <NumberField id="cp-reset" label="Connection resets" unit="%" step={0.5} value={value.reset_pct} min={0} max={20} onChange={(v) => set("reset_pct", v)} />
        <label className="cp-field" htmlFor="cp-drop">
          <span><WifiOff size={12} /> Network outage</span>
          <select id="cp-drop" value={value.drop_seconds} onChange={(e) => set("drop_seconds", Number(e.target.value))}>
            <option value={0}>None</option>
            <option value={5}>5 s</option>
            <option value={10}>10 s</option>
            <option value={20}>20 s</option>
            <option value={30}>30 s</option>
          </select>
        </label>
      </div>

      <p className="cp-note">
        <Timer size={12} /> Applied for real on the emulator: RAM below 2 GB via an in-guest memory balloon, 3–4 GB and CPU cores by restarting the emulator, screen with <code>wm size</code>, network through the worker's shaping proxy. Android 11 only.
      </p>
      {errors.length > 0 && (
        <ul className="cp-errors" role="alert">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </div>
  );
}
