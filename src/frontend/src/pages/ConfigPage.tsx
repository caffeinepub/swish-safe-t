import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import MobileNav from "../components/MobileNav";
import Sidebar from "../components/Sidebar";
import {
  type Question,
  type Section,
  questionStore,
  sectionStore,
} from "../lib/dataStore";
import type { Session } from "../lib/session";

interface Props {
  session: Session;
  clientId: string;
  onBack: () => void;
}

export default function ConfigPage({ session, clientId, onBack }: Props) {
  const [sections, setSections] = useState<Section[]>(() =>
    sectionStore.getByClient(clientId),
  );
  const [questions, setQuestions] = useState<Question[]>(() =>
    questionStore.getByClient(clientId),
  );
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [showQForm, setShowQForm] = useState(false);
  const [editQ, setEditQ] = useState<Question | null>(null);
  const [qSectionId, setQSectionId] = useState("");
  const [qForm, setQForm] = useState({
    label: "",
    questionType: "radio" as Question["questionType"],
    options: "",
    isMandatoryPhoto: false,
    order: 0,
  });

  const reloadSections = () => setSections(sectionStore.getByClient(clientId));
  const reloadQuestions = () =>
    setQuestions(questionStore.getByClient(clientId));

  const handleSaveSection = () => {
    if (!sectionName.trim()) {
      toast.error("Section name required");
      return;
    }
    if (editSection) {
      sectionStore.update(editSection.id, { name: sectionName });
      toast.success("Section updated");
    } else {
      sectionStore.add({
        clientId,
        name: sectionName,
        order: sections.length + 1,
      });
      toast.success("Section added");
    }
    setShowSectionForm(false);
    reloadSections();
  };

  const handleSaveQuestion = () => {
    if (!qForm.label.trim() || !qSectionId) {
      toast.error("Label and section required");
      return;
    }
    const opts = qForm.options
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    if (editQ) {
      questionStore.update(editQ.id, {
        label: qForm.label,
        questionType: qForm.questionType,
        options: opts,
        isMandatoryPhoto: qForm.isMandatoryPhoto,
        order: qForm.order,
        sectionId: qSectionId,
      });
      toast.success("Question updated");
    } else {
      questionStore.add({
        clientId,
        sectionId: qSectionId,
        label: qForm.label,
        questionType: qForm.questionType,
        options: opts,
        isMandatoryPhoto: qForm.isMandatoryPhoto,
        order: questions.length + 1,
        isEnabled: true,
      });
      toast.success("Question added");
    }
    setShowQForm(false);
    reloadQuestions();
  };

  return (
    <div className="flex min-h-screen bg-[#111c18]">
      <Sidebar
        session={session}
        currentPage="clients"
        onNavigate={(p) => {
          if (p.name !== "clients" && p.name !== "dashboard") return;
          onBack();
        }}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav
          session={session}
          currentPage="clients"
          onNavigate={(p) => {
            if (p.name !== "clients" && p.name !== "dashboard") return;
            onBack();
          }}
        />
        <header className="bg-[#0d1912] border-b border-[#1e2e26] px-6 py-3 flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-gray-400 hover:text-white gap-1.5 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Clients
          </Button>
          <span className="text-gray-600">/</span>
          <Layers className="h-4 w-4 text-[#8aad3a]" />
          <span className="text-white font-semibold">Question Config</span>
        </header>
        <main className="flex-1 p-5 overflow-auto">
          <Card className="bg-[#1a2420] border-[#1e2e26] mb-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#6aab7e]" />
                Sections
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditSection(null);
                  setSectionName("");
                  setShowSectionForm(true);
                }}
                className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Section
              </Button>
            </CardHeader>
            <CardContent>
              {sections.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">
                  No sections yet.
                </p>
              ) : (
                <div className="divide-y divide-[#1e2e26]">
                  {sections.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-2 px-2"
                    >
                      <span className="text-white text-sm">{s.name}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-white"
                          onClick={() => {
                            setEditSection(s);
                            setSectionName(s.name);
                            setShowSectionForm(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-400"
                          onClick={() => {
                            sectionStore.delete(s.id);
                            reloadSections();
                            toast.success("Section deleted");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1a2420] border-[#1e2e26]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-base">Questions</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditQ(null);
                  setQSectionId(sections[0]?.id ?? "");
                  setQForm({
                    label: "",
                    questionType: "radio",
                    options: "",
                    isMandatoryPhoto: false,
                    order: 0,
                  });
                  setShowQForm(true);
                }}
                className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">
                  No questions yet.
                </p>
              ) : (
                <div className="divide-y divide-[#1e2e26]">
                  {questions.map((q) => {
                    const section = sections.find((s) => s.id === q.sectionId);
                    return (
                      <div
                        key={q.id}
                        className="flex items-center justify-between py-2 px-2"
                      >
                        <div>
                          <p className="text-white text-sm">{q.label}</p>
                          <p className="text-gray-500 text-xs">
                            {section?.name ?? "No section"} · {q.questionType}
                            {q.isMandatoryPhoto ? " · Photo required" : ""}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-white"
                            onClick={() => {
                              setEditQ(q);
                              setQSectionId(q.sectionId);
                              setQForm({
                                label: q.label,
                                questionType: q.questionType,
                                options: q.options.join("\n"),
                                isMandatoryPhoto: q.isMandatoryPhoto,
                                order: q.order,
                              });
                              setShowQForm(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-400"
                            onClick={() => {
                              questionStore.delete(q.id);
                              reloadQuestions();
                              toast.success("Question deleted");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={showSectionForm} onOpenChange={setShowSectionForm}>
        <DialogContent className="bg-[#1a2420] border-[#3a4f44]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editSection ? "Edit Section" : "Add Section"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-gray-300">Section Name</Label>
            <Input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="e.g. Electrical Panels"
              className="mt-1.5 bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-500"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSectionForm(false)}
              className="border-[#3a4f44] text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSection}
              className="bg-[#4a7c59] hover:bg-[#3d6849] text-white"
            >
              {editSection ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQForm} onOpenChange={setShowQForm}>
        <DialogContent className="bg-[#1a2420] border-[#3a4f44] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editQ ? "Edit Question" : "Add Question"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-gray-300">Section</Label>
              <Select value={qSectionId} onValueChange={setQSectionId}>
                <SelectTrigger className="bg-[#111c18] border-[#3a4f44] text-white">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                  {sections.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={s.id}
                      className="text-white focus:bg-[#2d3f38]"
                    >
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">Question Label</Label>
              <Input
                value={qForm.label}
                onChange={(e) =>
                  setQForm((p) => ({ ...p, label: e.target.value }))
                }
                placeholder="e.g. Is the panel labelled correctly?"
                className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">Input Type</Label>
              <Select
                value={qForm.questionType}
                onValueChange={(v) =>
                  setQForm((p) => ({
                    ...p,
                    questionType: v as Question["questionType"],
                  }))
                }
              >
                <SelectTrigger className="bg-[#111c18] border-[#3a4f44] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                  <SelectItem
                    value="radio"
                    className="text-white focus:bg-[#2d3f38]"
                  >
                    Radio (Yes/No/N/A)
                  </SelectItem>
                  <SelectItem
                    value="dropdown"
                    className="text-white focus:bg-[#2d3f38]"
                  >
                    Dropdown
                  </SelectItem>
                  <SelectItem
                    value="remarks"
                    className="text-white focus:bg-[#2d3f38]"
                  >
                    Remarks (Text)
                  </SelectItem>
                  <SelectItem
                    value="imageUpload"
                    className="text-white focus:bg-[#2d3f38]"
                  >
                    Image Upload
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {qForm.questionType === "dropdown" && (
              <div className="space-y-1.5">
                <Label className="text-gray-300">Options (one per line)</Label>
                <textarea
                  value={qForm.options}
                  onChange={(e) =>
                    setQForm((p) => ({ ...p, options: e.target.value }))
                  }
                  placeholder="Option 1\nOption 2\nOption 3"
                  rows={4}
                  className="w-full bg-[#111c18] border border-[#3a4f44] text-white placeholder:text-gray-500 rounded-md px-3 py-2 text-sm resize-none"
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Mandatory Photo</Label>
              <Switch
                checked={qForm.isMandatoryPhoto}
                onCheckedChange={(v) =>
                  setQForm((p) => ({ ...p, isMandatoryPhoto: v }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowQForm(false)}
              className="border-[#3a4f44] text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveQuestion}
              className="bg-[#4a7c59] hover:bg-[#3d6849] text-white"
            >
              {editQ ? "Update" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
