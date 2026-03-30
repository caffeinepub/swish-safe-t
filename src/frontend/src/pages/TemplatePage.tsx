import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { NavPage } from "../App";
import MobileNav from "../components/MobileNav";
import Sidebar from "../components/Sidebar";
import {
  type QuestionTemplate,
  type TemplateQuestion,
  type TemplateSection,
  templateQuestionStore,
  templateSectionStore,
  templateStore,
} from "../lib/dataStore";
import type { Session } from "../lib/session";

interface Props {
  session: Session;
  onNavigate: (page: NavPage) => void;
}

type QType = "radio" | "dropdown";

interface DraftQuestion {
  localId: string;
  label: string;
  questionType: QType;
  options: string[];
  enableImageUpload: boolean;
  imageUploadMandatory: boolean;
  order: number;
}

interface DraftSection {
  localId: string;
  name: string;
  order: number;
  questions: DraftQuestion[];
}

function emptyDraftQuestion(order: number): DraftQuestion {
  return {
    localId: `dq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: "",
    questionType: "dropdown",
    options: [""],
    enableImageUpload: false,
    imageUploadMandatory: false,
    order,
  };
}

function emptyDraftSection(order: number): DraftSection {
  return {
    localId: `ds_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    order,
    questions: [emptyDraftQuestion(0)],
  };
}

export default function TemplatePage({ session, onNavigate }: Props) {
  const [templates, setTemplates] = useState<QuestionTemplate[]>(() =>
    templateStore.getAll(),
  );
  const [showBuilder, setShowBuilder] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [tName, setTName] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [sections, setSections] = useState<DraftSection[]>([
    emptyDraftSection(0),
  ]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [saving, setSaving] = useState(false);

  const reload = () => setTemplates(templateStore.getAll());

  const openNew = () => {
    setEditTemplateId(null);
    setTName("");
    setTDesc("");
    const s = emptyDraftSection(0);
    setSections([s]);
    setExpandedSections(new Set([s.localId]));
    setShowBuilder(true);
  };

  const openEdit = (t: QuestionTemplate) => {
    setEditTemplateId(t.id);
    setTName(t.name);
    setTDesc(t.description);
    const secs = templateSectionStore.getByTemplate(t.id);
    const draft: DraftSection[] = secs.map((sec) => {
      const qs = templateQuestionStore.getBySection(sec.id);
      return {
        localId: sec.id,
        name: sec.name,
        order: sec.order,
        questions: qs
          .filter(
            (q) => q.questionType === "radio" || q.questionType === "dropdown",
          )
          .map((q) => ({
            localId: q.id,
            label: q.label,
            questionType: q.questionType as QType,
            options: q.options.length ? q.options : [""],
            enableImageUpload: q.enableImageUpload ?? q.isMandatoryPhoto,
            imageUploadMandatory: q.imageUploadMandatory ?? q.isMandatoryPhoto,
            order: q.order,
          })),
      };
    });
    // Ensure each section has at least one question
    const draftWithQ = draft.map((s) =>
      s.questions.length > 0 ? s : { ...s, questions: [emptyDraftQuestion(0)] },
    );
    setSections(draftWithQ.length ? draftWithQ : [emptyDraftSection(0)]);
    setExpandedSections(new Set(draftWithQ.map((s) => s.localId)));
    setShowBuilder(true);
  };

  const handleSave = () => {
    if (!tName.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (sections.some((s) => !s.name.trim())) {
      toast.error("All sections must have a name");
      return;
    }
    if (sections.some((s) => s.questions.some((q) => !q.label.trim()))) {
      toast.error("All questions must have a label");
      return;
    }
    setSaving(true);
    try {
      let templateId: string;
      if (editTemplateId) {
        templateStore.update(editTemplateId, {
          name: tName.trim(),
          description: tDesc.trim(),
        });
        templateSectionStore.deleteByTemplate(editTemplateId);
        templateQuestionStore.deleteByTemplate(editTemplateId);
        templateId = editTemplateId;
      } else {
        const tmpl = templateStore.add({
          name: tName.trim(),
          description: tDesc.trim(),
          createdBy: session.userId,
          createdAt: Date.now(),
          isEnabled: true,
        });
        templateId = tmpl.id;
      }
      for (const [si, sec] of sections.entries()) {
        const newSec = templateSectionStore.add({
          templateId,
          name: sec.name.trim(),
          order: si,
        });
        for (const [qi, q] of sec.questions.entries()) {
          templateQuestionStore.add({
            templateId,
            sectionId: newSec.id,
            label: q.label.trim(),
            questionType: q.questionType,
            options: q.options.filter((o) => o.trim()),
            isMandatoryPhoto: false,
            enableImageUpload: q.enableImageUpload,
            imageUploadMandatory: q.enableImageUpload
              ? q.imageUploadMandatory
              : false,
            order: qi,
            isEnabled: true,
          });
        }
      }
      toast.success(editTemplateId ? "Template updated" : "Template created");
      setShowBuilder(false);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = (id: string) => {
    templateStore.delete(id);
    templateSectionStore.deleteByTemplate(id);
    templateQuestionStore.deleteByTemplate(id);
    toast.success("Template deleted");
    reload();
  };

  const updateSection = (localId: string, updates: Partial<DraftSection>) =>
    setSections((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, ...updates } : s)),
    );

  const addSection = () => {
    const s = emptyDraftSection(sections.length);
    setSections((prev) => [...prev, s]);
    setExpandedSections((prev) => new Set([...prev, s.localId]));
  };

  const removeSection = (localId: string) =>
    setSections((prev) => prev.filter((s) => s.localId !== localId));

  const toggleSection = (localId: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });

  const addQuestion = (secLocalId: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.localId === secLocalId
          ? {
              ...s,
              questions: [
                ...s.questions,
                emptyDraftQuestion(s.questions.length),
              ],
            }
          : s,
      ),
    );

  const removeQuestion = (secLocalId: string, qLocalId: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.localId === secLocalId
          ? {
              ...s,
              questions: s.questions.filter((q) => q.localId !== qLocalId),
            }
          : s,
      ),
    );

  const updateQuestion = (
    secLocalId: string,
    qLocalId: string,
    updates: Partial<DraftQuestion>,
  ) =>
    setSections((prev) =>
      prev.map((s) =>
        s.localId === secLocalId
          ? {
              ...s,
              questions: s.questions.map((q) =>
                q.localId === qLocalId ? { ...q, ...updates } : q,
              ),
            }
          : s,
      ),
    );

  const updateOption = (
    secLocalId: string,
    qLocalId: string,
    idx: number,
    val: string,
  ) =>
    setSections((prev) =>
      prev.map((s) =>
        s.localId === secLocalId
          ? {
              ...s,
              questions: s.questions.map((q) =>
                q.localId === qLocalId
                  ? {
                      ...q,
                      options: q.options.map((o, i) => (i === idx ? val : o)),
                    }
                  : q,
              ),
            }
          : s,
      ),
    );

  const addOption = (secLocalId: string, qLocalId: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.localId === secLocalId
          ? {
              ...s,
              questions: s.questions.map((q) =>
                q.localId === qLocalId
                  ? { ...q, options: [...q.options, ""] }
                  : q,
              ),
            }
          : s,
      ),
    );

  const removeOption = (secLocalId: string, qLocalId: string, idx: number) =>
    setSections((prev) =>
      prev.map((s) =>
        s.localId === secLocalId
          ? {
              ...s,
              questions: s.questions.map((q) =>
                q.localId === qLocalId
                  ? { ...q, options: q.options.filter((_, i) => i !== idx) }
                  : q,
              ),
            }
          : s,
      ),
    );

  const getSectionCount = (templateId: string) =>
    templateSectionStore.getByTemplate(templateId).length;
  const getQuestionCount = (templateId: string) =>
    templateQuestionStore.getByTemplate(templateId).length;

  return (
    <div className="flex min-h-screen bg-[#111c18]">
      <Sidebar
        session={session}
        currentPage="templates"
        onNavigate={onNavigate}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav
          session={session}
          currentPage="templates"
          onNavigate={onNavigate}
        />
        <header className="bg-[#0d1912] border-b border-[#1e2e26] px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-white">
              Questionnaire Templates
            </h1>
            <p className="text-xs text-gray-500">
              Reusable audit questionnaires
            </p>
          </div>
          <Button
            data-ocid="templates.primary_button"
            size="sm"
            onClick={openNew}
            className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5"
          >
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </header>
        <main className="flex-1 p-5 overflow-auto">
          {templates.length === 0 ? (
            <div
              data-ocid="templates.empty_state"
              className="text-center py-20"
            >
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-700" />
              <p className="text-gray-400">No templates yet.</p>
              <p className="text-gray-600 text-sm mt-1">
                Click &quot;New Template&quot; to create your first
                questionnaire template.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((t, idx) => (
                <Card key={t.id} className="bg-[#1a2420] border-[#1e2e26]">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-white font-semibold">{t.name}</h3>
                          <Badge
                            variant="outline"
                            className="text-[#8aad3a] border-[#4a7c59]/50 text-xs"
                          >
                            {getSectionCount(t.id)} sections
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-blue-300 border-blue-700/50 text-xs"
                          >
                            {getQuestionCount(t.id)} questions
                          </Badge>
                        </div>
                        {t.description && (
                          <p className="text-sm text-gray-400 mt-1">
                            {t.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          Created {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Every question includes a mandatory Remarks field.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          data-ocid={`templates.edit_button.${idx + 1}`}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-white"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          data-ocid={`templates.delete_button.${idx + 1}`}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-400"
                          onClick={() => deleteTemplate(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="bg-[#1a2420] border-[#3a4f44] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editTemplateId ? "Edit Template" : "New Questionnaire Template"}
            </DialogTitle>
          </DialogHeader>

          {/* Info box */}
          <div className="bg-[#6b7c3a]/20 border border-[#6b7c3a]/40 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className="text-[#8aad3a] text-lg mt-0.5">ℹ</span>
            <div className="text-xs text-gray-300 space-y-1">
              <p className="font-semibold text-[#8aad3a]">
                Every question auto-includes:
              </p>
              <ul className="space-y-0.5 text-gray-400">
                <li>
                  • <strong className="text-gray-300">Remarks *</strong> —
                  always visible, always required for submission
                </li>
                <li>
                  • <strong className="text-gray-300">Image Upload</strong> —
                  toggled per question below
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">Template Name *</Label>
                <Input
                  data-ocid="template.input"
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  placeholder="e.g. Banking Branch Electrical Audit"
                  className="bg-[#111c18] border-[#3a4f44] text-white h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">Description</Label>
                <Input
                  value={tDesc}
                  onChange={(e) => setTDesc(e.target.value)}
                  placeholder="Brief description"
                  className="bg-[#111c18] border-[#3a4f44] text-white h-9 text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Sections</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addSection}
                  className="h-7 text-xs border-[#3a4f44] text-[#8aad3a] hover:bg-[#2d3f38] gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Section
                </Button>
              </div>
              <div className="space-y-3">
                {sections.map((sec, si) => (
                  <div
                    key={sec.localId}
                    className="border border-[#3a4f44] rounded-lg overflow-hidden"
                  >
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#6b7c3a] cursor-pointer"
                      onClick={() => toggleSection(sec.localId)}
                    >
                      {expandedSections.has(sec.localId) ? (
                        <ChevronDown className="h-4 w-4 text-white shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-white shrink-0" />
                      )}
                      <Input
                        value={sec.name}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateSection(sec.localId, { name: e.target.value });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder={`Section ${si + 1} name`}
                        className="flex-1 bg-transparent border-0 text-white placeholder:text-white/60 font-semibold h-7 text-sm focus-visible:ring-0 p-0"
                      />
                      <span className="text-white/60 text-xs shrink-0">
                        {sec.questions.length} Q
                      </span>
                      {sections.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-white/60 hover:text-red-300 hover:bg-transparent shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSection(sec.localId);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </button>
                    {expandedSections.has(sec.localId) && (
                      <div className="p-3 space-y-3 bg-[#151f1a]">
                        {sec.questions.map((q, qi) => (
                          <div
                            key={q.localId}
                            className="bg-[#1a2420] border border-[#2a3d33] rounded-lg p-3 space-y-3"
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-gray-500 mt-2 shrink-0">
                                Q{qi + 1}
                              </span>
                              <div className="flex-1 space-y-2">
                                {/* Question label */}
                                <Input
                                  value={q.label}
                                  onChange={(e) =>
                                    updateQuestion(sec.localId, q.localId, {
                                      label: e.target.value,
                                    })
                                  }
                                  placeholder="Question label"
                                  className="bg-[#111c18] border-[#3a4f44] text-white h-8 text-sm"
                                />
                                {/* Input type */}
                                <div className="flex items-center gap-3 flex-wrap">
                                  <Select
                                    value={q.questionType}
                                    onValueChange={(v) =>
                                      updateQuestion(sec.localId, q.localId, {
                                        questionType: v as QType,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-36 bg-[#111c18] border-[#3a4f44] text-white h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                                      <SelectItem
                                        value="radio"
                                        className="text-white focus:bg-[#2d3f38] text-xs"
                                      >
                                        Radio Buttons
                                      </SelectItem>
                                      <SelectItem
                                        value="dropdown"
                                        className="text-white focus:bg-[#2d3f38] text-xs"
                                      >
                                        Dropdown
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>

                                  {/* Always-on reminder */}
                                  <span className="text-xs text-gray-500 italic">
                                    + Remarks always included
                                  </span>
                                </div>

                                {/* Options editor */}
                                <div className="space-y-1.5">
                                  <p className="text-xs text-gray-500">
                                    Options
                                  </p>
                                  {q.options.map((opt, oi) => (
                                    <div
                                      key={`${q.localId}_opt_${oi}`}
                                      className="flex gap-1.5"
                                    >
                                      <Input
                                        value={opt}
                                        onChange={(e) =>
                                          updateOption(
                                            sec.localId,
                                            q.localId,
                                            oi,
                                            e.target.value,
                                          )
                                        }
                                        placeholder={`Option ${oi + 1}`}
                                        className="bg-[#111c18] border-[#3a4f44] text-white h-7 text-xs flex-1"
                                      />
                                      {q.options.length > 1 && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-gray-600 hover:text-red-400"
                                          onClick={() =>
                                            removeOption(
                                              sec.localId,
                                              q.localId,
                                              oi,
                                            )
                                          }
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs text-[#8aad3a] hover:bg-[#2d3f38] gap-1"
                                    onClick={() =>
                                      addOption(sec.localId, q.localId)
                                    }
                                  >
                                    <Plus className="h-3 w-3" /> Add option
                                  </Button>
                                </div>

                                {/* Image upload toggles */}
                                <div className="bg-[#111c18] rounded-md p-3 space-y-2 border border-[#2a3d33]">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ImageIcon className="h-3.5 w-3.5 text-gray-500" />
                                      <span className="text-xs text-gray-300">
                                        Enable Image Upload
                                      </span>
                                    </div>
                                    <Switch
                                      checked={q.enableImageUpload}
                                      onCheckedChange={(v) =>
                                        updateQuestion(sec.localId, q.localId, {
                                          enableImageUpload: v,
                                          imageUploadMandatory: v
                                            ? q.imageUploadMandatory
                                            : false,
                                        })
                                      }
                                      className="data-[state=checked]:bg-[#6b7c3a]"
                                    />
                                  </div>
                                  {q.enableImageUpload && (
                                    <div className="flex items-center justify-between pl-5">
                                      <span className="text-xs text-gray-400">
                                        Image Upload is Mandatory
                                      </span>
                                      <Switch
                                        checked={q.imageUploadMandatory}
                                        onCheckedChange={(v) =>
                                          updateQuestion(
                                            sec.localId,
                                            q.localId,
                                            { imageUploadMandatory: v },
                                          )
                                        }
                                        className="data-[state=checked]:bg-red-600"
                                      />
                                    </div>
                                  )}
                                  {q.enableImageUpload && (
                                    <p className="text-xs text-gray-600 pl-5">
                                      {q.imageUploadMandatory
                                        ? "Auditor must upload at least 1 image to submit"
                                        : "Image upload is optional"}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {sec.questions.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-gray-600 hover:text-red-400 mt-0.5 shrink-0"
                                  onClick={() =>
                                    removeQuestion(sec.localId, q.localId)
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => addQuestion(sec.localId)}
                          className="w-full h-8 text-xs text-[#8aad3a] hover:bg-[#2d3f38] border border-dashed border-[#3a4f44] gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add Question
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              data-ocid="template.cancel_button"
              variant="outline"
              onClick={() => setShowBuilder(false)}
              className="border-[#3a4f44] text-gray-300 hover:bg-[#2a3d33]"
            >
              Cancel
            </Button>
            <Button
              data-ocid="template.save_button"
              onClick={handleSave}
              disabled={saving}
              className="bg-[#4a7c59] hover:bg-[#3d6849] text-white"
            >
              {editTemplateId ? "Update Template" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
