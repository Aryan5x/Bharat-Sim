import { jsPDF } from "jspdf";
import * as autoTableModule from "jspdf-autotable";

/* eslint-disable @typescript-eslint/no-explicit-any */
// jspdf-autotable's default export resolves differently in Vite (browser) and Node (tests); pick the function.
const autoTableMod: any = autoTableModule;
const autoTable: (doc: jsPDF, options: any) => void =
  (typeof autoTableMod.default === "function" && autoTableMod.default) ||
  (typeof autoTableMod.default?.default === "function" && autoTableMod.default.default) ||
  (typeof autoTableMod.autoTable === "function" && autoTableMod.autoTable) ||
  ((doc: any, options: any) => {
    autoTableMod.applyPlugin?.(jsPDF);
    doc.autoTable(options);
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;

const INK: [number, number, number] = [23, 32, 46];
const MUTED: [number, number, number] = [96, 108, 128];
const ACCENT: [number, number, number] = [88, 76, 220];
const LINE: [number, number, number] = [222, 226, 234];
const GOOD: [number, number, number] = [22, 138, 92];
const WARN: [number, number, number] = [196, 130, 20];
const BAD: [number, number, number] = [200, 50, 50];

const VERDICT: Record<string, [string, [number, number, number]]> = {
  ready: ["READY TO RELEASE", GOOD],
  ready_with_fixes: ["RELEASE AFTER FIXES", WARN],
  not_ready: ["NOT READY TO RELEASE", BAD],
  insufficient_evidence: ["NOT ENOUGH EVIDENCE", WARN]
};

function ascii(v: unknown): string {
  return String(v ?? "")
    .replace(/[·•]/g, "-").replace(/[–—]/g, "-").replace(/→/g, "->")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .normalize("NFKD").replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "");
}

function fmt(v: unknown, unit = ""): string {
  if (typeof v !== "number") return "-";
  const n = Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : String(Math.round(v * 10) / 10);
  return unit ? `${n} ${unit}` : n;
}

function scoreColor(s: number): [number, number, number] {
  return s >= 80 ? GOOD : s >= 60 ? WARN : BAD;
}

/** Build the developer report as a real PDF (A4). */
export function buildDeveloperReportPdf(r: Obj): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 46;
  const a: Obj = r.analysis || {};
  const m: Obj = r.metadata || {};
  let y = M;

  const ensure = (need: number) => {
    if (y + need > H - 60) {
      doc.addPage();
      y = M + 10;
    }
  };
  const heading = (n: string, title: string) => {
    ensure(40);
    y += 8;
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...ACCENT).text(n, M, y);
    doc.setFontSize(13).setTextColor(...INK).text(ascii(title), M + 22, y);
    y += 7;
    doc.setDrawColor(...LINE).setLineWidth(0.8).line(M, y, W - M, y);
    y += 14;
  };
  const para = (text: string, size = 9.5, color = INK) => {
    if (!text) return;
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(...color);
    for (const line of doc.splitTextToSize(ascii(text), W - 2 * M)) {
      ensure(14);
      doc.text(line, M, y);
      y += size + 4;
    }
    y += 4;
  };
  const table = (head: string[], body: (string | number)[][], opts: Obj = {}) => {
    autoTable(doc, {
      startY: y, head: [head], body: body.map((row) => row.map((c) => ascii(c))), margin: { left: M, right: M },
      theme: "grid", styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
      headStyles: { fillColor: [244, 245, 250], textColor: MUTED, fontStyle: "bold", fontSize: 7.5 },
      ...opts
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  };

  // ---- cover block
  doc.setFillColor(...ACCENT).rect(0, 0, W, 6, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...ACCENT).text("BHARATSIM  |  DEVELOPER TEST REPORT", M, y + 6);
  y += 30;
  doc.setFontSize(20).setTextColor(...INK).text(ascii(m.app_name || "Android app"), M, y);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...MUTED)
    .text(ascii(`${m.package || ""}   version ${m.version || "-"}   |   persona: ${m.persona || "-"}`), M, y);
  y += 22;

  // score + verdict
  const score = Number(r.readiness?.overall ?? 0);
  doc.setDrawColor(...LINE).setFillColor(249, 250, 252).roundedRect(M, y, W - 2 * M, 74, 6, 6, "FD");
  doc.setFont("helvetica", "bold").setFontSize(30).setTextColor(...scoreColor(score)).text(String(score), M + 18, y + 44);
  const scoreWidth = doc.getTextWidth(String(score));
  doc.setFontSize(9).setTextColor(...MUTED).text("/ 100   Bharat Readiness Score", M + 18 + scoreWidth + 8, y + 44);
  const [vLabel, vColor] = VERDICT[a.verdict] || ["AI ANALYSIS UNAVAILABLE", MUTED];
  doc.setFillColor(...vColor).roundedRect(W - M - 170, y + 16, 152, 22, 4, 4, "F");
  doc.setFontSize(8.5).setTextColor(255, 255, 255).text(vLabel, W - M - 94, y + 31, { align: "center" });
  const sc = r.severity_counts || {};
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED)
    .text(`Critical ${sc.critical ?? 0}   High ${sc.high ?? 0}   Medium ${sc.medium ?? 0}   Low ${sc.low ?? 0}`, W - M - 170, y + 56);
  y += 92;
  table(["RUN ID", "TESTED", "ENGINE", "REPORT"], [[
    String(m.run_id || "").slice(0, 18), String(m.tested_at || "").replace("T", " ").slice(0, 19),
    m.engine || "-", `v${r.version} ${r.model ? "- " + r.model : ""}`
  ]]);

  // ---- 1 executive summary
  heading("01", "Executive summary");
  para(a.executive_summary || "The AI analysis was not available for this version; all measured sections below are still valid.");

  // ---- 2 environment
  heading("02", "Testing environment");
  const e: Obj = r.environment || {};
  table(["SETTING", "VALUE", "SETTING", "VALUE"], [
    ["Android", e.android || "-", "Network", e.down_kbps ? `${e.down_kbps}/${e.up_kbps} kbps` : "unshaped"],
    ["RAM", fmt(e.ram_mb, "MB"), "Latency", Array.isArray(e.delay_ms) ? `${e.delay_ms[0]}-${e.delay_ms[1]} ms` : "-"],
    ["CPU cores", e.cpu_cores ?? "-", "Packet loss", e.packet_loss_pct != null ? `${e.packet_loss_pct}%` : "-"],
    ["Screen", typeof e.screen === "string" ? e.screen : e.screen ? JSON.stringify(e.screen) : "-", "Outage test", e.outage_seconds ? `${e.outage_seconds} s` : "none"],
    ["Free storage", e.free_storage_mb != null ? `${e.free_storage_mb} MB` : "not limited", "Battery saver", e.battery_saver || "off"],
    ["CPU throttling", e.cpu_throttling || "-", "Shaping", e.network_enforcement || "-"]
  ], { columnStyles: { 0: { textColor: MUTED }, 2: { textColor: MUTED } } });

  // ---- 3 benchmarks: category scores with bars
  heading("03", "Readiness benchmarks");
  const cats: Obj[] = r.readiness?.categories || [];
  for (const c of cats) {
    ensure(30);
    const s = Number(c.score ?? 0);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK).text(ascii(c.category), M, y);
    doc.setFont("helvetica", "normal").setTextColor(...MUTED).text(`${s}/100  (weight ${c.weight ?? "-"}%)`, W - M, y, { align: "right" });
    y += 6;
    doc.setFillColor(236, 238, 243).rect(M, y, W - 2 * M, 6, "F");
    doc.setFillColor(...scoreColor(s)).rect(M, y, ((W - 2 * M) * Math.max(0, Math.min(100, s))) / 100, 6, "F");
    y += 15;
    para(c.why, 8, MUTED);
  }
  if (r.readiness?.methodology) para("Method: " + r.readiness.methodology, 8, MUTED);

  // ---- 4 baseline vs constrained
  heading("04", "Baseline vs constrained performance");
  if (!r.has_baseline) para("No baseline run was recorded, so no comparison is shown.", 9, MUTED);
  else
    table(["METRIC", "BASELINE", "CONSTRAINED", "CHANGE", "FLAG"],
      (r.comparison || []).map((c: Obj) => [c.metric, fmt(c.baseline, c.unit), fmt(c.constrained, c.unit),
        c.percent != null ? `${c.percent > 0 ? "+" : ""}${c.percent}%` : c.difference != null ? fmt(c.difference) : "-", c.regression ? "REGRESSION" : ""]),
      { didParseCell: (d: any) => { if (d.section === "body" && d.column.index === 4 && d.cell.raw) d.cell.styles.textColor = BAD; } });
  const anomalies: Obj[] = r.anomalies || [];
  if (anomalies.length)
    table(["ANOMALY CHECK", "METHOD", "RESULT"], anomalies.map((x) => [x.metric, x.method, x.regression ? "REGRESSION" : "no regression"]));

  // ---- 5 failure analysis
  heading("05", "Detailed failure analysis");
  const issues: Obj[] = a.issues || [];
  if (!issues.length) para("No failures were observed in the captured evidence.", 9, MUTED);
  for (const i of issues) {
    ensure(70);
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...INK).text(ascii(`[${i.issue_id}] ${i.title}`), M, y);
    y += 15;
    for (const [label, val] of [["Observed", i.observed_behaviour], ["Likely root cause", i.likely_root_cause], ["User impact", i.user_impact]] as const) {
      if (!val) continue;
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED).text(label.toUpperCase(), M, y);
      y += 11;
      para(val, 9);
    }
    const lists: [string, string[]][] = [["Recommended fixes", i.remediation || []], ["Investigation", i.investigation_steps || []],
      [`Reproduction (${i.reproduction_is_recorded ? "recorded" : "proposed"})`, i.reproduction_steps || []]];
    for (const [label, items] of lists) {
      if (!items.length) continue;
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED).text(label.toUpperCase(), M, y);
      y += 11;
      items.forEach((s, n) => para(`${n + 1}. ${s}`, 9));
    }
    if (i.code_snippet) {
      doc.setFont("courier", "normal").setFontSize(7.8).setTextColor(...INK);
      const lines = doc.splitTextToSize(ascii(i.code_snippet), W - 2 * M - 16);
      ensure(lines.length * 10 + 16);
      doc.setFillColor(245, 246, 249).rect(M, y - 8, W - 2 * M, lines.length * 10 + 10, "F");
      lines.forEach((l: string) => { doc.text(l, M + 8, y); y += 10; });
      y += 8;
    }
    para("Evidence: " + (i.evidence_ids || []).join(", "), 7.5, MUTED);
    y += 6;
  }

  // ---- 6 network + release
  heading("06", "Network resilience");
  para(a.network_resilience || "No network analysis available.");
  heading("07", "Release readiness");
  if ((a.priority_fixes || []).length) { para("Priority fixes:", 9, MUTED); (a.priority_fixes as string[]).forEach((s, n) => para(`${n + 1}. ${s}`)); }
  if ((a.release_conditions || []).length) { para("Conditions before release:", 9, MUTED); (a.release_conditions as string[]).forEach((s) => para(`- ${s}`)); }

  // ---- 8 evidence appendix
  heading("08", "Evidence appendix");
  table(["ID", "EVIDENCE (measured, secrets redacted)"], (r.evidence || []).map((x: Obj) => [x.id, x.fact]),
    { styles: { font: "helvetica", fontSize: 7.2, cellPadding: 3, textColor: INK, lineColor: LINE, lineWidth: 0.5 }, columnStyles: { 0: { cellWidth: 62, font: "courier" } } });

  // ---- header/footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE).line(M, H - 40, W - M, H - 40);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(ascii(`BharatSim  |  ${m.app_name || ""}  |  run ${String(m.run_id || "").slice(0, 8)}  |  report v${r.version}`), M, H - 26);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 26, { align: "right" });
  }
  return doc;
}

export function downloadDeveloperReportPdf(r: Obj): void {
  const m: Obj = r.metadata || {};
  buildDeveloperReportPdf(r).save(`bharatsim-report-${String(m.run_id || "run").slice(0, 8)}-v${r.version}.pdf`);
}
