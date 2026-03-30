/**
 * Excel Export for SWiSH SAFE-T Audit Reports
 * Generates a CSV file downloadable as .csv (opens in Excel)
 */
import { getFileUrl } from "./blob-storage";
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

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function rowToCsv(cells: string[]): string {
  return cells.map(escapeCsv).join(",");
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

  const rows: string[] = [];
  // Header row
  rows.push(
    rowToCsv([
      "S/No",
      "Section",
      "Parameter / Question",
      "Observation / Answer",
      "Remarks",
      "Photo URL",
    ]),
  );

  let sno = 1;
  for (const sec of sortedSections) {
    const secQuestions = sortedQuestions.filter(
      (q) => q.sectionId === sec.id && q.isEnabled,
    );

    for (const q of secQuestions) {
      const ans = data.answers[q.id] ?? { answer: "", remarks: "", images: [] };
      const photoUrl = ans.images.length > 0 ? getFileUrl(ans.images[0]) : "";
      rows.push(
        rowToCsv([
          String(sno++),
          sec.name,
          q.label,
          ans.answer,
          ans.remarks,
          photoUrl,
        ]),
      );
    }

    // Critical observations for this section
    const obs = data.observations[sec.id] ?? [];
    for (let i = 0; i < obs.length; i++) {
      const ob = obs[i];
      const photoUrl = ob.images.length > 0 ? getFileUrl(ob.images[0]) : "";
      rows.push(
        rowToCsv([
          `OBS-${i + 1}`,
          sec.name,
          "Critical Observation",
          ob.remarks,
          ob.recommendations,
          photoUrl,
        ]),
      );
    }

    // Power supply data
    const ps = data.powerSupply[sec.id];
    if (ps?.type) {
      const psTypeLabel: Record<string, string> = {
        "3in3out": "3 In / 3 Out",
        "3in1out": "3 In / 1 Out",
        "1in1out": "1 In / 1 Out",
      };
      rows.push(
        rowToCsv([
          "",
          sec.name,
          `Power Supply (${psTypeLabel[ps.type] ?? ps.type})`,
          "",
          "",
          "",
        ]),
      );
      for (const [key, val] of Object.entries(ps.fields)) {
        if (val) rows.push(rowToCsv(["", "", key, val, "", ""]));
      }
    }
  }

  const csvContent = rows.join("\n");
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const branchName = (site.branchName || site.siteName || "Branch").replace(
    /[\s/\\]/g,
    "_",
  );
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `SWiSH_SafeT_Audit_${branchName}_${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
