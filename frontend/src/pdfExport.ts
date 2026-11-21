import type { Analysis } from "./api";

type PdfLine = { text: string; bold?: boolean; size?: number };

function ascii(value: unknown): string {
  return String(value ?? "")
    .replace(/[·•]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdf(value: string): string {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: unknown, width = 88): string[] {
  const text = ascii(value);
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > width) {
      if (current) lines.push(current);
      for (let offset = 0; offset < word.length; offset += width) {
        const chunk = word.slice(offset, offset + width);
        if (chunk.length === width) lines.push(chunk);
        else current = chunk;
      }
      continue;
    }
    const next = current ? current + " " + word : word;
    if (next.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildLines(report: Analysis): PdfLine[] {
  const lines: PdfLine[] = [];
  const add = (value: unknown, options: Omit<PdfLine, "text"> = {}) => {
    for (const text of wrap(value)) lines.push({ text, ...options });
  };
  const blank = () => lines.push({ text: "" });

  add("BHARATSIM ANDROID EVIDENCE REPORT", { bold: true, size: 15 });
  add("Evidence-led log analysis. Findings are diagnostic signals, not confirmed root causes.", { size: 9 });
  blank();
  add("REPORT METADATA", { bold: true, size: 11 });
  add("Report ID: " + report.id);
  add("Source: " + report.source);
  add("Evidence lines analysed: " + report.evidence_lines);
  add("Generated (UTC): " + new Date().toISOString());
  blank();
  add("BHARAT READINESS SCORE", { bold: true, size: 11 });
  add("Score: " + report.bharat_score.value + " / 100 - " + report.bharat_score.label, { bold: true });
  add("Method: " + report.bharat_score.method);
  add("Caveat: " + report.bharat_score.warning);
  blank();
  add("SUMMARY", { bold: true, size: 11 });
  add("Findings: " + report.summary.finding_count + " | Critical: " + report.summary.critical +
    " | High: " + report.summary.high + " | Medium: " + report.summary.medium);
  add("Repeated occurrences: " + (report.summary.occurrence_count ?? "not reported"));
  add("Clean: " + (report.summary.clean ? "yes" : "no"));
  blank();

  report.findings.forEach((finding, index) => {
    add((index + 1) + ". " + finding.title, { bold: true, size: 11 });
    add("ID: " + finding.id + " | Type: " + finding.kind + " | Severity: " + finding.severity.toUpperCase());
    add("Explanation: " + finding.explanation);
    add("Recommendation: " + finding.recommendation);
    if (finding.occurrence_count !== undefined) add("Occurrences: " + finding.occurrence_count);
    if (finding.ml_classification && typeof finding.ml_classification === "object") {
      add("Classifier: " + finding.ml_classification.category + " (" +
        (finding.ml_classification.confidence * 100).toFixed(1) + "% confidence)");
    }
    if (finding.root_cause_hypothesis?.statement) {
      add("Root-cause hypothesis (unconfirmed): " + finding.root_cause_hypothesis.statement);
    }
    const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
    if (evidence.length) {
      add("Source evidence:", { bold: true });
      evidence.slice(0, 12).forEach(item => add("Line " + item.line + ": " + item.text));
    }
    const guidance = finding.sarvam_explanation?.developer_fix || finding.sarvam_explanation?.remediation;
    if (guidance) add("Developer guidance: " + guidance);
    blank();
  });

  add("INTERPRETATION LIMITS", { bold: true, size: 11 });
  add("This report is based only on the submitted log evidence and selected persona. It does not prove that an APK was installed, executed, or measured on a physical device or production emulator.");
  add("A detected marker is not a confirmed root cause. Validate each recommendation against the application's source code and reproducible device evidence.");
  return lines;
}

function buildPageContent(lines: PdfLine[], pageNumber: number, pageCount: number): string {
  const commands = [
    "BT",
    "/F2 15 Tf",
    "50 748 Td",
    "13 TL",
    "(BharatSim Evidence Report) Tj",
    "/F1 8 Tf",
    "T*",
    "(Evidence-led diagnostic summary - not a confirmed app-health certification) Tj",
    "/F1 9 Tf",
    "T*",
  ];
  for (const line of lines) {
    commands.push("/" + (line.bold ? "F2" : "F1") + " " + (line.size ?? 9) + " Tf");
    commands.push("(" + escapePdf(line.text) + ") Tj");
    commands.push("T*");
  }
  commands.push("ET");
  commands.push("BT /F1 8 Tf 50 28 Td (" + escapePdf("Page " + pageNumber + " of " + pageCount) + ") Tj ET");
  return commands.join("\n");
}

/** Create a dependency-free, valid PDF from the current analysis result. */
export function createAnalysisPdf(report: Analysis): Blob {
  return linesToPdf(buildLines(report));
}

function linesToPdf(allLines: PdfLine[]): Blob {
  const pageSize = 49;
  const pages: PdfLine[][] = [];
  for (let index = 0; index < allLines.length; index += pageSize) {
    pages.push(allLines.slice(index, index + pageSize));
  }
  if (!pages.length) pages.push([]);

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objects[2] = "<< /Type /Pages /Kids [" + pageIds.map(id => id + " 0 R").join(" ") + "] /Count " + pages.length + " >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const stream = buildPageContent(page, index + 1, pages.length);
    objects[pageId] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentId + " 0 R >>";
    objects[contentId] = "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream";
  });

  let output = "%PDF-1.4\n%BharatSim\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = output.length;
    output += id + " 0 obj\n" + objects[id] + "\nendobj\n";
  }
  const xrefOffset = output.length;
  output += "xref\n0 " + objects.length + "\n";
  output += "0000000000 65535 f \n";
  for (let id = 1; id < objects.length; id++) {
    output += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
  }
  output += "trailer\n<< /Size " + objects.length + " /Root 1 0 R >>\n";
  output += "startxref\n" + xrefOffset + "\n%%EOF";
  return new Blob([output], { type: "application/pdf" });
}

export function downloadAnalysisPdf(report: Analysis): void {
  const blob = createAnalysisPdf(report);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "bharatsim-analysis-" + report.id.slice(0, 8) + ".pdf";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildEngineLines(runId: string, report: Record<string, any>): PdfLine[] {
  const lines: PdfLine[] = [];
  const add = (value: unknown, options: Omit<PdfLine, "text"> = {}) => {
    for (const text of wrap(value)) lines.push({ text, ...options });
  };
  const blank = () => lines.push({ text: "" });
  const r = report.readiness || {};
  const base = report.baseline || {};
  const cons = report.constrained || {};
  const applied = cons.conditions_applied || {};
  const net = applied.network || {};
  const label = cons.label || report.persona?.name || "Persona";
  const v = (x: unknown, unit = "") => (typeof x === "number" ? x.toLocaleString("en-US", { maximumFractionDigits: 1 }) + (unit ? " " + unit : "") : "-");

  blank();
  add("EMULATOR TEST REPORT", { bold: true, size: 12 });
  add("Real Android emulator run: baseline vs selected persona.", { size: 9 });
  blank();
  add("RUN", { bold: true, size: 11 });
  add("Run ID: " + runId);
  add("App: " + (report.apk?.label || "-") + " (" + (report.apk?.package || "-") + ") version " + (report.apk?.version_name || "-"));
  add("APK SHA-256: " + (report.apk_sha256 || "-"));
  add("Persona: " + label + (report.persona?.device ? " - " + report.persona.device : ""));
  add("Engine: " + report.engine + " | Started: " + (report.execution?.started_at || "-") + " | Finished: " + (report.execution?.finished_at || "-"));
  blank();
  add("BHARAT READINESS SCORE", { bold: true, size: 11 });
  add("Score: " + (r.overall ?? "-") + " / 100 - " + String(r.status || "unknown").toUpperCase(), { bold: true });
  for (const [key, cat] of Object.entries<any>(r.categories || {})) {
    add(key + ": " + cat.score + "/100 (" + cat.status + ", weight " + (r.weights?.[key] ?? "-") + "%) - " + cat.why);
  }
  add("Method: " + (r.methodology || "-"));
  blank();
  add("BASELINE VS " + String(label).toUpperCase(), { bold: true, size: 11 });
  const rows: Array<[string, unknown, unknown, string]> = [
    ["Median cold start", base.cold_start_ms_median, cons.cold_start_ms_median, "ms"],
    ["Janky frames", base.frames?.jank_percent, cons.frames?.jank_percent, "%"],
    ["Frame time p90", base.frames?.frame_p90_ms, cons.frames?.frame_p90_ms, "ms"],
    ["Memory PSS", base.memory?.pss_mb, cons.memory?.pss_mb, "MB"],
    ["Crashes", base.signals?.crashes, cons.signals?.crashes, ""],
    ["ANRs", base.signals?.anrs, cons.signals?.anrs, ""],
    ["Out-of-memory", base.signals?.ooms, cons.signals?.ooms, ""],
    ["Low-memory kills", base.signals?.lmk_kills, cons.signals?.lmk_kills, ""],
    ["Network failure lines", base.signals?.network_errors, cons.signals?.network_errors, ""],
    ["Storage failure lines", base.signals?.storage_errors, cons.signals?.storage_errors, ""]
  ];
  for (const [name, b, p, unit] of rows) add(name + ": baseline " + v(b, unit) + " | persona " + v(p, unit));
  if (cons.drop) {
    add("Outage test: " + cons.drop.seconds + " s airplane mode - app " + cons.drop.behaviour +
      (cons.drop.recovery_seconds != null ? ", back in foreground after " + cons.drop.recovery_seconds + " s" : ", did not recover within 30 s"));
  }
  blank();
  add("FINDINGS", { bold: true, size: 11 });
  const findings = [...(cons.findings || []).map((f: any) => ({ ...f, run: label })), ...(base.findings || []).map((f: any) => ({ ...f, run: "Baseline" }))];
  if (!findings.length) add("No crash, ANR, out-of-memory, network or storage failure lines were found in the app log on either run.");
  findings.forEach((f: any, i: number) => {
    add((i + 1) + ". [" + String(f.severity || "").toUpperCase() + "] " + f.message + " (" + f.run + ", confidence " + Math.round((f.confidence || 0) * 100) + "%)", { bold: true });
    add("Fix: " + f.fix);
    (f.evidence || []).slice(0, 6).forEach((line: string) => add("  " + line));
  });
  blank();
  add("ANOMALY DETECTION", { bold: true, size: 11 });
  for (const a of report.anomalies || []) {
    add(a.metric + " - " + a.method + ": " + (a.regression ? "REGRESSION" : "ok"));
  }
  blank();
  add("CONDITIONS APPLIED (READ BACK)", { bold: true, size: 11 });
  add("Device: Android " + (applied.device?.android || "-") + ", " + v(applied.device?.ram_mb_reported, "MB") + " RAM, " + (applied.device?.cpu_cores ?? "-") + " cores");
  add("Network: " + (net.down_kbps ? v(net.down_kbps) + "/" + v(net.up_kbps) + " kbps" : "unshaped") +
    (Array.isArray(net.delay_ms) ? ", " + net.delay_ms[0] + "-" + net.delay_ms[1] + " ms" : "") +
    (net.packet_loss_pct ? ", " + net.packet_loss_pct + "% loss" : "") + (net.enforced_by ? " via " + net.enforced_by : ""));
  add("Battery saver: " + (applied.battery_saver || "off") + " | Free storage: " + (applied.free_storage_mb != null ? applied.free_storage_mb + " MB" : "not limited"));
  if (report.constraint_verification) add("Traffic check: " + report.constraint_verification);
  blank();
  add("LIMITS", { bold: true, size: 11 });
  add(report.result_interpretation || "");
  if (report.ml?.caveat) add("Classifier: " + report.ml.caveat);
  add("A clean log is not proof the app is healthy; automated exploration covers only part of the app.");
  return lines;
}

export function createEngineRunPdf(runId: string, report: Record<string, any>): Blob {
  return linesToPdf(buildEngineLines(runId, report));
}

export function downloadEngineRunPdf(runId: string, report: Record<string, any>): void {
  const blob = createEngineRunPdf(runId, report);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "bharatsim-run-" + runId.slice(0, 8) + ".pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
