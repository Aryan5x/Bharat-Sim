import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import EngineReportView, { engineScore, engineSummaryText, isEngineReport } from "../components/EngineReportView";
import { createEngineRunPdf } from "../pdfExport";

const leg = (label: string, extra: Record<string, unknown> = {}) => ({
  label,
  installed: true,
  launched: true,
  cold_start_ms_median: label === "Baseline" ? 1170 : 880,
  frames: { jank_percent: 97.23, frame_p90_ms: 48 },
  memory: { pss_mb: 95.2 },
  signals: { crashes: 0, anrs: 0, ooms: 0, lmk_kills: 15, network_errors: 0, storage_errors: 0 },
  exploration: { events_injected: 150, events_requested: 150 },
  findings: [],
  ...extra
});

const completed = {
  status: "completed",
  engine: "bharatsim-engine-2.0",
  apk: { label: "Rooftop", package: "app.rooftop", version_name: "1.0", target_sdk: 34 },
  apk_sha256: "01fd",
  persona: { id: "budget-android", name: "Budget Android", cpu_constraint: "not applied" },
  execution: { device: { android: "11", hardware: { cores: 2, ram_mb: 1981 } }, started_at: "2026-11-21T15:32:12Z", finished_at: "2026-11-21T15:34:25Z" },
  baseline: leg("Baseline"),
  constrained: leg("Budget Android", {
    conditions_applied: {
      device: { android: "11 (API 30)", cpu_cores: 2, ram_mb_reported: 1981 },
      network: { down_kbps: 1000, up_kbps: 300, delay_ms: [120, 240], packet_loss_pct: 2, enforced_by: "host shaping proxy" },
      battery_saver: "on",
      free_storage_mb: 500
    }
  }),
  anomalies: [
    { method: "z-score + IQR vs baseline launches", metric: "cold_start_ms", z_score: -0.71, regression: false, baseline_mean: 1042, persona_median: 880 },
    { method: "relative change vs baseline", metric: "memory_pss_mb", unit: "MB", baseline: 96.6, persona: 95.2, change_pct: -1.4, regression: false }
  ],
  readiness: {
    overall: 90,
    status: "pass",
    weights: { stability: 30, startup: 20 },
    categories: {
      stability: { score: 70, status: "warn", why: "0 crash(es), 15 low-memory kill(s)" },
      startup: { score: 100, status: "pass", why: "median cold start 880 ms vs baseline 1170 ms" }
    },
    methodology: "Weighted category scores"
  },
  ml: { model_version: "failure-classifier-1.0", holdout_accuracy: 0.7843, holdout_macro_f1: 0.7707, samples: 9140, evaluation: "GroupKFold", caveat: "not field accuracy" },
  result_interpretation: "Real emulator execution.",
  constraint_verification: "no app traffic passed the shaping proxy",
  network_constraints_applied: false
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ sarvam_translation: true }) }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("engine report", () => {
  it("detects engine reports and reads the score", () => {
    expect(isEngineReport(completed)).toBe(true);
    expect(isEngineReport({ steps: [] })).toBe(false);
    expect(engineScore(completed)).toBe(90);
    expect(engineScore({ steps: [] })).toBeNull();
  });

  it("renders score, categories, baseline comparison, anomalies and conditions", async () => {
    await act(async () => {
      root.render(<EngineReportView report={completed} runId="3b1ee9a4-3310" />);
    });
    const text = container.textContent || "";
    expect(text).toContain("90");
    expect(text).toContain("Stability");
    expect(text).toContain("0 crash(es), 15 low-memory kill(s)");
    expect(text).toContain("Median cold start");
    expect(text).toContain("1,170 ms");
    expect(text).toContain("880 ms");
    expect(text).toContain("OK");
    expect(text).toContain("2% loss");
    expect(text).toContain("no app traffic passed the shaping proxy");
    expect(text).toContain("No crash, ANR, out-of-memory");
    expect(text).toContain("Explain this result");
  });

  it("renders an outage result and findings with evidence and a fix", async () => {
    const report = {
      ...completed,
      constrained: leg("Edge Village", {
        drop: { seconds: 8, behaviour: "crashed or closed", recovery_seconds: null },
        findings: [
          {
            category: "network", severity: "high", confidence: 0.91, low_confidence: false,
            message: "3 network failure line(s): timeouts, DNS or connection errors.",
            fix: "Add retries with backoff.", evidence: ["E OkHttp: java.net.SocketTimeoutException"], lines_classified: 3
          }
        ]
      })
    };
    await act(async () => {
      root.render(<EngineReportView report={report} runId="abc" />);
    });
    const text = container.textContent || "";
    expect(text).toContain("airplane mode for 8 s");
    expect(text).toContain("did not return to the foreground");
    expect(text).toContain("SocketTimeoutException");
    expect(text).toContain("Add retries with backoff.");
    expect(engineSummaryText(report)).toContain("Fix: Add retries with backoff.");
  });

  it("survives an install-failed report without telemetry", async () => {
    const failed = {
      status: "failed",
      error: "INSTALL_FAILED_NO_MATCHING_ABIS",
      engine: "bharatsim-engine-2.0",
      apk: { package: "x.y" },
      baseline: { label: "Baseline", installed: false },
      constrained: { label: "Budget Android", installed: false },
      anomalies: [],
      readiness: { overall: 0, status: "fail", categories: {}, methodology: "install failed" }
    };
    await act(async () => {
      root.render(<EngineReportView report={failed} runId="dead" />);
    });
    const text = container.textContent || "";
    expect(text).toContain("FAIL");
    expect(text).toContain("install failed");
    expect(text).toContain("Not enough measurements to compare.");
    expect(createEngineRunPdf("dead", failed).size).toBeGreaterThan(500);
  });

  it("builds a valid PDF for a completed report", async () => {
    const blob = createEngineRunPdf("3b1ee9a4", completed);
    const head = await blob.slice(0, 8).text();
    expect(head).toBe("%PDF-1.4");
    expect(blob.type).toBe("application/pdf");
  });
});
