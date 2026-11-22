import { it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { buildDeveloperReportPdf } from "../reportPdf";

const sample = {
  version: 1, generated_at: "2026-11-22T08:20:00Z", model: "gemini-3.5-flash-lite", has_baseline: true,
  metadata: { app_name: "Make My Cake", package: "com.appsomniacs.mmc", version: "2.4.1", run_id: "7d558356-6dfa-42ed-a05e",
    persona: "Budget Android", tested_at: "2026-11-22T00:48:10Z", engine: "bharatsim-engine-2.0" },
  readiness: { overall: 34, status: "fail", methodology: "Weighted category scores from measured telemetry.", categories: [
    { category: "stability", score: 0, weight: 30, why: "5 crash(es), 0 ANR(s), 0 OOM(s), 4 low-memory kill(s)" },
    { category: "startup", score: 0, weight: 20, why: "app did not launch" },
    { category: "network", score: 100, weight: 15, why: "0 network failure lines" },
    { category: "memory", score: 100, weight: 10, why: "34 MB PSS" }] },
  severity_counts: { critical: 1, high: 0, medium: 0, low: 0 },
  environment: { android: "11", ram_mb: 1981, cpu_cores: 2, screen: "720x1280", free_storage_mb: 500, battery_saver: "on", down_kbps: 1000,
    up_kbps: 300, delay_ms: [120, 240], packet_loss_pct: 2, outage_seconds: 0, cpu_throttling: "not applied (emulator limitation)",
    network_enforcement: "host shaping proxy" },
  comparison: [{ metric: "Median cold start", unit: "ms", baseline: 1170, constrained: 2650, percent: 126.5, regression: true },
    { metric: "Crashes", unit: "", baseline: 5, constrained: 5, percent: 0, regression: false },
    { metric: "Memory (PSS)", unit: "MB", baseline: 36.2, constrained: 34, percent: -6.1, regression: false }],
  anomalies: [{ metric: "cold_start_ms", method: "z-score + IQR", regression: true }],
  analysis: { verdict: "not_ready", executive_summary: "The app crashes on every launch with java.lang.UnsatisfiedLinkError: libcocos2dcpp.so cannot be found.",
    issues: [{ issue_id: "F-c1", title: "Crash on launch: native library not found", observed_behaviour: "FATAL EXCEPTION on the main thread, 5 crashes per run.",
      likely_root_cause: "libcocos2dcpp.so is likely missing for the x86_64 ABI.", user_impact: "Users cannot open the app.",
      remediation: ["Package libcocos2dcpp.so for every target ABI.", "Check abiFilters in build.gradle."], investigation_steps: ["Inspect the APK lib/ folder."],
      reproduction_steps: ["Select Budget Android", "Install the APK", "Cold start the app"], reproduction_is_recorded: true,
      code_snippet: "android { defaultConfig { ndk { abiFilters 'armeabi-v7a','arm64-v8a','x86_64' } } }", evidence_ids: ["F-c1", "L-c1-1"] }],
    network_resilience: "Not assessable: the app never reached a screen that makes requests.", release_conditions: ["App launches on all supported ABIs"],
    priority_fixes: ["Bundle the native library for x86_64"] },
  evidence: [{ id: "F-c1", fact: "constrained run finding (crash, critical): The app crashed 5 time(s)." },
    { id: "L-c1-1", fact: "log: E AndroidRuntime: java.lang.UnsatisfiedLinkError: couldn't find libcocos2dcpp.so" }]
};

it("builds a multi-section PDF report", () => {
  const doc = buildDeveloperReportPdf(sample);
  const bytes = doc.output("arraybuffer");
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  if (process.env.BHARATSIM_PDF_PREVIEW) writeFileSync(process.env.BHARATSIM_PDF_PREVIEW, Buffer.from(bytes));
});

it("still builds when the AI analysis is unavailable", () => {
  const doc = buildDeveloperReportPdf({ ...sample, analysis: null, status: "analysis unavailable" });
  expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
});
