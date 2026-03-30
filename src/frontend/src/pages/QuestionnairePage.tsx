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
  ImageIcon,
  Loader2,
  Minus,
  PlusCircle,
  Save,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { NavPage } from "../App";
import MobileNav from "../components/MobileNav";
import Sidebar from "../components/Sidebar";
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
  PendingReReview: {
    label: "Pending Re-Review",
    cls: "bg-yellow-900/40 text-yellow-300 border-yellow-700/50",
  },
  Reviewed: {
    label: "Reviewed",
    cls: "bg-purple-900/40 text-purple-300 border-purple-700/50",
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

// ── PowerSupplyPanel component ──────────────────────────────────────────────

function PowerSupplyPanel({
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
}

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
  const questionsBySec: Record<string, TemplateQuestion[]> = {};
  for (const sec of sections) {
    questionsBySec[sec.id] = templateQuestionStore
      .getBySection(sec.id)
      .filter(
        (q) => q.questionType === "radio" || q.questionType === "dropdown",
      );
  }

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
    if (auditId) return auditStore.getById(auditId);
    const existing = site
      ? auditStore
          .getBySite(site.id)
          .sort((a, b) => b.lastSavedAt - a.lastSavedAt)[0]
      : null;
    return existing ?? null;
  });

  const [answers, setAnswers] = useState<AuditAnswers>(initParsed.answers);
  const [sectionObservations, setSectionObservations] = useState<
    Record<string, SectionObservation[]>
  >(initParsed.observations);
  const [sectionPowerSupply, setSectionPowerSupply] = useState<
    Record<string, PowerSupplyData>
  >(initParsed.powerSupply);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id)),
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [photosExpanded, setPhotosExpanded] = useState(true);
  const [obsErrors, setObsErrors] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSendBackDialog, setShowSendBackDialog] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const saveAnswers = useCallback(
    (
      currentAnswers: AuditAnswers,
      currentObs: Record<string, SectionObservation[]>,
      currentPs: Record<string, PowerSupplyData>,
    ) => {
      if (!audit) return;
      setSaving(true);
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
      // Pure synchronous localStorage write — guaranteed to work with no signal
      // This is the auto-save draft key used for recovery
      localStorage.setItem(`audit_draft_${siteId}`, answersJson);
      auditStore.update(audit.id, {
        answersJson,
        lastSavedAt: Date.now(),
      });
      setTimeout(() => setSaving(false), 500);
    },
    [audit, siteId],
  );

  const getOrEmpty = (qId: string): QuestionAnswer =>
    answers[qId] ?? emptyAnswer();

  const updateAnswer = (
    qId: string,
    field: keyof QuestionAnswer,
    value: string | string[],
  ) => {
    const current = getOrEmpty(qId);
    const next: AuditAnswers = {
      ...answers,
      [qId]: { ...current, [field]: value },
    };
    setAnswers(next);
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
      () => saveAnswers(next, sectionObservations, sectionPowerSupply),
      5000,
    );
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const handleManualSave = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    saveAnswers(answers, sectionObservations, sectionPowerSupply);
    toast.success("Report saved");
  };

  const handleFileUpload = (qId: string, files: FileList | null) => {
    if (!files || !files.length) return;
    const existing = getOrEmpty(qId).images;
    const readers: Promise<string>[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      readers.push(
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        }),
      );
    }
    Promise.all(readers).then((bases) => {
      const newImages = [...existing, ...bases];
      const next: AuditAnswers = {
        ...answers,
        [qId]: { ...getOrEmpty(qId), images: newImages },
      };
      setAnswers(next);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(
        () => saveAnswers(next, sectionObservations, sectionPowerSupply),
        5000,
      );
    });
  };

  const removeImage = (qId: string, idx: number) => {
    const current = getOrEmpty(qId);
    updateAnswer(
      qId,
      "images",
      current.images.filter((_, i) => i !== idx),
    );
  };

  // ── Power Supply helpers ─────────────────────────────────────────────────

  const getPsData = (secId: string): PowerSupplyData =>
    sectionPowerSupply[secId] ?? emptyPs();

  const updatePsData = (secId: string, next: PowerSupplyData) => {
    setSectionPowerSupply((prev) => {
      const updated = { ...prev, [secId]: next };
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(
        () => saveAnswers(answers, sectionObservations, updated),
        5000,
      );
      return updated;
    });
  };

  // ── Observation helpers ──────────────────────────────────────────────────

  const getObservations = (secId: string): SectionObservation[] =>
    sectionObservations[secId] ?? [];

  const persistObs = (secId: string, next: SectionObservation[]) => {
    setSectionObservations((prev) => {
      const updated = { ...prev, [secId]: next };
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(
        () => saveAnswers(answers, updated, sectionPowerSupply),
        5000,
      );
      return updated;
    });
  };

  const addObservation = (secId: string) => {
    persistObs(secId, [
      ...getObservations(secId),
      { id: genId(), remarks: "", recommendations: "", images: [] },
    ]);
  };

  const removeObservation = (secId: string, obsId: string) => {
    persistObs(
      secId,
      getObservations(secId).filter((o) => o.id !== obsId),
    );
  };

  const duplicateObservation = (secId: string, obsId: string) => {
    const current = getObservations(secId);
    const idx = current.findIndex((o) => o.id === obsId);
    if (idx < 0) return;
    const clone: SectionObservation = { ...current[idx], id: genId() };
    persistObs(secId, [
      ...current.slice(0, idx + 1),
      clone,
      ...current.slice(idx + 1),
    ]);
  };

  const updateObservationField = (
    secId: string,
    obsId: string,
    field: "remarks" | "recommendations",
    value: string,
  ) => {
    persistObs(
      secId,
      getObservations(secId).map((o) =>
        o.id === obsId ? { ...o, [field]: value } : o,
      ),
    );
  };

  const handleObsImageUpload = (
    secId: string,
    obsId: string,
    files: FileList | null,
  ) => {
    if (!files || !files.length) return;
    const readers: Promise<string>[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      readers.push(
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        }),
      );
    }
    Promise.all(readers).then((bases) => {
      persistObs(
        secId,
        getObservations(secId).map((o) =>
          o.id === obsId ? { ...o, images: [...o.images, ...bases] } : o,
        ),
      );
      setObsErrors((prev) => {
        const n = new Set(prev);
        n.delete(obsId);
        return n;
      });
    });
  };

  const removeObsImage = (secId: string, obsId: string, imgIdx: number) => {
    persistObs(
      secId,
      getObservations(secId).map((o) =>
        o.id === obsId
          ? { ...o, images: o.images.filter((_, i) => i !== imgIdx) }
          : o,
      ),
    );
  };

  // ── Validation ───────────────────────────────────────────────────────────

  const validateAndSubmit = () => {
    if (!audit || !template) return;
    const newErrors: ValidationErrors = {};
    for (const sec of sections) {
      const qs = questionsBySec[sec.id] ?? [];
      for (const q of qs) {
        const ans = getOrEmpty(q.id);
        const qErr: { answer?: boolean; remarks?: boolean; images?: boolean } =
          {};
        if (!ans.answer || !ans.answer.trim()) qErr.answer = true;
        if (!ans.remarks || !ans.remarks.trim()) qErr.remarks = true;
        if (
          q.enableImageUpload &&
          q.imageUploadMandatory &&
          (!ans.images || ans.images.length === 0)
        )
          qErr.images = true;
        if (qErr.answer || qErr.remarks || qErr.images) newErrors[q.id] = qErr;
      }
    }

    const newObsErrors = new Set<string>();
    for (const sec of sections) {
      const obs = sectionObservations[sec.id] ?? [];
      for (const ob of obs) {
        if (ob.images.length === 0) {
          newObsErrors.add(ob.id);
          setExpandedSections((prev) => new Set([...prev, sec.id]));
        }
      }
    }
    setObsErrors(newObsErrors);

    if (Object.keys(newErrors).length > 0 || newObsErrors.size > 0) {
      setErrors(newErrors);
      for (const sec of sections) {
        if ((questionsBySec[sec.id] ?? []).some((q) => newErrors[q.id])) {
          setExpandedSections((prev) => new Set([...prev, sec.id]));
        }
      }
      const firstErrorId = Object.keys(newErrors)[0];
      setTimeout(() => {
        const el = questionRefs.current[firstErrorId];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const qCount = Object.keys(newErrors).length;
      const obsCount = newObsErrors.size;
      let msg = "";
      if (qCount > 0 && obsCount > 0)
        msg = `${qCount} question${qCount > 1 ? "s" : ""} and ${obsCount} critical observation${obsCount > 1 ? "s" : ""} need attention`;
      else if (qCount > 0)
        msg = `${qCount} question${qCount > 1 ? "s" : ""} need attention — check highlighted fields`;
      else
        msg = `${obsCount} critical observation${obsCount > 1 ? "s" : ""} require at least one image`;
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    saveAnswers(answers, sectionObservations, sectionPowerSupply);
    let newStatus: Audit["status"] = "Submitted";
    if (role === "reviewer") newStatus = "Reviewed";
    auditStore.update(audit.id, { status: newStatus, lastSavedAt: Date.now() });
    setAudit(auditStore.getById(audit.id));
    setSubmitting(false);
    toast.success(
      role === "reviewer"
        ? "Submitted for manager review"
        : "Audit submitted for review",
    );
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

  const handleSendBack = () => {
    if (!audit) return;
    auditStore.update(audit.id, {
      status: "PendingReReview",
      reviewComment: sendBackComment,
      lastSavedAt: Date.now(),
    });
    setAudit(auditStore.getById(audit.id));
    setShowSendBackDialog(false);
    setSendBackComment("");
    toast.success("Sent back for re-review");
  };

  const isReadOnly =
    (role === "auditor" &&
      !!audit &&
      audit.status !== "Draft" &&
      audit.status !== "PendingReReview") ||
    (role === "reviewer" && !!audit && audit.status === "Completed") ||
    (audit?.status === "Completed" && role !== "admin" && role !== "manager");

  const canEdit = !isReadOnly;
  const canAudit = role === "auditor" && canEdit;
  const canReview =
    (role === "reviewer" || role === "manager" || role === "admin") &&
    !!audit &&
    (audit.status === "Submitted" ||
      audit.status === "PendingReReview" ||
      audit.status === "Reviewed");
  const canApprove =
    (role === "manager" || role === "admin") &&
    !!audit &&
    audit.status === "Reviewed";

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
          {audit?.reviewComment && audit.status === "PendingReReview" && (
            <div className="mt-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2">
              <p className="text-xs text-yellow-300">
                <strong>Reviewer comment:</strong> {audit.reviewComment}
              </p>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-auto px-4 py-5 pb-32 md:pb-24">
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
                    {/* Questions */}
                    {qs.map((q, qi) => {
                      const qErr = errors[q.id] ?? {};
                      const hasQErr =
                        qErr.answer || qErr.remarks || qErr.images;
                      const ans = getOrEmpty(q.id);
                      return (
                        <div
                          key={q.id}
                          ref={(el) => {
                            questionRefs.current[q.id] = el;
                          }}
                          data-ocid={`questionnaire.item.${qi + 1}`}
                          className={`rounded-lg border p-4 space-y-4 transition-colors ${hasQErr ? "border-red-600 bg-red-900/10" : "border-[#2a3d33] bg-[#151f1a]"}`}
                        >
                          <p className="text-sm font-semibold text-white">
                            <span className="text-[#8aad3a] mr-2">
                              Q{qi + 1}.
                            </span>
                            {q.label}
                          </p>

                          <div>
                            <p className="text-xs text-gray-400 mb-2">
                              Answer
                              {qErr.answer && (
                                <span className="text-red-400 ml-1">
                                  * Required
                                </span>
                              )}
                            </p>
                            {q.questionType === "radio" && (
                              <RadioGroup
                                value={ans.answer}
                                onValueChange={(v) =>
                                  canEdit && updateAnswer(q.id, "answer", v)
                                }
                                className="flex flex-wrap gap-4"
                                disabled={!canEdit}
                              >
                                {q.options.map((opt) => (
                                  <div
                                    key={opt}
                                    className="flex items-center gap-2"
                                  >
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
                                onValueChange={(v) =>
                                  canEdit && updateAnswer(q.id, "answer", v)
                                }
                                disabled={!canEdit}
                              >
                                <SelectTrigger
                                  className={`bg-[#111c18] border-[#3a4f44] text-white max-w-sm ${qErr.answer ? "border-red-600" : ""}`}
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
                                <span className="text-red-400 ml-1">
                                  — required
                                </span>
                              )}
                            </p>
                            <Textarea
                              data-ocid="questionnaire.textarea"
                              value={ans.remarks}
                              onChange={(e) =>
                                canEdit &&
                                updateAnswer(q.id, "remarks", e.target.value)
                              }
                              placeholder="Enter your remarks here..."
                              className={`bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-600 resize-none min-h-[80px] ${qErr.remarks ? "border-red-600 focus-visible:ring-red-600" : ""}`}
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
                                  <span className="text-gray-600 ml-1">
                                    (optional)
                                  </span>
                                )}
                                {qErr.images && (
                                  <span className="text-red-400 ml-1">
                                    — at least 1 image required
                                  </span>
                                )}
                              </p>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {ans.images.map((src, i) => (
                                  <div
                                    key={`img_${q.id}_${i}`}
                                    className="relative group"
                                  >
                                    <img
                                      src={src}
                                      alt={`Upload ${i + 1}`}
                                      className="h-20 w-20 object-cover rounded border border-[#3a4f44]"
                                    />
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => removeImage(q.id, i)}
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
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-300 transition-colors border ${qErr.images ? "bg-red-900/20 border-red-600 hover:bg-red-900/30" : "bg-[#2a3d33] hover:bg-[#3a4f44] border-[#3a4f44]"}`}
                                  >
                                    <ImageIcon className="h-4 w-4" /> Upload
                                    Images
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) =>
                                      handleFileUpload(q.id, e.target.files)
                                    }
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>
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
                                        removeObservation(sec.id, obs.id)
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
                                            src={src}
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
                                            ? "border-red-400 text-red-600 bg-red-50 hover:bg-red-100"
                                            : "border-gray-300 text-gray-600 bg-gray-50 hover:bg-gray-100"
                                        }`}
                                      >
                                        <ImageIcon className="h-3.5 w-3.5" />{" "}
                                        Upload Images
                                      </div>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        data-ocid={`obs.item.${oi + 1}.upload_button`}
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
                                        No images
                                      </p>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {canEdit && (
                          <div className="flex justify-end mt-3">
                            <Button
                              type="button"
                              size="sm"
                              data-ocid={`obs.${sec.id}.primary_button`}
                              onClick={() => addObservation(sec.id)}
                              className="bg-[#2a3d33] hover:bg-[#3a4f44] text-white text-xs gap-1.5"
                            >
                              <PlusCircle className="h-3.5 w-3.5" /> Add
                              Observation
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* ── end observations panel ── */}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Photographs Section ── */}
          <div className="rounded-lg overflow-hidden border border-[#2a3a2a] shadow-sm">
            <button
              type="button"
              onClick={() => setPhotosExpanded((p) => !p)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#6b7c3a] hover:bg-[#5a6b30] text-white font-semibold text-sm transition-colors"
              data-ocid="questionnaire.photos_panel"
            >
              <span>{sections.length + 1}. Photographs</span>
              <svg
                aria-label="Toggle photographs section"
                role="img"
                className={`h-4 w-4 transition-transform ${photosExpanded ? "rotate-180" : ""}`}
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
                              src={ph.src}
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

        {/* Fixed bottom bar */}
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
          {canReview &&
            role === "reviewer" &&
            audit?.status === "Submitted" && (
              <Button
                data-ocid="questionnaire.submit_button"
                onClick={validateAndSubmit}
                className="bg-purple-700 hover:bg-purple-800 text-white gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Submit for Review
              </Button>
            )}
          {canApprove && (
            <div className="flex gap-2">
              <Button
                data-ocid="questionnaire.secondary_button"
                onClick={() => setShowSendBackDialog(true)}
                variant="outline"
                className="border-yellow-700 text-yellow-300 hover:bg-yellow-900/20"
              >
                Send Back
              </Button>
              <Button
                data-ocid="questionnaire.confirm_button"
                onClick={handleApprove}
                className="bg-green-700 hover:bg-green-800 text-white gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
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
            <DialogTitle className="text-white">
              Send Back for Re-Review
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-gray-300 text-sm">Comment (optional)</Label>
            <Textarea
              value={sendBackComment}
              onChange={(e) => setSendBackComment(e.target.value)}
              placeholder="Explain what needs to be fixed..."
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
              onClick={handleSendBack}
              className="bg-yellow-700 hover:bg-yellow-800 text-white"
            >
              Send Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
