import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  FileDown,
  FileSpreadsheet,
  ImageIcon,
  Loader2,
  Minus,
  PlusCircle,
  Save,
  X,
  Zap,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { NavPage } from "../App";
import MobileNav from "../components/MobileNav";
import Sidebar from "../components/Sidebar";
import { backendSync } from "../lib/backendSync";
import { getFileUrl, uploadFile } from "../lib/blob-storage";
import {
  type Audit,
  type AuditAnswers,
  type QuestionAnswer,
  type TemplateQuestion,
  type TemplateSection,
  auditStore,
  clientStore,
  siteStore,
  templateQuestionStore,
  templateSectionStore,
  templateStore,
} from "../lib/dataStore";
import { exportAuditToExcel } from "../lib/exportExcel";
import { exportAuditToWord } from "../lib/exportWord";
import type { Session } from "../lib/session";

interface Props {
  session: Session;
  siteId: string;
  auditId?: string;
  onNavigate: (page: NavPage) => void;
}

interface SectionObservation {
  id: string;
  remarks: string;
  recommendations: string;
  images: string[];
}

export type PowerSupplyType = "3in3out" | "3in1out" | "1in1out" | "";

export interface PowerSupplyData {
  type: PowerSupplyType;
  fields: Record<string, string>;
}

type ValidationErrors = Record<
  string,
  { answer?: boolean; remarks?: boolean; images?: boolean }
>;

const STATUS_CONFIG: Record<Audit["status"], { label: string; cls: string }> = {
  Draft: {
    label: "Draft",
    cls: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  },
  Submitted: {
    label: "Submitted",
    cls: "bg-orange-900/40 text-orange-300 border-orange-700/50",
  },
  PendingApproval: {
    label: "Pending Approval",
    cls: "bg-amber-900/40 text-amber-300 border-amber-700/50",
  },
  ReturnedForCorrection: {
    label: "Returned for Correction",
    cls: "bg-rose-900/40 text-rose-300 border-rose-700/50",
  },
  Completed: {
    label: "Completed",
    cls: "bg-green-900/40 text-green-300 border-green-700/50",
  },
};

// ── Power Supply field definitions ─────────────────────────────────────────

const PS_TYPE_LABELS: Record<string, string> = {
  "3in3out": "3 in 3 out",
  "3in1out": "3 in 1 out",
  "1in1out": "1 in 1 out",
};

// ── Power Supply table definitions ─────────────────────────────────────────

interface PsSubColumn {
  fields: ({ key: string; label: string } | null)[];
}

interface PsColumnGroup {
  header: string;
  subColumns: PsSubColumn[];
}

function getPsTableSchema(type: PowerSupplyType): PsColumnGroup[] {
  if (type === "3in3out") {
    return [
      {
        header: "Voltage",
        subColumns: [
          {
            fields: [
              { key: "v_rn", label: "RN" },
              { key: "v_yn", label: "YN" },
              { key: "v_bn", label: "BN" },
              null,
            ],
          },
          {
            fields: [
              { key: "v_ry", label: "RY" },
              { key: "v_yb", label: "YB" },
              { key: "v_br", label: "BR" },
              null,
            ],
          },
        ],
      },
      {
        header: "Current",
        subColumns: [
          {
            fields: [
              { key: "c_r", label: "R" },
              { key: "c_y", label: "Y" },
              { key: "c_b", label: "B" },
              { key: "c_n", label: "N" },
            ],
          },
        ],
      },
      {
        header: "Earthing",
        subColumns: [
          {
            fields: [
              { key: "e_re", label: "RE" },
              { key: "e_ye", label: "YE" },
              { key: "e_be", label: "BE" },
              { key: "e_ne", label: "NE" },
            ],
          },
        ],
      },
    ];
  }
  if (type === "3in1out") {
    return [
      {
        header: "Voltage",
        subColumns: [
          {
            fields: [
              { key: "v_rn", label: "RN" },
              { key: "v_yn", label: "YN" },
              { key: "v_bn", label: "BN" },
              null,
            ],
          },
          {
            fields: [
              { key: "v_re", label: "RE" },
              { key: "v_ye", label: "YE" },
              { key: "v_be", label: "BE" },
              { key: "v_ne", label: "NE" },
            ],
          },
        ],
      },
      {
        header: "Current",
        subColumns: [
          {
            fields: [
              { key: "c_r", label: "R" },
              { key: "c_y", label: "Y" },
              { key: "c_b", label: "B" },
              { key: "c_n", label: "N" },
            ],
          },
        ],
      },
      {
        header: "Output",
        subColumns: [
          {
            fields: [
              { key: "o_pn", label: "PN" },
              { key: "o_ne", label: "NE" },
              { key: "o_p", label: "P" },
              { key: "o_n", label: "N" },
            ],
          },
        ],
      },
    ];
  }
  if (type === "1in1out") {
    return [
      {
        header: "Input",
        subColumns: [
          {
            fields: [
              { key: "i_pn", label: "PN" },
              { key: "i_ne", label: "NE" },
              { key: "i_pe", label: "PE" },
            ],
          },
          {
            fields: [
              { key: "i_p", label: "P" },
              { key: "i_n", label: "N" },
              null,
            ],
          },
        ],
      },
      {
        header: "Output",
        subColumns: [
          {
            fields: [
              { key: "o_pn", label: "PN" },
              { key: "o_ne", label: "NE" },
              { key: "o_pe", label: "PE" },
            ],
          },
          {
            fields: [
              { key: "o_p", label: "P" },
              { key: "o_n", label: "N" },
              null,
            ],
          },
        ],
      },
    ];
  }
  return [];
}

// ── PowerSupplyPanel component (memoized) ───────────────────────────────────

const PowerSupplyPanel = memo(function PowerSupplyPanel({
  data,
  canEdit,
  onChange,
}: {
  data: PowerSupplyData;
  canEdit: boolean;
  onChange: (next: PowerSupplyData) => void;
}) {
  const schema = getPsTableSchema(data.type);

  const handleTypeChange = (val: string) => {
    onChange({ type: val as PowerSupplyType, fields: {} });
  };

  const handleFieldChange = (key: string, val: string) => {
    onChange({ ...data, fields: { ...data.fields, [key]: val } });
  };

  const rowCount = schema.reduce(
    (max, g) => Math.max(max, ...g.subColumns.map((sc) => sc.fields.length)),
    0,
  );
  const rowIndices = Array.from({ length: rowCount }, (_, i) => i);

  return (
    <div className="rounded-lg border border-gray-300 bg-white mt-4 overflow-hidden shadow-sm">
      {/* Panel header */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <Zap className="h-4 w-4 text-gray-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-700">
          Power Supply Details
        </span>
        <span className="ml-2 text-xs text-gray-400">(optional)</span>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Type selector */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-gray-500 shrink-0 w-24">Type</Label>
          <Select
            value={data.type || "__none"}
            onValueChange={(v) =>
              canEdit && handleTypeChange(v === "__none" ? "" : v)
            }
            disabled={!canEdit}
          >
            <SelectTrigger className="bg-white border-gray-300 text-gray-800 max-w-[200px] text-sm">
              <SelectValue placeholder="— Select type —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" className="text-gray-400">
                — None —
              </SelectItem>
              {Object.entries(PS_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {data.type && schema.length > 0 && (
          <div className="overflow-x-auto">
            <p className="text-xs font-semibold text-gray-600 mb-2">
              {PS_TYPE_LABELS[data.type]} - Details
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {schema.map((group) => (
                    <th
                      key={group.header}
                      colSpan={group.subColumns.length}
                      className="border border-gray-300 bg-gray-50 text-center text-xs font-semibold text-gray-700 px-2 py-1.5"
                    >
                      {group.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowIndices.map((rowIdx) => (
                  <tr
                    key={`row-${rowIdx}`}
                    className="border-b border-gray-200"
                  >
                    {schema.map((group) =>
                      group.subColumns.map((subCol, scIdx) => {
                        const cell = subCol.fields[rowIdx] ?? null;
                        return (
                          <td
                            key={`${group.header}-${scIdx}-${rowIdx}`}
                            className="border border-gray-200 p-1.5"
                          >
                            {cell ? (
                              <div className="flex items-center gap-0 rounded overflow-hidden border border-gray-300 bg-white">
                                <span className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 border-r border-gray-300 shrink-0 whitespace-nowrap">
                                  {cell.label}
                                </span>
                                <input
                                  type="text"
                                  value={data.fields[cell.key] ?? ""}
                                  onChange={(e) =>
                                    canEdit &&
                                    handleFieldChange(cell.key, e.target.value)
                                  }
                                  disabled={!canEdit}
                                  className="flex-1 min-w-0 px-2 py-1 text-sm text-gray-800 bg-white outline-none disabled:bg-gray-50"
                                />
                              </div>
                            ) : (
                              <div className="h-8" />
                            )}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function emptyAnswer(): QuestionAnswer {
  return { answer: "", remarks: "", images: [] };
}

function emptyPs(): PowerSupplyData {
  return { type: "", fields: {} };
}

function genId(): string {
  return `obs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseAnswers(json: string): {
  answers: AuditAnswers;
  observations: Record<string, SectionObservation[]>;
  powerSupply: Record<string, PowerSupplyData>;
} {
  const answers: AuditAnswers = {};
  const observations: Record<string, SectionObservation[]> = {};
  const powerSupply: Record<string, PowerSupplyData> = {};
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) {
      for (const [k, v] of Object.entries(parsed)) {
        if (k.startsWith("__obs_")) {
          const secId = k.slice(6);
          observations[secId] = Array.isArray(v)
            ? (v as SectionObservation[])
            : [];
        } else if (k.startsWith("__ps_")) {
          const secId = k.slice(5);
          powerSupply[secId] =
            typeof v === "object" && v !== null
              ? (v as PowerSupplyData)
              : emptyPs();
        } else if (typeof v === "object" && v !== null && "answer" in v) {
          answers[k] = v as QuestionAnswer;
        } else if (typeof v === "string") {
          answers[k] = { answer: v, remarks: "", images: [] };
        } else if (Array.isArray(v)) {
          answers[k] = { answer: "", remarks: "", images: v as string[] };
        }
      }
    }
  } catch {
    /* noop */
  }
  return { answers, observations, powerSupply };
}

// ── QuestionCard (memoized) ──────────────────────────────────────────────────

interface QuestionCardProps {
  q: TemplateQuestion;
  ans: QuestionAnswer;
  qErr: { answer?: boolean; remarks?: boolean; images?: boolean };
  canEdit: boolean;
  qi: number;
  questionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onUpdateAnswer: (
    qId: string,
    field: keyof QuestionAnswer,
    value: string | string[],
  ) => void;
  onFileUpload: (qId: string, files: FileList | null) => void;
  onRemoveImage: (qId: string, idx: number) => void;
}

const QuestionCard = memo(function QuestionCard({
  q,
  ans,
  qErr,
  canEdit,
  qi,
  questionRefs,
  onUpdateAnswer,
  onFileUpload,
  onRemoveImage,
}: QuestionCardProps) {
  const hasQErr = qErr.answer || qErr.remarks || qErr.images;
  return (
    <div
      ref={(el) => {
        questionRefs.current[q.id] = el;
      }}
      data-ocid={`questionnaire.item.${qi + 1}`}
      className={`rounded-lg border p-4 space-y-4 transition-colors ${
        hasQErr
          ? "border-red-600 bg-red-900/10"
          : "border-[#2a3d33] bg-[#151f1a]"
      }`}
    >
      <p className="text-sm font-semibold text-white">
        <span className="text-[#8aad3a] mr-2">Q{qi + 1}.</span>
        {q.label}
      </p>

      <div>
        <p className="text-xs text-gray-400 mb-2">
          Answer
          {qErr.answer && <span className="text-red-400 ml-1">* Required</span>}
        </p>
        {q.questionType === "radio" && (
          <RadioGroup
            value={ans.answer}
            onValueChange={(v) => canEdit && onUpdateAnswer(q.id, "answer", v)}
            className="flex flex-wrap gap-4"
            disabled={!canEdit}
          >
            {q.options.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <RadioGroupItem
                  value={opt}
                  id={`${q.id}_${opt}`}
                  className="border-[#4a7c59] text-[#8aad3a]"
                />
                <Label
                  htmlFor={`${q.id}_${opt}`}
                  className="text-gray-300 text-sm cursor-pointer"
                >
                  {opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}
        {q.questionType === "dropdown" && (
          <Select
            value={ans.answer}
            onValueChange={(v) => canEdit && onUpdateAnswer(q.id, "answer", v)}
            disabled={!canEdit}
          >
            <SelectTrigger
              className={`bg-[#111c18] border-[#3a4f44] text-white max-w-sm ${
                qErr.answer ? "border-red-600" : ""
              }`}
            >
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
              {q.options.map((opt) => (
                <SelectItem
                  key={opt}
                  value={opt}
                  className="text-white focus:bg-[#2d3f38]"
                >
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">
          Remarks *
          {qErr.remarks && (
            <span className="text-red-400 ml-1">— required</span>
          )}
        </p>
        <Textarea
          data-ocid="questionnaire.textarea"
          value={ans.remarks}
          onChange={(e) =>
            canEdit && onUpdateAnswer(q.id, "remarks", e.target.value)
          }
          placeholder="Enter your remarks here..."
          className={`bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-600 resize-none min-h-[80px] ${
            qErr.remarks ? "border-red-600 focus-visible:ring-red-600" : ""
          }`}
          disabled={!canEdit}
        />
      </div>

      {q.enableImageUpload && (
        <div>
          <p className="text-xs text-gray-400 mb-2">
            <ImageIcon className="h-3.5 w-3.5 inline mr-1" />
            Image Upload
            {q.imageUploadMandatory ? (
              <span className="text-red-400 ml-1">*</span>
            ) : (
              <span className="text-gray-600 ml-1">(optional)</span>
            )}
            {qErr.images && (
              <span className="text-red-400 ml-1">
                — at least 1 image required
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            {ans.images.map((src, i) => (
              <div key={`img_${q.id}_${i}`} className="relative group">
                <img
                  loading="lazy"
                  src={getFileUrl(src)}
                  alt={`Upload ${i + 1}`}
                  className="h-20 w-20 object-cover rounded border border-[#3a4f44]"
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemoveImage(q.id, i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-700 text-white rounded-full h-5 w-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <label className="cursor-pointer">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-300 transition-colors border ${
                  qErr.images
                    ? "bg-red-900/20 border-red-600 hover:bg-red-900/30"
                    : "bg-[#2a3d33] hover:bg-[#3a4f44] border-[#3a4f44]"
                }`}
              >
                <ImageIcon className="h-4 w-4" /> Upload Images
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onFileUpload(q.id, e.target.files)}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
});

// ── Normalize legacy audit statuses ────────────────────────────────────────
function normalizeAuditStatus(raw: string): Audit["status"] {
  const lower = raw.toLowerCase().replace(/[\s_-]+/g, "");
  if (lower === "draft" || lower === "inprogress") return "Draft";
  if (
    lower === "submitted" ||
    lower === "pendingreview" ||
    lower === "pendingforreview"
  )
    return "Submitted";
  if (lower === "pendingapproval" || lower === "underreview")
    return "PendingApproval";
  if (
    lower === "returnedforcorrection" ||
    lower === "returned" ||
    lower === "rejected"
  )
    return "ReturnedForCorrection";
  if (lower === "completed" || lower === "approved") return "Completed";
  return "Draft";
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function QuestionnairePage({
  session,
  siteId,
  auditId,
  onNavigate,
}: Props) {
  const role = session.role;
  const site = siteStore.getById(siteId);
  const client = site ? clientStore.getById(site.clientId) : null;
  const template = site?.templateId
    ? templateStore.getById(site.templateId)
    : null;
  const sections: TemplateSection[] = template
    ? templateSectionStore.getByTemplate(template.id)
    : [];
  const questionsBySec = useMemo(() => {
    const map: Record<string, TemplateQuestion[]> = {};
    for (const sec of sections) {
      map[sec.id] = templateQuestionStore
        .getBySection(sec.id)
        .filter(
          (q) => q.questionType === "radio" || q.questionType === "dropdown",
        );
    }
    return map;
  }, [sections]);

  const initParsed = (() => {
    const src = auditId
      ? auditStore.getById(auditId)
      : site
        ? auditStore
            .getBySite(site.id)
            .sort((a, b) => b.lastSavedAt - a.lastSavedAt)[0]
        : null;
    if (!src) return { answers: {}, observations: {}, powerSupply: {} };
    return parseAnswers(src.answersJson);
  })();

  const [audit, setAudit] = useState<Audit | null>(() => {
    const raw = auditId
      ? auditStore.getById(auditId)
      : site
        ? (auditStore
            .getBySite(site.id)
            .sort((a, b) => b.lastSavedAt - a.lastSavedAt)[0] ?? null)
        : null;
    if (!raw) return null;
    const normalized = normalizeAuditStatus(raw.status as string);
    if (normalized !== raw.status) {
      auditStore.update(raw.id, { status: normalized });
      return { ...raw, status: normalized };
    }
    return raw;
  });

  const [answers, setAnswers] = useState<AuditAnswers>(initParsed.answers);
  const [sectionObservations, setSectionObservations] = useState<
    Record<string, SectionObservation[]>
  >(initParsed.observations);
  const [sectionPowerSupply, setSectionPowerSupply] = useState<
    Record<string, PowerSupplyData>
  >(initParsed.powerSupply);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [photosExpanded, setPhotosExpanded] = useState(true);
  const [obsErrors, setObsErrors] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [deleteObsTarget, setDeleteObsTarget] = useState<{
    secId: string;
    obsId: string;
  } | null>(null);
  const [showSendBackDialog, setShowSendBackDialog] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Refs for latest state (used in stable callbacks) ─────────────────────
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const sectionObservationsRef = useRef(sectionObservations);
  sectionObservationsRef.current = sectionObservations;
  const sectionPowerSupplyRef = useRef(sectionPowerSupply);
  sectionPowerSupplyRef.current = sectionPowerSupply;

  useEffect(() => {
    if (!audit && site && template) {
      const a = auditStore.add({
        siteId: site.id,
        clientId: site.clientId,
        auditorId: role === "auditor" ? session.userId : site.auditorId,
        auditorName: role === "auditor" ? session.fullName : site.auditorName,
        status: "Draft",
        answersJson: "{}",
        reviewComment: "",
        lastSavedAt: Date.now(),
        startedAt: Date.now(),
      });
      setAudit(a);
    }
  }, [audit, site, template, role, session]);

  // ── Backend sync: load audit from canister on mount ──────────────────────
  useEffect(() => {
    backendSync
      .loadAudit(siteId)
      .then(() => {
        const updated = auditStore.getLatestBySite(siteId);
        if (updated) {
          const parsed = parseAnswers(updated.answersJson);
          setAnswers(parsed.answers);
          setSectionObservations(parsed.observations);
          setSectionPowerSupply(parsed.powerSupply);
          setAudit((prev) => {
            if (!prev) return prev;
            const normalized = normalizeAuditStatus(updated.status as string);
            return { ...prev, ...updated, status: normalized };
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // ── saveAnswers — reads from refs so it has no stale-closure issues ───────
  const saveAnswers = useCallback(() => {
    if (!audit) return;
    const currentAnswers = answersRef.current;
    const currentObs = sectionObservationsRef.current;
    const currentPs = sectionPowerSupplyRef.current;
    setSaving(true);
    try {
      const combined = {
        ...currentAnswers,
        ...Object.fromEntries(
          Object.entries(currentObs).map(([secId, rows]) => [
            `__obs_${secId}`,
            rows,
          ]),
        ),
        ...Object.fromEntries(
          Object.entries(currentPs)
            .filter(([, ps]) => ps.type)
            .map(([secId, ps]) => [`__ps_${secId}`, ps]),
        ),
      };
      const answersJson = JSON.stringify(combined);
      try {
        localStorage.setItem(`audit_draft_${siteId}`, answersJson);
      } catch {
        // Storage quota exceeded — skip draft cache but continue saving in memory
      }
      auditStore.update(audit.id, {
        answersJson,
        lastSavedAt: Date.now(),
      });
      backendSync.pushAudit(siteId);
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  }, [audit, siteId]);

  // Keep a ref to saveAnswers so stable callbacks can always call the latest version
  const saveAnswersRef = useRef(saveAnswers);
  saveAnswersRef.current = saveAnswers;

  // ── Stable answer callbacks (empty deps — functional updaters) ────────────
  const updateAnswer = useCallback(
    (qId: string, field: keyof QuestionAnswer, value: string | string[]) => {
      setAnswers((prev) => {
        const current = prev[qId] ?? emptyAnswer();
        return { ...prev, [qId]: { ...current, [field]: value } };
      });
      setErrors((prev) => {
        const n = { ...prev };
        if (n[qId]) {
          const updated = { ...n[qId], [field]: false };
          if (!updated.answer && !updated.remarks && !updated.images)
            delete n[qId];
          else n[qId] = updated;
        }
        return n;
      });
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(
        () => saveAnswersRef.current(),
        5000,
      );
    },
    [],
  );

  const handleFileUpload = useCallback(
    (qId: string, files: FileList | null) => {
      if (!files || !files.length) return;
      const uploads: Promise<string>[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        uploads.push(
          uploadFile(file)
            .then(({ id }) => id)
            .catch(() => ""),
        );
      }
      Promise.all(uploads).then((ids) => {
        const newIds = ids.filter(Boolean);
        setAnswers((prev) => {
          const current = prev[qId] ?? emptyAnswer();
          return {
            ...prev,
            [qId]: { ...current, images: [...current.images, ...newIds] },
          };
        });
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(
          () => saveAnswersRef.current(),
          5000,
        );
      });
    },
    [],
  );

  const removeImage = useCallback((qId: string, idx: number) => {
    setAnswers((prev) => {
      const current = prev[qId] ?? emptyAnswer();
      return {
        ...prev,
        [qId]: {
          ...current,
          images: current.images.filter((_, i) => i !== idx),
        },
      };
    });
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => saveAnswersRef.current(), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const handleManualSave = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    saveAnswers();
    toast.success("Report saved");
  };

  // ── Power Supply helpers (stable) ────────────────────────────────────────

  const getPsData = (secId: string): PowerSupplyData =>
    sectionPowerSupply[secId] ?? emptyPs();

  const updatePsData = useCallback((secId: string, next: PowerSupplyData) => {
    setSectionPowerSupply((prev) => {
      const updated = { ...prev, [secId]: next };
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(
        () => saveAnswersRef.current(),
        5000,
      );
      return updated;
    });
  }, []);

  // ── Observation helpers (stable) ─────────────────────────────────────────

  const getObservations = (secId: string): SectionObservation[] =>
    sectionObservations[secId] ?? [];

  const persistObs = useCallback(
    (secId: string, next: SectionObservation[]) => {
      setSectionObservations((prev) => {
        const updated = { ...prev, [secId]: next };
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(
          () => saveAnswersRef.current(),
          5000,
        );
        return updated;
      });
    },
    [],
  );

  const addObservation = useCallback((secId: string) => {
    setSectionObservations((prev) => {
      const current = prev[secId] ?? [];
      const next = [
        ...current,
        { id: genId(), remarks: "", recommendations: "", images: [] },
      ];
      const updated = { ...prev, [secId]: next };
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(
        () => saveAnswersRef.current(),
        5000,
      );
      return updated;
    });
  }, []);

  const removeObservation = useCallback((secId: string, obsId: string) => {
    setSectionObservations((prev) => {
      const current = prev[secId] ?? [];
      const next = current.filter((o) => o.id !== obsId);
      const updated = { ...prev, [secId]: next };
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(
        () => saveAnswersRef.current(),
        5000,
      );
      return updated;
    });
  }, []);

  const duplicateObservation = useCallback((secId: string, obsId: string) => {
    setSectionObservations((prev) => {
      const current = prev[secId] ?? [];
      const idx = current.findIndex((o) => o.id === obsId);
      if (idx < 0) return prev;
      const clone: SectionObservation = { ...current[idx], id: genId() };
      const next = [
        ...current.slice(0, idx + 1),
        clone,
        ...current.slice(idx + 1),
      ];
      const updated = { ...prev, [secId]: next };
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(
        () => saveAnswersRef.current(),
        5000,
      );
      return updated;
    });
  }, []);

  const updateObservationField = useCallback(
    (
      secId: string,
      obsId: string,
      field: "remarks" | "recommendations",
      value: string,
    ) => {
      persistObs(
        secId,
        (sectionObservationsRef.current[secId] ?? []).map((o) =>
          o.id === obsId ? { ...o, [field]: value } : o,
        ),
      );
    },
    [persistObs],
  );

  const handleObsImageUpload = useCallback(
    (secId: string, obsId: string, files: FileList | null) => {
      if (!files || !files.length) return;
      const uploads: Promise<string>[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        uploads.push(
          uploadFile(file)
            .then(({ id }) => id)
            .catch(() => ""),
        );
      }
      Promise.all(uploads).then((ids) => {
        persistObs(
          secId,
          (sectionObservationsRef.current[secId] ?? []).map((o) =>
            o.id === obsId
              ? { ...o, images: [...o.images, ...ids.filter(Boolean)] }
              : o,
          ),
        );
        setObsErrors((prev) => {
          const n = new Set(prev);
          n.delete(obsId);
          return n;
        });
      });
    },
    [persistObs],
  );

  const removeObsImage = useCallback(
    (secId: string, obsId: string, imgIdx: number) => {
      persistObs(
        secId,
        (sectionObservationsRef.current[secId] ?? []).map((o) =>
          o.id === obsId
            ? { ...o, images: o.images.filter((_, i) => i !== imgIdx) }
            : o,
        ),
      );
    },
    [persistObs],
  );

  // ── Validation ────────────────────────────────────────────────────────────

  const validateAndSubmit = () => {
    if (!audit) return;
    const newErrors: ValidationErrors = {};
    const newObsErrors = new Set<string>();
    let hasError = false;

    for (const sec of sections) {
      const qs = questionsBySec[sec.id] ?? [];
      for (const q of qs) {
        const ans = answers[q.id] ?? emptyAnswer();
        const qErr: { answer?: boolean; remarks?: boolean; images?: boolean } =
          {};
        if (!ans.answer) {
          qErr.answer = true;
          hasError = true;
        }
        if (!ans.remarks.trim()) {
          qErr.remarks = true;
          hasError = true;
        }
        if (
          q.enableImageUpload &&
          q.imageUploadMandatory &&
          ans.images.length === 0
        ) {
          qErr.images = true;
          hasError = true;
        }
        if (Object.keys(qErr).length > 0) newErrors[q.id] = qErr;
      }

      const obs = sectionObservations[sec.id] ?? [];
      for (const o of obs) {
        if (o.images.length === 0) {
          newObsErrors.add(o.id);
          hasError = true;
        }
      }
    }

    setErrors(newErrors);
    setObsErrors(newObsErrors);

    if (hasError) {
      // Expand sections with errors
      const errorSecIds = new Set<string>();
      for (const sec of sections) {
        const qs = questionsBySec[sec.id] ?? [];
        if (qs.some((q) => newErrors[q.id])) errorSecIds.add(sec.id);
        const obs = sectionObservations[sec.id] ?? [];
        if (obs.some((o) => newObsErrors.has(o.id))) errorSecIds.add(sec.id);
      }
      setExpandedSections((prev) => {
        const n = new Set(prev);
        for (const id of errorSecIds) n.add(id);
        return n;
      });
      // Scroll to first error
      setTimeout(() => {
        const firstErrId = Object.keys(newErrors)[0];
        if (firstErrId && questionRefs.current[firstErrId]) {
          questionRefs.current[firstErrId]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
      toast.error("Please fix validation errors before submitting");
      return;
    }

    setSubmitting(true);
    saveAnswers();
    let newStatus: Audit["status"] = "Submitted";
    if (role === "auditor") {
      newStatus = "Submitted";
    } else if (role === "reviewer") {
      newStatus = "PendingApproval";
    } else if (role === "manager" || role === "admin") {
      newStatus = "Completed";
    }
    auditStore.update(audit.id, { status: newStatus, lastSavedAt: Date.now() });
    setAudit(auditStore.getById(audit.id));
    setSubmitting(false);
    const statusLabel =
      newStatus === "Submitted"
        ? "Audit submitted for review"
        : newStatus === "PendingApproval"
          ? "Submitted for manager approval"
          : "Audit approved and completed";
    toast.success(statusLabel);
  };

  const handleApprove = () => {
    if (!audit) return;
    auditStore.update(audit.id, {
      status: "Completed",
      lastSavedAt: Date.now(),
    });
    setAudit(auditStore.getById(audit.id));
    toast.success("Audit approved and marked Completed");
  };

  const handleReject = () => {
    if (!audit || !sendBackComment.trim()) return;
    auditStore.update(audit.id, {
      status: "ReturnedForCorrection",
      rejectionNote: sendBackComment,
      reviewComment: sendBackComment,
      lastSavedAt: Date.now(),
    });
    setAudit(auditStore.getById(audit.id));
    setShowSendBackDialog(false);
    setSendBackComment("");
    toast.success("Report returned to reviewer for correction");
  };

  const handleExportExcel = () => {
    if (!audit || !site || !client || !template) return;
    const allQuestions = templateQuestionStore
      .getByTemplate(template.id)
      .sort((a, b) => a.order - b.order);
    try {
      exportAuditToExcel(audit, site, client, sections, allQuestions);
      toast.success("Excel report downloaded");
    } catch {
      toast.error("Failed to generate Excel report");
    }
  };

  const handleExportWord = async () => {
    if (!audit || !site || !client || !template) return;
    setIsExportingWord(true);
    const allQuestions = templateQuestionStore
      .getByTemplate(template.id)
      .sort((a, b) => a.order - b.order);
    try {
      await exportAuditToWord(audit, site, client, sections, allQuestions);
      toast.success("Word report downloaded");
    } catch {
      toast.error("Failed to generate Word report");
    } finally {
      setIsExportingWord(false);
    }
  };

  const isReadOnly =
    role === "admin"
      ? false
      : role === "auditor"
        ? !!audit && audit.status !== "Draft"
        : role === "reviewer"
          ? !!audit &&
            !["Draft", "Submitted", "ReturnedForCorrection"].includes(
              audit.status,
            )
          : role === "manager"
            ? !!audit && audit.status === "Completed"
            : false;

  const canEdit = !isReadOnly;
  const canAudit = role === "auditor" && canEdit;

  const canApprove =
    (role === "manager" || role === "admin") &&
    !!audit &&
    audit.status === "PendingApproval";
  const canExport =
    !!audit &&
    [
      "Submitted",
      "PendingApproval",
      "ReturnedForCorrection",
      "Completed",
    ].includes(audit.status) &&
    ["admin", "manager", "reviewer"].includes(role);

  if (!site) {
    return (
      <div className="flex min-h-screen bg-[#111c18]">
        <Sidebar
          session={session}
          currentPage="task-list"
          onNavigate={onNavigate}
        />
        <div className="flex-1 flex items-center justify-center">
          <MobileNav
            session={session}
            currentPage="task-list"
            onNavigate={onNavigate}
          />
          <p className="text-gray-400">Site not found.</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex min-h-screen bg-[#111c18]">
        <Sidebar
          session={session}
          currentPage="task-list"
          onNavigate={onNavigate}
        />
        <div className="flex-1 flex flex-col">
          <header className="bg-[#0d1912] border-b border-[#1e2e26] px-6 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate({ name: "task-list" })}
              className="text-gray-400 hover:text-white gap-1 -ml-2 mb-1"
            >
              <ArrowLeft className="h-4 w-4" /> Task List
            </Button>
            <h1 className="text-white font-bold">
              {site.branchName || site.siteName}
            </h1>
          </header>
          <div className="flex-1 flex items-center justify-center flex-col gap-3">
            <ClipboardList className="h-12 w-12 text-gray-700" />
            <p className="text-gray-400 text-center">
              No questionnaire template assigned to this site.
            </p>
            <p className="text-gray-600 text-sm text-center">
              Please assign a template in the site settings (Clients &amp;
              Sites).
            </p>
            {(role === "admin" || role === "manager") && (
              <Button
                size="sm"
                className="mt-2 bg-[#4a7c59] hover:bg-[#3d6849] text-white"
                onClick={() =>
                  onNavigate({
                    name: "sites",
                    clientId: site.clientId,
                    clientName: client?.name ?? "",
                  })
                }
              >
                Go to Site Settings
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const statusCfg = audit ? STATUS_CONFIG[audit.status] : null;

  return (
    <div className="flex min-h-screen bg-[#111c18]">
      <Sidebar
        session={session}
        currentPage="task-list"
        onNavigate={onNavigate}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-[#0d1912] border-b border-[#1e2e26] px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              data-ocid="questionnaire.link"
              variant="ghost"
              size="sm"
              onClick={() => onNavigate({ name: "task-list" })}
              className="text-gray-400 hover:text-white gap-1 -ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-white font-bold">
                  {site.branchName || site.siteName}
                </h1>
                {statusCfg && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${statusCfg.cls}`}
                  >
                    {statusCfg.label}
                  </Badge>
                )}
                {saving && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {client?.name} &middot; {site.branchCode || site.siteCode}{" "}
                &middot; {template.name}
              </p>
            </div>
          </div>
          {(audit?.rejectionNote || audit?.reviewComment) &&
            audit.status === "ReturnedForCorrection" && (
              <div className="mt-2 bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-300">
                  <strong>Manager rejection note:</strong>{" "}
                  {audit.rejectionNote || audit.reviewComment}
                </p>
              </div>
            )}
        </header>

        <main className="flex-1 overflow-auto px-4 py-5 pb-32 md:pb-24">
          {/* Expand/Collapse all */}
          <div className="flex justify-end mb-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setExpandedSections(new Set(sections.map((s) => s.id)))
              }
              className="text-xs text-[#8aad3a] hover:underline"
            >
              Expand All
            </button>
            <span className="text-xs text-gray-600">|</span>
            <button
              type="button"
              onClick={() => setExpandedSections(new Set())}
              className="text-xs text-gray-400 hover:underline"
            >
              Collapse All
            </button>
          </div>
          {sections.map((sec, si) => {
            const qs = questionsBySec[sec.id] ?? [];
            const isExpanded = expandedSections.has(sec.id);
            const hasError = qs.some((q) => errors[q.id]);
            const observations = getObservations(sec.id);
            const hasObsError = observations.some((o) => obsErrors.has(o.id));
            const psData = getPsData(sec.id);
            return (
              <div key={sec.id} className="mb-3">
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-5 py-3 rounded-t-lg font-semibold text-white text-base ${
                    hasError || hasObsError ? "bg-red-700" : "bg-[#6b7c3a]"
                  }`}
                  onClick={() =>
                    setExpandedSections((prev) => {
                      const n = new Set(prev);
                      if (n.has(sec.id)) n.delete(sec.id);
                      else n.add(sec.id);
                      return n;
                    })
                  }
                >
                  <span>
                    {si + 1}. {sec.name}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="bg-[#1a2420] border border-[#1e2e26] border-t-0 rounded-b-lg px-4 py-4 space-y-4">
                    {/* Questions — each card is memoized */}
                    {qs.map((q, qi) => {
                      const ans = answers[q.id] ?? emptyAnswer();
                      const qErr = errors[q.id] ?? {};
                      return (
                        <QuestionCard
                          key={q.id}
                          q={q}
                          ans={ans}
                          qErr={qErr}
                          canEdit={canEdit}
                          qi={qi}
                          questionRefs={questionRefs}
                          onUpdateAnswer={updateAnswer}
                          onFileUpload={handleFileUpload}
                          onRemoveImage={removeImage}
                        />
                      );
                    })}

                    {/* ── Power Supply Details Panel ── */}
                    <PowerSupplyPanel
                      data={psData}
                      canEdit={canEdit}
                      onChange={(next) => updatePsData(sec.id, next)}
                    />

                    {/* ── Critical Observations & Recommendations Panel ── */}
                    <div className="rounded-lg border border-gray-300 bg-white mt-4 overflow-hidden">
                      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-gray-500 shrink-0" />
                        <span className="text-sm font-semibold text-gray-700">
                          Critical Observations &amp; Recommendations
                        </span>
                        <span className="ml-auto text-xs text-gray-400 shrink-0">
                          {observations.length} observation
                          {observations.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="px-4 py-3">
                        {observations.length === 0 && (
                          <p
                            data-ocid={`obs.${sec.id}.empty_state`}
                            className="text-sm text-gray-400 text-center py-4"
                          >
                            No observations added yet.
                            {canEdit && ' Click "Add Observation" to begin.'}
                          </p>
                        )}

                        {observations.length > 0 && (
                          <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
                            Critical Observation
                          </p>
                        )}

                        <div className="space-y-4">
                          {observations.map((obs, oi) => (
                            <div
                              key={obs.id}
                              data-ocid={`obs.item.${oi + 1}`}
                              className={`border rounded-lg overflow-hidden ${
                                obsErrors.has(obs.id)
                                  ? "border-red-500 bg-red-50"
                                  : "border-gray-200 bg-gray-50"
                              }`}
                            >
                              <div className="bg-gray-200 px-3 py-1.5 flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-600">
                                  #{oi + 1}
                                </span>
                                {canEdit && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      title="Duplicate observation"
                                      data-ocid={`obs.item.${oi + 1}.button`}
                                      onClick={() =>
                                        duplicateObservation(sec.id, obs.id)
                                      }
                                      className="h-6 w-6 rounded flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Remove observation"
                                      data-ocid={`obs.item.${oi + 1}.delete_button`}
                                      onClick={() =>
                                        setDeleteObsTarget({
                                          secId: sec.id,
                                          obsId: obs.id,
                                        })
                                      }
                                      className="h-6 w-6 rounded-full border border-red-300 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 hover:border-red-500 transition-colors"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-3 pt-3">
                                <div>
                                  <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                                    Remarks
                                  </Label>
                                  <Input
                                    data-ocid={`obs.item.${oi + 1}.input`}
                                    value={obs.remarks}
                                    onChange={(e) =>
                                      canEdit &&
                                      updateObservationField(
                                        sec.id,
                                        obs.id,
                                        "remarks",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Describe the observation..."
                                    className="bg-white border-gray-300 text-gray-800 placeholder:text-gray-400 text-sm"
                                    disabled={!canEdit}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                                    Recommendations
                                  </Label>
                                  <Input
                                    value={obs.recommendations}
                                    onChange={(e) =>
                                      canEdit &&
                                      updateObservationField(
                                        sec.id,
                                        obs.id,
                                        "recommendations",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Recommended action..."
                                    className="bg-white border-gray-300 text-gray-800 placeholder:text-gray-400 text-sm"
                                    disabled={!canEdit}
                                  />
                                </div>
                              </div>

                              <div className="px-3 pb-3 pt-2">
                                <Label
                                  className={`text-xs font-medium mb-1.5 block ${
                                    obsErrors.has(obs.id)
                                      ? "text-red-600"
                                      : "text-gray-600"
                                  }`}
                                >
                                  Images <span className="text-red-500">*</span>
                                  {obsErrors.has(obs.id) && (
                                    <span className="text-red-500 ml-1">
                                      — at least 1 image required
                                    </span>
                                  )}
                                </Label>
                                <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-white">
                                  {obs.images.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                      {obs.images.map((src, ii) => (
                                        <div
                                          key={`obsimg_${obs.id}_${ii}`}
                                          className="relative group"
                                        >
                                          <img
                                            loading="lazy"
                                            src={getFileUrl(src)}
                                            alt={`Obs img ${ii + 1}`}
                                            className="h-16 w-16 object-cover rounded border border-gray-200"
                                          />
                                          {canEdit && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                removeObsImage(
                                                  sec.id,
                                                  obs.id,
                                                  ii,
                                                )
                                              }
                                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                              <X className="h-2.5 w-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {canEdit ? (
                                    <label className="cursor-pointer">
                                      <div
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors ${
                                          obsErrors.has(obs.id)
                                            ? "bg-red-50 border-red-400 text-red-600 hover:bg-red-100"
                                            : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                                        }`}
                                      >
                                        <ImageIcon className="h-3.5 w-3.5" />{" "}
                                        Upload Image
                                      </div>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) =>
                                          handleObsImageUpload(
                                            sec.id,
                                            obs.id,
                                            e.target.files,
                                          )
                                        }
                                      />
                                    </label>
                                  ) : (
                                    obs.images.length === 0 && (
                                      <p className="text-xs text-gray-400">
                                        No images uploaded.
                                      </p>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            data-ocid={`obs.${sec.id}.button`}
                            onClick={() => addObservation(sec.id)}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                          >
                            <PlusCircle className="h-4 w-4" /> Add Observation
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Photographs Section ── */}
          <div className="mb-3 rounded-lg overflow-hidden border border-[#1e2e26]">
            <button
              type="button"
              onClick={() => setPhotosExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#6b7c3a] hover:bg-[#5a6b30] text-white font-semibold text-sm transition-colors"
              data-ocid="questionnaire.photos_panel"
            >
              <span>{sections.length + 1}. Photographs</span>
              <svg
                aria-label="Toggle photographs section"
                role="img"
                className={`h-4 w-4 transition-transform ${
                  photosExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {photosExpanded && (
              <div className="bg-[#0f1f17] p-4 space-y-6">
                {(() => {
                  const grouped = sections
                    .map((sec) => {
                      const qs = questionsBySec[sec.id] ?? [];
                      const photos: {
                        src: string;
                        caption: string;
                        qLabel: string;
                      }[] = [];
                      for (const q of qs) {
                        const imgs = answers[q.id]?.images ?? [];
                        for (const src of imgs) {
                          photos.push({
                            src,
                            caption:
                              answers[q.id]?.remarks || "No remarks available",
                            qLabel: q.label,
                          });
                        }
                      }
                      return { sec, photos };
                    })
                    .filter((g) => g.photos.length > 0);

                  if (grouped.length === 0) {
                    return (
                      <p className="text-center text-gray-400 py-8 text-sm">
                        No photographs uploaded yet.
                      </p>
                    );
                  }

                  return grouped.map(({ sec, photos }) => (
                    <div key={sec.id}>
                      <h4 className="text-[#a3b865] font-bold text-sm mb-3 border-b border-[#2a3a2a] pb-1">
                        {sec.name}
                      </h4>
                      <div className="flex flex-wrap gap-4">
                        {photos.map((ph, idx) => (
                          <div
                            key={`${ph.src}-${idx}`}
                            className="border border-[#2a3a2a] rounded-lg overflow-hidden bg-[#0d1912] w-44 flex-shrink-0"
                          >
                            <img
                              loading="lazy"
                              src={getFileUrl(ph.src)}
                              alt={ph.caption}
                              className="w-full h-36 object-cover"
                            />
                            <div className="p-2">
                              <p
                                className="text-xs text-gray-300 font-medium truncate"
                                title={ph.qLabel}
                              >
                                {ph.qLabel}
                              </p>
                              <p
                                className="text-xs text-gray-500 mt-0.5 line-clamp-2"
                                title={ph.caption}
                              >
                                {ph.caption}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </main>

        {/* Fixed footer — thumb-friendly on iOS/Android */}
        <div
          className="fixed bottom-0 left-0 md:left-56 right-0 bg-[#0d1912] border-t border-[#1e2e26] px-3 md:px-6 flex items-center gap-2"
          style={{
            paddingTop: "10px",
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
          }}
        >
          {canEdit && (
            <Button
              data-ocid="questionnaire.save_button"
              onClick={handleManualSave}
              className="bg-[#2a3d33] hover:bg-[#3a4f44] text-gray-200 border border-[#3a4f44] gap-1.5 min-h-[48px] md:min-h-[36px] text-base md:text-sm px-4 md:px-3"
            >
              <Save className="h-4 w-4" /> Update Report
            </Button>
          )}
          <div className="flex-1" />
          {canAudit && (
            <Button
              data-ocid="questionnaire.submit_button"
              onClick={validateAndSubmit}
              disabled={submitting}
              className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5 min-h-[48px] md:min-h-[36px] text-base md:text-sm px-5 md:px-4"
            >
              <CheckCircle2 className="h-4 w-4" /> Submit
            </Button>
          )}
          {role === "reviewer" &&
            canEdit &&
            audit &&
            ["Draft", "Submitted", "ReturnedForCorrection"].includes(
              audit.status,
            ) && (
              <Button
                data-ocid="questionnaire.submit_button"
                onClick={validateAndSubmit}
                className="bg-purple-700 hover:bg-purple-800 text-white gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> {"Submit for Approval"}
              </Button>
            )}
          {(role === "manager" || role === "admin") &&
            canEdit &&
            audit &&
            (role === "admin" ||
              !["PendingApproval", "Completed"].includes(audit.status)) && (
              <Button
                data-ocid="questionnaire.submit_button"
                onClick={validateAndSubmit}
                className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Submit &amp; Complete
              </Button>
            )}
          {canApprove && (
            <div className="flex gap-2">
              <Button
                data-ocid="questionnaire.secondary_button"
                onClick={() => setShowSendBackDialog(true)}
                variant="outline"
                className="border-rose-700 text-rose-300 hover:bg-rose-900/20"
              >
                Reject
              </Button>
              <Button
                data-ocid="questionnaire.confirm_button"
                onClick={handleApprove}
                className="bg-green-700 hover:bg-green-800 text-white gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve &amp; Complete
              </Button>
            </div>
          )}
          {canExport && (
            <div className="flex gap-2 ml-2">
              <Button
                data-ocid="questionnaire.secondary_button"
                onClick={handleExportExcel}
                variant="outline"
                size="sm"
                className="border-[#3a4f44] text-gray-300 hover:bg-[#2a3d33] gap-1.5"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button
                data-ocid="questionnaire.secondary_button"
                onClick={handleExportWord}
                disabled={isExportingWord}
                variant="outline"
                size="sm"
                className="border-[#3a4f44] text-gray-300 hover:bg-[#2a3d33] gap-1.5"
              >
                {isExportingWord ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Word
              </Button>
            </div>
          )}
          {isReadOnly && (
            <Badge
              variant="outline"
              className="text-gray-400 border-gray-700 text-xs"
            >
              Read Only
            </Badge>
          )}
        </div>
      </div>

      <Dialog open={showSendBackDialog} onOpenChange={setShowSendBackDialog}>
        <DialogContent
          data-ocid="questionnaire.dialog"
          className="bg-[#1a2420] border-[#3a4f44]"
        >
          <DialogHeader>
            <DialogTitle className="text-white">Reject Report</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-gray-300 text-sm">
              Rejection Note <span className="text-rose-400">*</span>
            </Label>
            <Textarea
              value={sendBackComment}
              onChange={(e) => setSendBackComment(e.target.value)}
              placeholder="Explain why the report is being rejected..."
              className="mt-2 bg-[#111c18] border-[#3a4f44] text-white resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              data-ocid="questionnaire.cancel_button"
              variant="outline"
              onClick={() => setShowSendBackDialog(false)}
              className="border-[#3a4f44] text-gray-300"
            >
              Cancel
            </Button>
            <Button
              data-ocid="questionnaire.confirm_button"
              onClick={handleReject}
              disabled={!sendBackComment.trim()}
              className="bg-rose-700 hover:bg-rose-800 text-white"
            >
              Reject Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleteObsTarget}
        onOpenChange={(open) => !open && setDeleteObsTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Observation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this critical observation row. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteObsTarget) {
                  removeObservation(
                    deleteObsTarget.secId,
                    deleteObsTarget.obsId,
                  );
                  setDeleteObsTarget(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
