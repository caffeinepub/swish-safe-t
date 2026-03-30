import * as XLSX from "xlsx";
import type {
  Audit,
  Client,
  Site,
  TemplateQuestion,
  TemplateSection,
} from "./dataStore";

interface AuditData {
  answers: Record<
    string,
    { answer: string; remarks: string; images: string[] }
  >;
  observations: Record<
    string,
    Array<{
      id: string;
      remarks: string;
      recommendations: string;
      images: string[];
    }>
  >;
  powerSupply: Record<string, { type: string; fields: Record<string, string> }>;
}

function parseAuditData(json: string): AuditData {
  const answers: AuditData["answers"] = {};
  const observations: AuditData["observations"] = {};
  const powerSupply: AuditData["powerSupply"] = {};
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) {
      for (const [k, v] of Object.entries(parsed)) {
        if (k.startsWith("__obs_")) {
          observations[k.slice(6)] = Array.isArray(v)
            ? (v as AuditData["observations"][string])
            : [];
        } else if (k.startsWith("__ps_")) {
          powerSupply[k.slice(5)] =
            typeof v === "object" && v !== null
              ? (v as AuditData["powerSupply"][string])
              : { type: "", fields: {} };
        } else if (typeof v === "object" && v !== null && "answer" in v) {
          answers[k] = v as AuditData["answers"][string];
        } else if (typeof v === "string") {
          answers[k] = { answer: v, remarks: "", images: [] };
        }
      }
    }
  } catch {
    /* noop */
  }
  return { answers, observations, powerSupply };
}

export function exportAuditToExcel(
  audit: Audit,
  site: Site,
  _client: Client,
  sections: TemplateSection[],
  questions: TemplateQuestion[],
): void {
  const data = parseAuditData(audit.answersJson);
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);

  const rows: (string | number)[][] = [];
  // Header row
  rows.push(["S/No", "Section", "Question", "Observation (Answer)", "Remarks"]);

  let sno = 1;
  for (const sec of sortedSections) {
    const secQuestions = sortedQuestions.filter(
      (q) =>
        q.sectionId === sec.id &&
        q.isEnabled &&
        (q.questionType === "radio" || q.questionType === "dropdown"),
    );

    for (const q of secQuestions) {
      const ans = data.answers[q.id] ?? { answer: "", remarks: "", images: [] };
      rows.push([sno++, sec.name, q.label, ans.answer, ans.remarks]);
    }

    // Critical observations for this section
    const obs = data.observations[sec.id] ?? [];
    for (const ob of obs) {
      rows.push([
        "OBSERVATION",
        sec.name,
        "Critical Observation",
        ob.remarks,
        ob.recommendations,
      ]);
    }

    // Power supply data
    const ps = data.powerSupply[sec.id];
    if (ps?.type) {
      const psTypeLabel: Record<string, string> = {
        "3in3out": "3 in 3 out",
        "3in1out": "3 in 1 out",
        "1in1out": "1 in 1 out",
      };
      rows.push([
        "POWER SUPPLY",
        sec.name,
        `Power Supply Details (${psTypeLabel[ps.type] ?? ps.type})`,
        "",
        "",
      ]);
      for (const [key, val] of Object.entries(ps.fields)) {
        if (val) rows.push(["", "", key, val, ""]);
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Style header row — olive-green background approximation via cell style
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "7A9E3B" } },
    alignment: { horizontal: "center" },
  };
  const headerCols = ["A", "B", "C", "D", "E"];
  for (const col of headerCols) {
    const cellRef = `${col}1`;
    if (ws[cellRef]) {
      ws[cellRef].s = headerStyle;
    }
  }

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, // S/No
    { wch: 28 }, // Section
    { wch: 45 }, // Question
    { wch: 20 }, // Answer
    { wch: 35 }, // Remarks
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Audit Report");

  const branchName = (site.branchName || site.siteName || "Branch").replace(
    /[\s/\\]/g,
    "_",
  );
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `SWiSH_SafeT_Audit_${branchName}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);
}
