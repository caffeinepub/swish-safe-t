/**
 * Word Export for SWiSH SAFE-T Audit Reports
 * Generates an HTML document styled as a formal audit report.
 * Word can open .doc HTML files natively.
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

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LOGO_URL =
  "/assets/uploads/image-019d3d8b-584b-714e-ae50-a38cb11210fd-1.png";

export function exportAuditToWord(
  audit: Audit,
  site: Site,
  client: Client,
  sections: TemplateSection[],
  questions: TemplateQuestion[],
): void {
  const data = parseAuditData(audit.answersJson);
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);

  const branchName = site.branchName || site.siteName || "Branch";
  const auditDate =
    site.scheduledAuditDate || new Date().toISOString().slice(0, 10);

  const headerHtml = `
    <table style="width:100%;border-bottom:2px solid #4a5c3a;margin-bottom:16px">
      <tr>
        <td style="width:33%;text-align:center">
          <span style="font-weight:bold;font-size:13px;color:#4a5c3a">A Plus Automations</span>
        </td>
        <td style="width:34%;text-align:center">
          <img src="${LOGO_URL}" style="height:40px;max-width:160px;object-fit:contain" />
        </td>
        <td style="width:33%;text-align:right;font-size:11px;color:#555">
          Electrical Safety Audit Report
        </td>
      </tr>
    </table>`;

  // Cover page
  const coverHtml = `
    <div style="page-break-after:always;text-align:center;padding:60px 40px;font-family:Arial,sans-serif">
      <img src="${LOGO_URL}" style="height:80px;margin-bottom:32px;object-fit:contain" />
      <h1 style="color:#1a2420;font-size:24px;margin-bottom:8px">Electrical Safety Audit Report</h1>
      <h2 style="color:#4a5c3a;font-size:18px;margin-bottom:32px">${esc(client.name)}</h2>
      <div style="display:inline-block;border:2px solid #4a5c3a;border-radius:8px;padding:24px 48px;margin-bottom:32px">
        <p style="font-size:22px;font-weight:bold;margin:0;color:#1a2420">${esc(branchName)}</p>
        <p style="font-size:14px;color:#666;margin:8px 0 0">${esc(site.branchCode || "")}</p>
        <p style="font-size:12px;color:#888;margin:4px 0 0">${esc(site.branchCity || "")}${site.branchState ? `, ${esc(site.branchState)}` : ""}</p>
      </div>
      <table style="margin:0 auto;font-size:13px;color:#444">
        <tr><td style="padding:4px 12px;font-weight:bold">Auditor:</td><td style="padding:4px 12px">${esc(site.auditorName || "")}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Reviewer:</td><td style="padding:4px 12px">${esc(site.reviewerName || "")}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Manager:</td><td style="padding:4px 12px">${esc(site.managerName || "")}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold">Audit Date:</td><td style="padding:4px 12px">${esc(auditDate)}</td></tr>
      </table>
    </div>`;

  // Section pages
  let sectionHtml = "";
  let sno = 1;
  for (let si = 0; si < sortedSections.length; si++) {
    const sec = sortedSections[si];
    const secQuestions = sortedQuestions.filter(
      (q) => q.sectionId === sec.id && q.isEnabled,
    );

    let tableRows = "";
    for (const q of secQuestions) {
      const ans = data.answers[q.id] ?? { answer: "", remarks: "", images: [] };
      tableRows += `<tr>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;width:6%">${sno++}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;width:42%">${esc(q.label)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;width:22%;text-align:center">${esc(ans.answer)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;width:30%">${esc(ans.remarks)}</td>
      </tr>`;
    }

    // Critical observations
    const obs = data.observations[sec.id] ?? [];
    let obsHtml = "";
    if (obs.length > 0) {
      const obsRows = obs
        .map((ob, oi) => {
          const obsImgs = ob.images
            .slice(0, 3)
            .map((id) => {
              const url = getFileUrl(id);
              return url
                ? `<img src="${esc(url)}" style="max-width:80px;max-height:60px;object-fit:cover;margin:2px" />`
                : "";
            })
            .join("");
          return `<tr>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${oi + 1}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${esc(ob.remarks)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${esc(ob.recommendations)}</td>
          <td style="padding:4px;border:1px solid #ddd">${obsImgs}</td>
        </tr>`;
        })
        .join("");
      obsHtml = `
        <div style="margin-top:16px">
          <h4 style="background:#6b7c3a;color:white;padding:6px 12px;margin:0;font-size:12px">Critical Observations &amp; Recommendations</h4>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tr style="background:#f5f5f5">
              <th style="padding:6px 8px;border:1px solid #ddd;width:5%">#</th>
              <th style="padding:6px 8px;border:1px solid #ddd;width:35%">Observation</th>
              <th style="padding:6px 8px;border:1px solid #ddd;width:35%">Recommendations</th>
              <th style="padding:6px 8px;border:1px solid #ddd;width:25%">Images</th>
            </tr>
            ${obsRows}
          </table>
        </div>`;
    }

    // Power supply
    const ps = data.powerSupply[sec.id];
    let psHtml = "";
    if (ps?.type) {
      const psTypeLabel: Record<string, string> = {
        "3in3out": "3 In / 3 Out",
        "3in1out": "3 In / 1 Out",
        "1in1out": "1 In / 1 Out",
      };
      const entries = Object.entries(ps.fields).filter(([, v]) => v);
      const psRows = entries
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 8px;border:1px solid #ddd;width:50%">${esc(k)}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc(v)}</td></tr>`,
        )
        .join("");
      psHtml = `
        <div style="margin-top:12px">
          <h4 style="background:#6b7c3a;color:white;padding:6px 12px;margin:0;font-size:12px">Power Supply Details \u2013 ${esc(psTypeLabel[ps.type] ?? ps.type)}</h4>
          <table style="width:100%;border-collapse:collapse;font-size:12px">${psRows}</table>
        </div>`;
    }

    sectionHtml += `
      <div style="page-break-before:${si > 0 ? "always" : "avoid"};font-family:Arial,sans-serif;font-size:12px;padding:16px">
        ${headerHtml}
        <h2 style="color:#1a2420;font-size:16px;margin:8px 0 12px;border-bottom:2px solid #4a5c3a;padding-bottom:6px">
          ${si + 1}. ${esc(sec.name)}
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr style="background:#6b7c3a;color:white">
            <th style="padding:8px;border:1px solid #5a6b2a;text-align:center">S/No</th>
            <th style="padding:8px;border:1px solid #5a6b2a">Parameter / Question</th>
            <th style="padding:8px;border:1px solid #5a6b2a;text-align:center">Observation</th>
            <th style="padding:8px;border:1px solid #5a6b2a">Remarks</th>
          </tr>
          ${tableRows}
        </table>
        ${obsHtml}
        ${psHtml}
      </div>`;
  }

  // Photographs section
  let photoHtml = "";
  for (const sec of sortedSections) {
    const secQuestions = sortedQuestions.filter((q) => q.sectionId === sec.id);
    const allImages: Array<{ url: string; label: string; caption: string }> =
      [];
    for (const q of secQuestions) {
      const ans = data.answers[q.id];
      if (ans?.images?.length) {
        for (const id of ans.images) {
          const url = getFileUrl(id);
          if (url)
            allImages.push({ url, label: q.label, caption: ans.remarks });
        }
      }
    }
    if (allImages.length === 0) continue;

    let imgTableRows = "";
    for (let i = 0; i < allImages.length; i += 3) {
      const chunk = allImages.slice(i, i + 3);
      const cells = Array.from({ length: 3 }, (_, j) => {
        const ph = chunk[j];
        return ph
          ? `<td style="padding:8px;text-align:center;width:33%;vertical-align:top">
               <img src="${esc(ph.url)}" style="max-width:180px;max-height:150px;object-fit:cover;border:1px solid #ddd" />
               <p style="font-size:10px;font-weight:bold;margin:4px 0 2px">${esc(ph.label)}</p>
               <p style="font-size:10px;color:#666;margin:0">${esc(ph.caption)}</p>
             </td>`
          : "<td style='width:33%'></td>";
      });
      imgTableRows += `<tr>${cells.join("")}</tr>`;
    }

    photoHtml += `
      <div style="margin-bottom:24px">
        <h4 style="background:#e0e8c8;color:#4a5c3a;padding:6px 12px;font-size:13px;border-left:4px solid #4a5c3a;margin:0 0 8px">${esc(sec.name)}</h4>
        <table style="width:100%;border-collapse:collapse">${imgTableRows}</table>
      </div>`;
  }

  if (photoHtml) {
    sectionHtml += `
      <div style="page-break-before:always;font-family:Arial,sans-serif;padding:16px">
        ${headerHtml}
        <h2 style="color:#1a2420;font-size:16px;margin:8px 0 12px;border-bottom:2px solid #4a5c3a;padding-bottom:6px">Photographs</h2>
        ${photoHtml}
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <title>Electrical Safety Audit Report \u2013 ${esc(branchName)}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; }
    table { border-collapse: collapse; }
    @page { margin: 2cm; }
  </style>
</head>
<body>
  ${coverHtml}
  ${sectionHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = branchName.replace(/[\s/\\]/g, "_");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `SWiSH_SafeT_Audit_${filename}_${dateStr}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
