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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { NavPage } from "../App";
import Sidebar from "../components/Sidebar";
import { useActor } from "../hooks/useActor";
import { listUsersFromBackend } from "../lib/backendUserService";
import { type Site, siteStore, templateStore } from "../lib/dataStore";
import type { Session } from "../lib/session";
import type { StoredUser } from "../lib/userStore";

interface Props {
  session: Session;
  clientId: string;
  clientName: string;
  onNavigate: (page: NavPage) => void;
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const BRANCH_TYPES = ["Urban", "Metro", "Semi-urban", "Rural"];

interface SiteForm {
  branchName: string;
  branchAddress: string;
  branchCode: string;
  branchCity: string;
  branchState: string;
  branchType: string;
  scheduledAuditDate: string;
  auditorId: string;
  reviewerId: string;
  managerId: string;
  templateId: string;
}

const EMPTY_FORM: SiteForm = {
  branchName: "",
  branchAddress: "",
  branchCode: "",
  branchCity: "",
  branchState: "",
  branchType: "",
  scheduledAuditDate: "",
  auditorId: "",
  reviewerId: "",
  managerId: "",
  templateId: "",
};

const BRANCH_TYPE_BADGE: Record<string, string> = {
  Metro: "text-[#8aad3a] border-[#4a7c59]/50 bg-[#4a7c59]/10",
  Urban: "text-blue-300 border-blue-700/50 bg-blue-900/10",
  "Semi-urban": "text-yellow-300 border-yellow-700/50 bg-yellow-900/10",
  Rural: "text-gray-300 border-gray-700/50 bg-gray-900/10",
};

export default function SitesPage({
  session,
  clientId,
  clientName,
  onNavigate,
}: Props) {
  const role = session.role;
  const canEditDelete = role === "admin" || role === "manager";
  const { actor, isFetching } = useActor();
  const [backendUsers, setBackendUsers] = useState<StoredUser[]>([]);
  const templates = templateStore.getAll();

  // Load users from backend
  useEffect(() => {
    if (actor && !isFetching) {
      listUsersFromBackend(actor).then(setBackendUsers).catch(console.error);
    }
  }, [actor, isFetching]);

  const users = backendUsers.filter((u) => u.isEnabled);
  const auditors = users.filter((u) => u.role === "auditor");
  const reviewers = users.filter((u) => u.role === "reviewer");
  const managers = users.filter(
    (u) => u.role === "manager" || u.role === "admin",
  );

  const [sites, setSites] = useState<Site[]>(() =>
    siteStore.getByClient(clientId),
  );
  const [showForm, setShowForm] = useState(false);
  const [editSite, setEditSite] = useState<Site | null>(null);
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);

  const reload = () => setSites(siteStore.getByClient(clientId));
  const setField = (f: keyof SiteForm, v: string) =>
    setForm((p) => ({ ...p, [f]: v }));

  const openAdd = () => {
    setEditSite(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };
  const openEdit = (s: Site) => {
    setEditSite(s);
    setForm({
      branchName: s.branchName || s.siteName || "",
      branchAddress: s.branchAddress || s.address || "",
      branchCode: s.branchCode || s.siteCode || "",
      branchCity: s.branchCity || s.city || "",
      branchState: s.branchState || s.state || "",
      branchType: s.branchType || "",
      scheduledAuditDate: s.scheduledAuditDate || s.scheduledDate || "",
      auditorId: s.auditorId || s.assignedAuditorId || "",
      reviewerId: s.reviewerId || "",
      managerId: s.managerId || "",
      templateId: s.templateId || "",
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.branchName.trim()) {
      toast.error("Branch name is required");
      return;
    }
    if (!form.branchCode.trim()) {
      toast.error("Branch code is required");
      return;
    }
    if (!form.branchCity.trim()) {
      toast.error("Branch city is required");
      return;
    }
    if (!form.branchState) {
      toast.error("Please select a state");
      return;
    }
    if (!form.auditorId) {
      toast.error("Please assign an auditor");
      return;
    }
    setSaving(true);
    const auditor = users.find((u) => u.id === form.auditorId);
    const reviewer = users.find((u) => u.id === form.reviewerId);
    const manager = users.find((u) => u.id === form.managerId);
    try {
      const payload = {
        ...form,
        auditorName: auditor?.fullName ?? "",
        reviewerName: reviewer?.fullName ?? "",
        managerName: manager?.fullName ?? "",
        templateId: form.templateId || undefined,
      };
      if (editSite) {
        siteStore.update(editSite.id, payload);
        toast.success("Site updated");
      } else {
        siteStore.add({
          ...payload,
          clientId,
          isEnabled: true,
          createdBy: session.userId,
        });
        toast.success("Site added successfully");
      }
      setShowForm(false);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const displayField = (s: Site, newField: keyof Site, legacy?: keyof Site) => {
    const v = s[newField] as string;
    if (v) return v;
    if (legacy) return (s[legacy] as string) || "\u2014";
    return "\u2014";
  };

  return (
    <div className="flex min-h-screen bg-[#111c18]">
      <Sidebar
        session={session}
        currentPage="clients"
        onNavigate={onNavigate}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-[#0d1912] border-b border-[#1e2e26] px-6 py-3 flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate({ name: "clients" })}
            className="text-gray-400 hover:text-white gap-1.5 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" /> Clients
          </Button>
          <span className="text-gray-600">/</span>
          <Building2 className="h-4 w-4 text-[#8aad3a]" />
          <span className="text-white font-semibold">{clientName}</span>
          <Badge
            variant="outline"
            className="text-[#8aad3a] border-[#4a7c59]/50 text-xs"
          >
            {sites.length} Sites
          </Badge>
        </header>
        <main className="flex-1 p-5 overflow-auto">
          <Card className="bg-[#1a2420] border-[#1e2e26]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#8aad3a]" />
                Branch Sites
                {role === "reviewer" && (
                  <Badge
                    variant="outline"
                    className="text-xs text-purple-300 border-purple-700 ml-1"
                  >
                    Add Only
                  </Badge>
                )}
              </CardTitle>
              <Button
                size="sm"
                onClick={openAdd}
                className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5"
                data-ocid="sites.primary_button"
              >
                <Plus className="h-4 w-4" /> Add Site
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {sites.length === 0 ? (
                <div
                  className="text-center py-16"
                  data-ocid="sites.empty_state"
                >
                  <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-700" />
                  <p className="text-gray-400 text-sm">No branch sites yet.</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Click “Add Site” to register a branch.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1e2e26] hover:bg-transparent">
                        {[
                          "Branch Name",
                          "Code",
                          "City",
                          "State",
                          "Type",
                          "Scheduled Date",
                          "Auditor",
                          "Reviewer",
                          "Manager",
                          "Template",
                          "Actions",
                        ].map((h) => (
                          <TableHead
                            key={h}
                            className="text-gray-500 text-xs font-medium whitespace-nowrap px-3"
                          >
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sites.map((s) => {
                        const tmpl = s.templateId
                          ? templates.find((t) => t.id === s.templateId)
                          : null;
                        return (
                          <TableRow
                            key={s.id}
                            className="border-[#151f1a] hover:bg-[#1a2720]/50 transition-colors"
                          >
                            <TableCell className="py-3 px-3">
                              <p className="font-medium text-white text-sm">
                                {displayField(s, "branchName", "siteName")}
                              </p>
                              {(s.branchAddress || s.address) && (
                                <p className="text-xs text-gray-500 mt-0.5 max-w-[140px] truncate">
                                  {s.branchAddress || s.address}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-400 text-xs px-3">
                              {displayField(s, "branchCode", "siteCode")}
                            </TableCell>
                            <TableCell className="text-gray-400 text-xs px-3">
                              {displayField(s, "branchCity", "city")}
                            </TableCell>
                            <TableCell className="text-gray-400 text-xs px-3">
                              {displayField(s, "branchState", "state")}
                            </TableCell>
                            <TableCell className="px-3">
                              {s.branchType ? (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${BRANCH_TYPE_BADGE[s.branchType] ?? "text-gray-300 border-gray-700/50"}`}
                                >
                                  {s.branchType}
                                </Badge>
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-400 text-xs px-3 whitespace-nowrap">
                              {s.scheduledAuditDate || s.scheduledDate ? (
                                <div className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3 text-gray-600" />
                                  {s.scheduledAuditDate || s.scheduledDate}
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="px-3">
                              {s.auditorName || s.assignedAuditorName ? (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-[#6aab7e]" />
                                  <span className="text-xs text-gray-300">
                                    {s.auditorName || s.assignedAuditorName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-600">
                                  Unassigned
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-3">
                              {s.reviewerName ? (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-purple-400" />
                                  <span className="text-xs text-gray-300">
                                    {s.reviewerName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-600">—</span>
                              )}
                            </TableCell>
                            <TableCell className="px-3">
                              {s.managerName ? (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-blue-400" />
                                  <span className="text-xs text-gray-300">
                                    {s.managerName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-600">—</span>
                              )}
                            </TableCell>
                            <TableCell className="px-3">
                              {tmpl ? (
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3 text-[#8aad3a]" />
                                  <span className="text-xs text-[#8aad3a] max-w-[100px] truncate">
                                    {tmpl.name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-600">
                                  None
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-3">
                              {canEditDelete && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-gray-400 hover:text-white"
                                    onClick={() => openEdit(s)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-400"
                                    onClick={() => setDeleteTarget(s)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-[#1a2420] border-[#3a4f44] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editSite ? "Edit Branch Site" : "Add New Branch Site"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Branch Details */}
            <div>
              <h3 className="text-[10px] font-semibold text-[#8aad3a] uppercase tracking-widest mb-3 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" /> Branch Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Branch Name *</Label>
                  <Input
                    value={form.branchName}
                    onChange={(e) => setField("branchName", e.target.value)}
                    placeholder="e.g. Nariman Point Branch"
                    className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-600 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Branch Code *</Label>
                  <Input
                    value={form.branchCode}
                    onChange={(e) => setField("branchCode", e.target.value)}
                    placeholder="e.g. HDFC-MUM-001"
                    className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-600 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-gray-300 text-xs">
                    Branch Address
                  </Label>
                  <Input
                    value={form.branchAddress}
                    onChange={(e) => setField("branchAddress", e.target.value)}
                    placeholder="Full street address"
                    className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-600 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Branch City *</Label>
                  <Input
                    value={form.branchCity}
                    onChange={(e) => setField("branchCity", e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-600 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">
                    Branch State *
                  </Label>
                  <Select
                    value={form.branchState}
                    onValueChange={(v) => setField("branchState", v)}
                  >
                    <SelectTrigger className="bg-[#111c18] border-[#3a4f44] text-white h-9 text-sm">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2420] border-[#3a4f44] max-h-56">
                      {INDIAN_STATES.map((st) => (
                        <SelectItem
                          key={st}
                          value={st}
                          className="text-white focus:bg-[#2d3f38] text-sm"
                        >
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Branch Type</Label>
                  <Select
                    value={form.branchType}
                    onValueChange={(v) => setField("branchType", v)}
                  >
                    <SelectTrigger className="bg-[#111c18] border-[#3a4f44] text-white h-9 text-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                      {BRANCH_TYPES.map((bt) => (
                        <SelectItem
                          key={bt}
                          value={bt}
                          className="text-white focus:bg-[#2d3f38] text-sm"
                        >
                          {bt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">
                    Scheduled Audit Date
                  </Label>
                  <Input
                    type="date"
                    value={form.scheduledAuditDate}
                    onChange={(e) =>
                      setField("scheduledAuditDate", e.target.value)
                    }
                    className="bg-[#111c18] border-[#3a4f44] text-white h-9 text-sm"
                  />
                </div>
              </div>
            </div>
            {/* Assignments */}
            <div>
              <h3 className="text-[10px] font-semibold text-[#8aad3a] uppercase tracking-widest mb-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Assignments
                {isFetching && (
                  <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                )}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">
                    Auditor Assigned *
                  </Label>
                  <Select
                    value={form.auditorId}
                    onValueChange={(v) => setField("auditorId", v)}
                  >
                    <SelectTrigger className="bg-[#111c18] border-[#3a4f44] text-white h-9 text-sm">
                      <SelectValue placeholder="Select auditor" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                      {auditors.length === 0 ? (
                        <SelectItem
                          value="none"
                          disabled
                          className="text-gray-500"
                        >
                          No auditors
                        </SelectItem>
                      ) : (
                        auditors.map((u) => (
                          <SelectItem
                            key={u.id}
                            value={u.id}
                            className="text-white focus:bg-[#2d3f38] text-sm"
                          >
                            {u.fullName}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {auditors.length === 0 && !isFetching && (
                    <p className="text-xs text-yellow-400">
                      Add auditor users in Admin Panel first.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">
                    Reviewer Assigned
                  </Label>
                  <Select
                    value={form.reviewerId}
                    onValueChange={(v) => setField("reviewerId", v)}
                  >
                    <SelectTrigger className="bg-[#111c18] border-[#3a4f44] text-white h-9 text-sm">
                      <SelectValue placeholder="Select reviewer" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                      <SelectItem
                        value="none"
                        className="text-gray-500 focus:bg-[#2d3f38] text-sm"
                      >
                        Not assigned
                      </SelectItem>
                      {reviewers.map((u) => (
                        <SelectItem
                          key={u.id}
                          value={u.id}
                          className="text-white focus:bg-[#2d3f38] text-sm"
                        >
                          {u.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">
                    Assigned Manager
                  </Label>
                  <Select
                    value={form.managerId}
                    onValueChange={(v) => setField("managerId", v)}
                  >
                    <SelectTrigger className="bg-[#111c18] border-[#3a4f44] text-white h-9 text-sm">
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                      <SelectItem
                        value="none"
                        className="text-gray-500 focus:bg-[#2d3f38] text-sm"
                      >
                        Not assigned
                      </SelectItem>
                      {managers.map((u) => (
                        <SelectItem
                          key={u.id}
                          value={u.id}
                          className="text-white focus:bg-[#2d3f38] text-sm"
                        >
                          {u.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {/* Template */}
            <div>
              <h3 className="text-[10px] font-semibold text-[#8aad3a] uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Questionnaire Template
              </h3>
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">Assign Template</Label>
                <Select
                  value={form.templateId || "none"}
                  onValueChange={(v) =>
                    setField("templateId", v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger className="bg-[#111c18] border-[#3a4f44] text-white h-9 text-sm">
                    <SelectValue placeholder="No template assigned" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                    <SelectItem
                      value="none"
                      className="text-gray-500 focus:bg-[#2d3f38] text-sm"
                    >
                      No template
                    </SelectItem>
                    {templates.map((t) => (
                      <SelectItem
                        key={t.id}
                        value={t.id}
                        className="text-white focus:bg-[#2d3f38] text-sm"
                      >
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-gray-500">
                    No templates yet. Create one in the Templates section.
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              className="border-[#3a4f44] text-gray-300 hover:bg-[#2a3d33]"
              data-ocid="sites.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#4a7c59] hover:bg-[#3d6849] text-white"
              data-ocid="sites.submit_button"
            >
              {editSite ? "Update Site" : "Add Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-[#1a2420] border-[#3a4f44]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Remove Branch?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Remove &quot;{deleteTarget?.branchName || deleteTarget?.siteName}
              &quot; from {clientName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-[#3a4f44] text-gray-300"
              data-ocid="sites.cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-800 text-white"
              data-ocid="sites.confirm_button"
              onClick={() => {
                if (deleteTarget) {
                  siteStore.delete(deleteTarget.id);
                  toast.success("Branch removed");
                  setDeleteTarget(null);
                  reload();
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
