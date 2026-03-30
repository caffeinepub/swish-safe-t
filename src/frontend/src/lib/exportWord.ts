import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumberElement,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
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

const OLIVE_COLOR = "6B7C3A";
const _OLIVE_LIGHT = "EAF0D8";
const GREY_SHADING = "E8E8E8";

function base64ToBuffer(dataUrl: string): Buffer | null {
  try {
    const b64 = dataUrl.split(",")[1];
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

function makePageHeader(clientName: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${clientName}`, bold: true, size: 20 }),
      new TextRun({
        text: "  |  APlus Automations  |  SWiSH SAFE-T",
        size: 20,
        color: "555555",
      }),
    ],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: OLIVE_COLOR },
    },
    spacing: { after: 160 },
  });
}

function makeHRule(): Paragraph {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: OLIVE_COLOR },
    },
    spacing: { after: 200 },
  });
}

function makeCoverPage(
  site: Site,
  client: Client,
  audit: Audit,
): (Paragraph | Table)[] {
  const auditDate = audit.lastSavedAt
    ? new Date(audit.lastSavedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

  return [
    new Paragraph({ text: "", spacing: { after: 400 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Electrical Safety Audit Report",
          bold: true,
          size: 52,
          color: OLIVE_COLOR,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "of", size: 36, color: "444444" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: client.name,
          bold: true,
          size: 48,
          color: "222222",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: site.branchName || site.siteName || "Branch",
          bold: true,
          size: 44,
          color: "222222",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: site.branchState || site.state || "",
          bold: true,
          size: 32,
          color: "444444",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    // Branch code / type table
    new Table({
      width: { size: 60, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Branch Code: ${site.branchCode || site.siteCode || "-"}`,
                      bold: true,
                      size: 24,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Branch Type: ${site.branchType || "-"}`,
                      bold: true,
                      size: 24,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ text: "", spacing: { after: 600 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Executed By:",
          bold: true,
          underline: {},
          size: 28,
          color: OLIVE_COLOR,
        }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "M/s APlus Automations", size: 24 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "SWiSH SAFE-T", size: 24, bold: true })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "www.aplusautomations.com",
          size: 24,
          color: "0563C1",
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `on ${auditDate}`, size: 24 })],
      spacing: { after: 0 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "", break: 1 })],
      pageBreakBefore: true,
    }),
  ];
}

function makeSectionContent(
  sec: TemplateSection,
  sectionIndex: number,
  questions: TemplateQuestion[],
  data: AuditData,
  clientName: string,
): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  // Page header (3-col style using text)
  content.push(makePageHeader(clientName));

  // Section heading
  content.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${sectionIndex}. ${sec.name}`,
          bold: true,
          size: 36,
          color: OLIVE_COLOR,
        }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 200 },
    }),
  );

  // Questions table
  const secQuestions = questions
    .filter(
      (q) =>
        q.sectionId === sec.id &&
        q.isEnabled &&
        (q.questionType === "radio" || q.questionType === "dropdown"),
    )
    .sort((a, b) => a.order - b.order);

  if (secQuestions.length > 0) {
    const tableRows: TableRow[] = [
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "S/No.",
                    bold: true,
                    color: "FFFFFF",
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: OLIVE_COLOR },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Parameters need to be checked",
                    bold: true,
                    color: "FFFFFF",
                    size: 18,
                  }),
                ],
              }),
            ],
            width: { size: 46, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: OLIVE_COLOR },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Observation",
                    bold: true,
                    color: "FFFFFF",
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 23, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: OLIVE_COLOR },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Remarks",
                    bold: true,
                    color: "FFFFFF",
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 23, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: OLIVE_COLOR },
          }),
        ],
      }),
      ...secQuestions.map((q, qi) => {
        const ans = data.answers[q.id] ?? {
          answer: "",
          remarks: "",
          images: [],
        };
        const isEven = qi % 2 === 1;
        const rowShading = isEven
          ? { type: ShadingType.SOLID, color: "F8F8F0" }
          : undefined;
        return new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(qi + 1), size: 18 })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: rowShading,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: q.label, size: 18 })],
                }),
              ],
              shading: rowShading,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: ans.answer, size: 18 })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: rowShading,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: ans.remarks, size: 18 })],
                }),
              ],
              shading: rowShading,
            }),
          ],
        });
      }),
    ];

    content.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      }),
    );
    content.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  }

  // Critical Observations
  const obs = data.observations[sec.id] ?? [];
  if (obs.length > 0) {
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Critical Observations & Recommendations",
            bold: true,
            size: 22,
            color: OLIVE_COLOR,
          }),
        ],
        spacing: { before: 200, after: 120 },
      }),
    );

    const obsRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "S/No",
                    bold: true,
                    color: "FFFFFF",
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: OLIVE_COLOR },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Remarks",
                    bold: true,
                    color: "FFFFFF",
                    size: 18,
                  }),
                ],
              }),
            ],
            width: { size: 46, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: OLIVE_COLOR },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Recommendations",
                    bold: true,
                    color: "FFFFFF",
                    size: 18,
                  }),
                ],
              }),
            ],
            width: { size: 46, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: OLIVE_COLOR },
          }),
        ],
      }),
      ...obs.map(
        (ob, oi) =>
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(oi + 1), size: 18 })],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: ob.remarks, size: 18 })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: ob.recommendations, size: 18 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
      ),
    ];

    content.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: obsRows,
      }),
    );
    content.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  }

  // Power Supply Details
  const ps = data.powerSupply[sec.id];
  if (ps?.type) {
    const psTypeLabel: Record<string, string> = {
      "3in3out": "3 in 3 out",
      "3in1out": "3 in 1 out",
      "1in1out": "1 in 1 out",
    };
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Power Supply Details — ${psTypeLabel[ps.type] ?? ps.type}`,
            bold: true,
            size: 22,
            color: OLIVE_COLOR,
          }),
        ],
        spacing: { before: 200, after: 120 },
      }),
    );

    const filledFields = Object.entries(ps.fields).filter(([, v]) => v);
    if (filledFields.length > 0) {
      const psRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Field",
                      bold: true,
                      color: "FFFFFF",
                      size: 18,
                    }),
                  ],
                }),
              ],
              shading: { type: ShadingType.SOLID, color: OLIVE_COLOR },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Value",
                      bold: true,
                      color: "FFFFFF",
                      size: 18,
                    }),
                  ],
                }),
              ],
              shading: { type: ShadingType.SOLID, color: OLIVE_COLOR },
            }),
          ],
        }),
        ...filledFields.map(
          ([key, val]) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: key.toUpperCase(), size: 18 }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: val, size: 18 })],
                    }),
                  ],
                }),
              ],
            }),
        ),
      ];
      content.push(
        new Table({
          width: { size: 60, type: WidthType.PERCENTAGE },
          rows: psRows,
        }),
      );
    }
    content.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  }

  content.push(makeHRule());

  return content;
}

async function makePhotoPages(
  sections: TemplateSection[],
  questions: TemplateQuestion[],
  data: AuditData,
  clientName: string,
): Promise<(Paragraph | Table)[]> {
  const content: (Paragraph | Table)[] = [];

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  for (const sec of sortedSections) {
    // Collect all images for this section (from questions + observations)
    const allImages: { dataUrl: string; caption: string }[] = [];

    const secQuestions = questions
      .filter((q) => q.sectionId === sec.id && q.isEnabled)
      .sort((a, b) => a.order - b.order);

    for (const q of secQuestions) {
      const ans = data.answers[q.id];
      if (ans?.images?.length) {
        for (const img of ans.images) {
          allImages.push({ dataUrl: img, caption: ans.remarks || q.label });
        }
      }
    }

    const obs = data.observations[sec.id] ?? [];
    for (const ob of obs) {
      if (ob.images?.length) {
        for (const img of ob.images) {
          allImages.push({
            dataUrl: img,
            caption: ob.remarks || "Critical Observation",
          });
        }
      }
    }

    if (allImages.length === 0) continue;

    // Section header
    content.push(makePageHeader(clientName));
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: sec.name,
            bold: true,
            size: 24,
            color: "FFFFFF",
          }),
        ],
        alignment: AlignmentType.CENTER,
        shading: {
          type: ShadingType.SOLID,
          color: GREY_SHADING,
          fill: GREY_SHADING,
        },
        spacing: { before: 160, after: 200 },
      }),
    );

    // Group images 3 per row
    for (let i = 0; i < allImages.length; i += 3) {
      const chunk = allImages.slice(i, i + 3);
      // Pad to 3
      while (chunk.length < 3) chunk.push({ dataUrl: "", caption: "" });

      const cells: TableCell[] = await Promise.all(
        chunk.map(async (img, ci) => {
          const cellChildren: Paragraph[] = [];

          if (img.dataUrl) {
            // Label
            cellChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Image ${i + ci + 1}`,
                    bold: true,
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
              }),
            );

            // Image
            const buf = base64ToBuffer(img.dataUrl);
            if (buf) {
              try {
                cellChildren.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: buf,
                        transformation: { width: 180, height: 130 },
                        type: "jpg",
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 60 },
                  }),
                );
              } catch {
                cellChildren.push(
                  new Paragraph({
                    children: [new TextRun({ text: "[Image]", size: 18 })],
                  }),
                );
              }
            }

            // Caption
            cellChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: img.caption,
                    size: 16,
                    color: "555555",
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            );
          } else {
            cellChildren.push(new Paragraph({ text: "" }));
          }

          return new TableCell({
            children: cellChildren,
            width: { size: 33, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          });
        }),
      );

      content.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ children: cells })],
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
        }),
      );
      content.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    }
  }

  return content;
}

export async function exportAuditToWord(
  audit: Audit,
  site: Site,
  client: Client,
  sections: TemplateSection[],
  questions: TemplateQuestion[],
): Promise<void> {
  const data = parseAuditData(audit.answersJson);
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  const pageFooter = new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: "Electrical Safety Audit Report",
            size: 18,
            color: "555555",
          }),
          new TextRun({ text: "  |  Page ", size: 18, color: "555555" }),
          new PageNumberElement(),
        ],
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: OLIVE_COLOR },
        },
      }),
    ],
  });

  // Cover page children
  const coverChildren: (Paragraph | Table)[] = makeCoverPage(
    site,
    client,
    audit,
  );

  // Report section children (one per template section)
  const reportChildren: (Paragraph | Table)[] = [];
  for (let i = 0; i < sortedSections.length; i++) {
    const sec = sortedSections[i];
    const secContent = makeSectionContent(
      sec,
      i + 1,
      questions,
      data,
      client.name,
    );
    reportChildren.push(...secContent);
  }

  // Photo pages
  const photoChildren = await makePhotoPages(
    sortedSections,
    questions,
    data,
    client.name,
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        footers: { default: pageFooter },
        children: [...coverChildren, ...reportChildren, ...photoChildren],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  const branchName = (site.branchName || site.siteName || "Branch").replace(
    /[\s/\\]/g,
    "_",
  );
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `SWiSH_SafeT_Audit_${branchName}_${dateStr}.docx`;

  saveAs(blob, filename);
}
