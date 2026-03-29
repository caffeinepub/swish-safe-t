import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ImageIcon,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { NavPage } from "../App";
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

function emptyAnswer(): QuestionAnswer {
  return { answer: "", remarks: "", images: [] };
}

function parseAnswers(json: string): AuditAnswers {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) {
      // Migrate old flat format: { [qId]: string | string[] }
      const result: AuditAnswers = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "object" && v !== null && "answer" in v) {
          result[k] = v as QuestionAnswer;
        } else if (typeof v === "string") {
          result[k] = { answer: v, remarks: "", images: [] };
        } else if (Array.isArray(v)) {
          result[k] = { answer: "", remarks: "", images: v as string[] };
        }
      }
      return result;
    }
  } catch {
    /* noop */
  }
  return {};
}

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

  const [audit, setAudit] = useState<Audit | null>(() => {
    if (auditId) return auditStore.getById(auditId);
    const existing = site
      ? auditStore
          .getBySite(site.id)
          .sort((a, b) => b.lastSavedAt - a.lastSavedAt)[0]
      : null;
    return existing ?? null;
  });

  const [answers, setAnswers] = useState<AuditAnswers>(() => {
    const src = auditId
      ? auditStore.getById(auditId)
      : site
        ? auditStore
            .getBySite(site.id)
            .sort((a, b) => b.lastSavedAt - a.lastSavedAt)[0]
        : null;
    if (!src) return {};
    return parseAnswers(src.answersJson);
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id)),
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSendBackDialog, setShowSendBackDialog] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Ensure audit exists
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
    (currentAnswers: AuditAnswers) => {
      if (!audit) return;
      setSaving(true);
      auditStore.update(audit.id, {
        answersJson: JSON.stringify(currentAnswers),
        lastSavedAt: Date.now(),
      });
      setTimeout(() => setSaving(false), 500);
    },
    [audit],
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
        if (!updated.answer && !updated.remarks && !updated.images) {
          delete n[qId];
        } else {
          n[qId] = updated;
        }
      }
      return n;
    });
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => saveAnswers(next), 5000);
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const handleManualSave = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    saveAnswers(answers);
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
      autoSaveTimerRef.current = setTimeout(() => saveAnswers(next), 5000);
    });
  };

  const removeImage = (qId: string, idx: number) => {
    const current = getOrEmpty(qId);
    const newImages = current.images.filter((_, i) => i !== idx);
    updateAnswer(qId, "images", newImages);
  };

  const validateAndSubmit = () => {
    if (!audit || !template) return;
    const newErrors: ValidationErrors = {};
    for (const sec of sections) {
      const qs = questionsBySec[sec.id] ?? [];
      for (const q of qs) {
        const ans = getOrEmpty(q.id);
        const qErr: { answer?: boolean; remarks?: boolean; images?: boolean } =
          {};

        // Check answer
        if (!ans.answer || !ans.answer.trim()) {
          qErr.answer = true;
        }
        // Check remarks — always required
        if (!ans.remarks || !ans.remarks.trim()) {
          qErr.remarks = true;
        }
        // Check images — only if imageUploadMandatory
        if (
          q.enableImageUpload &&
          q.imageUploadMandatory &&
          (!ans.images || ans.images.length === 0)
        ) {
          qErr.images = true;
        }

        if (qErr.answer || qErr.remarks || qErr.images) {
          newErrors[q.id] = qErr;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Expand sections with errors
      for (const sec of sections) {
        const qs = questionsBySec[sec.id] ?? [];
        if (qs.some((q) => newErrors[q.id])) {
          setExpandedSections((prev) => new Set([...prev, sec.id]));
        }
      }
      // Scroll to first error
      const firstErrorId = Object.keys(newErrors)[0];
      setTimeout(() => {
        const el = questionRefs.current[firstErrorId];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const errorCount = Object.keys(newErrors).length;
      toast.error(
        `${errorCount} question${errorCount > 1 ? "s" : ""} need attention — check highlighted fields`,
      );
      return;
    }

    setSubmitting(true);
    saveAnswers(answers);
    let newStatus: Audit["status"] = "Submitted";
    if (role === "reviewer") newStatus = "Reviewed";
    auditStore.update(audit.id, { status: newStatus, lastSavedAt: Date.now() });
    const updated = auditStore.getById(audit.id);
    setAudit(updated);
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

        <main className="flex-1 overflow-auto px-4 py-5 pb-24">
          {sections.map((sec, si) => {
            const qs = questionsBySec[sec.id] ?? [];
            const isExpanded = expandedSections.has(sec.id);
            const hasError = qs.some((q) => errors[q.id]);
            return (
              <div key={sec.id} className="mb-3">
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-5 py-3 rounded-t-lg font-semibold text-white text-base ${
                    hasError ? "bg-red-700" : "bg-[#6b7c3a]"
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
                          className={`rounded-lg border p-4 space-y-4 transition-colors ${
                            hasQErr
                              ? "border-red-600 bg-red-900/10"
                              : "border-[#2a3d33] bg-[#151f1a]"
                          }`}
                        >
                          {/* Question number + label */}
                          <p className="text-sm font-semibold text-white">
                            <span className="text-[#8aad3a] mr-2">
                              Q{qi + 1}.
                            </span>
                            {q.label}
                          </p>

                          {/* 1. Answer input */}
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

                          {/* 2. Remarks — always mandatory */}
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
                              className={`bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-600 resize-none min-h-[80px] ${
                                qErr.remarks
                                  ? "border-red-600 focus-visible:ring-red-600"
                                  : ""
                              }`}
                              disabled={!canEdit}
                            />
                          </div>

                          {/* 3. Image Upload — only if template enables it */}
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
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-300 transition-colors border ${
                                      qErr.images
                                        ? "bg-red-900/20 border-red-600 hover:bg-red-900/30"
                                        : "bg-[#2a3d33] hover:bg-[#3a4f44] border-[#3a4f44]"
                                    }`}
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
                  </div>
                )}
              </div>
            );
          })}
        </main>

        {/* Fixed bottom bar */}
        <div className="fixed bottom-0 left-56 right-0 bg-[#0d1912] border-t border-[#1e2e26] px-6 py-3 flex items-center">
          {canEdit && (
            <Button
              data-ocid="questionnaire.save_button"
              onClick={handleManualSave}
              className="bg-[#2a3d33] hover:bg-[#3a4f44] text-gray-200 border border-[#3a4f44] gap-1.5"
            >
              <Save className="h-4 w-4" /> Update Report
            </Button>
          )}
          <div className="flex-1" />
          {/* Auditor submit */}
          {canAudit && (
            <Button
              data-ocid="questionnaire.submit_button"
              onClick={validateAndSubmit}
              disabled={submitting}
              className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Submit
            </Button>
          )}
          {/* Reviewer submit */}
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
          {/* Manager/Admin approve+send back */}
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

      {/* Send back dialog */}
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
