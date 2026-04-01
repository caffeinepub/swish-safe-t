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
import { Switch } from "@/components/ui/switch";
import {
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  ToggleLeft,
  Upload,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { NavPage } from "../App";
import MobileNav from "../components/MobileNav";
import Sidebar from "../components/Sidebar";
import { backendSync } from "../lib/backendSync";
import type { Session } from "../lib/session";
import {
  type StoredUser,
  type UserRole,
  addUser,
  getUsers,
  isTempAdmin,
  updateUser,
} from "../lib/userStore";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  reviewer: "Reviewer",
  auditor: "Auditor",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-900/40 text-red-300 border-red-700",
  manager: "bg-blue-900/40 text-blue-300 border-blue-700",
  reviewer: "bg-purple-900/40 text-purple-300 border-purple-700",
  auditor: "bg-green-900/40 text-green-300 border-green-700",
};

interface Props {
  session: Session;
  onNavigate: (page: NavPage) => void;
}
interface UserForm {
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  isEnabled: boolean;
}

export default function AdminPage({ session, onNavigate }: Props) {
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<StoredUser | null>(null);
  const [form, setForm] = useState<UserForm>({
    username: "",
    password: "",
    fullName: "",
    role: "auditor",
    isEnabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<StoredUser | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => setUsers(getUsers()), []);

  // On mount: pull users from canister so this device sees the latest
  useEffect(() => {
    reload();
    setSyncing(true);
    backendSync
      .loadUsers()
      .then(() => reload())
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [reload]);

  const openAdd = () => {
    setEditingUser(null);
    setForm({
      username: "",
      password: "",
      fullName: "",
      role: "auditor",
      isEnabled: true,
    });
    setShowForm(true);
  };
  const openEdit = (u: StoredUser) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      password: "",
      fullName: u.fullName,
      role: u.role,
      isEnabled: u.isEnabled,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.fullName.trim() || !form.username.trim()) {
      toast.error("Name and username are required");
      return;
    }
    if (!editingUser && !form.password) {
      toast.error("Password is required for new users");
      return;
    }
    const duplicate = users.find(
      (u) =>
        u.username.toLowerCase() === form.username.toLowerCase() &&
        u.id !== editingUser?.id,
    );
    if (duplicate) {
      toast.error("Username already exists");
      return;
    }
    setSaving(true);
    try {
      let targetUsername: string;
      if (editingUser) {
        const updates: Partial<StoredUser> = {
          fullName: form.fullName.trim(),
          role: form.role,
          isEnabled: form.isEnabled,
        };
        if (form.password) {
          updates.password = form.password;
        }
        updateUser(editingUser.id, updates);
        targetUsername = editingUser.username;
        toast.success("User updated");
      } else {
        const newUser = addUser({
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          role: form.role,
          originalRole: form.role,
          elevatedUntil: null,
          isEnabled: form.isEnabled,
        });
        targetUsername = newUser.username;
        toast.success("User added successfully");
      }
      setShowForm(false);
      reload();
      // Sync to canister in background
      backendSync.pushUser(targetUsername);
    } catch (err) {
      toast.error("Failed to save user. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = (u: StoredUser) => {
    if (u.id === session.userId && u.isEnabled) {
      toast.error("You cannot disable your own account");
      return;
    }
    if (u.isEnabled) {
      setConfirmDisable(u);
    } else {
      updateUser(u.id, { isEnabled: true });
      toast.success(`${u.fullName} enabled`);
      reload();
      backendSync.pushUser(u.username);
    }
  };

  const handleGrantTempAdmin = (u: StoredUser) => {
    updateUser(u.id, {
      role: "admin",
      elevatedUntil: Date.now() + 24 * 60 * 60 * 1000,
    });
    toast.success(
      `${u.fullName} has been granted Temporary Admin for 24 hours`,
    );
    reload();
    backendSync.pushUser(u.username);
  };

  const handleManualSync = () => {
    setSyncing(true);
    backendSync
      .loadUsers()
      .then(() => {
        reload();
        toast.success("Users synced from server");
      })
      .catch(() => toast.error("Sync failed — check your connection"))
      .finally(() => setSyncing(false));
  };

  // Export users as JSON file
  const handleExport = () => {
    const data = JSON.stringify(getUsers(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "swish-users-export.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Users exported to swish-users-export.json");
  };

  // Import users from JSON file — merges, skips duplicates by username
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported: StoredUser[] = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(imported)) throw new Error("Invalid format");
        const existing = getUsers();
        const existingUsernames = new Set(
          existing.map((u) => u.username.toLowerCase()),
        );
        let added = 0;
        for (const u of imported) {
          if (!u.username || !u.password) continue;
          if (existingUsernames.has(u.username.toLowerCase())) continue;
          const newUser = addUser({
            username: u.username,
            password: u.password,
            fullName: u.fullName || u.username,
            role: u.role || "auditor",
            originalRole: u.originalRole || u.role || "auditor",
            elevatedUntil: null,
            isEnabled: u.isEnabled ?? true,
          });
          backendSync.pushUser(newUser.username);
          added++;
        }
        toast.success(
          `Imported ${added} new user${added !== 1 ? "s" : ""} (${imported.length - added} skipped as duplicates)`,
        );
        reload();
      } catch {
        toast.error(
          "Failed to parse import file. Make sure it is a valid JSON export.",
        );
      }
      if (importInputRef.current) importInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex min-h-screen bg-[#111c18]">
      <Sidebar session={session} currentPage="admin" onNavigate={onNavigate} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav
          session={session}
          currentPage="admin"
          onNavigate={onNavigate}
        />
        <header className="bg-[#0d1912] border-b border-[#1e2e26] px-4 md:px-6 py-3 flex items-center gap-2 shrink-0">
          <Users className="h-5 w-5 text-[#8aad3a]" />
          <h1 className="text-lg font-bold text-white">Admin Panel</h1>
          {syncing && (
            <span className="ml-2 text-xs text-gray-500 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Syncing…
            </span>
          )}
        </header>
        <main className="flex-1 p-4 md:p-5 overflow-auto">
          <Card className="bg-[#1a2420] border-[#1e2e26]">
            <CardHeader className="flex flex-row items-center justify-between pb-3 gap-2 flex-wrap">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-[#6aab7e]" />
                User Management
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Sync from server */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="border-[#3a4f44] text-gray-300 hover:text-white gap-1.5"
                  title="Pull latest users from server"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  <span className="hidden sm:inline">Sync</span>
                </Button>
                {/* Import */}
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                  data-ocid="admin.upload_button"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => importInputRef.current?.click()}
                  className="border-[#3a4f44] text-gray-300 hover:text-white gap-1.5"
                  data-ocid="admin.secondary_button"
                  title="Import users from JSON file"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
                {/* Export */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExport}
                  className="border-[#3a4f44] text-gray-300 hover:text-white gap-1.5"
                  data-ocid="admin.save_button"
                  title="Export all users as JSON"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <Button
                  size="sm"
                  onClick={openAdd}
                  className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5"
                  data-ocid="admin.primary_button"
                >
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div
                  className="text-center py-12"
                  data-ocid="admin.empty_state"
                >
                  <Users className="h-8 w-8 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 text-sm">
                    No users yet. Add the first user above.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#1e2e26]">
                  {users.map((u, idx) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between py-3 px-2 gap-4"
                      data-ocid={`admin.user.item.${idx + 1}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-white">
                            {u.fullName}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${ROLE_COLORS[u.role] ?? ""}`}
                          >
                            {isTempAdmin(u)
                              ? "Temporary Admin"
                              : (ROLE_LABELS[u.role] ?? u.role)}
                          </Badge>
                          {!u.isEnabled && (
                            <Badge
                              variant="outline"
                              className="text-xs text-gray-500 border-gray-600"
                            >
                              Disabled
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          @{u.username}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {u.role !== "admin" && !isTempAdmin(u) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                            onClick={() => handleGrantTempAdmin(u)}
                            data-ocid={`admin.toggle.button.${idx + 1}`}
                            title="Grant Temporary Admin (24hrs)"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Temp Admin</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`gap-1 text-xs ${
                            u.isEnabled
                              ? "text-gray-400 hover:text-red-400"
                              : "text-green-400 hover:text-green-300"
                          }`}
                          onClick={() => handleToggleEnabled(u)}
                          data-ocid={`admin.secondary_button.${idx + 1}`}
                        >
                          <ToggleLeft className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">
                            {u.isEnabled ? "Disable" : "Enable"}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-white"
                          onClick={() => openEdit(u)}
                          data-ocid={`admin.edit_button.${idx + 1}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1a2420] border-[#1e2e26] mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#6aab7e]" />
                Role Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[
                  {
                    role: "Admin",
                    color: ROLE_COLORS.admin,
                    desc: "Full control, user management",
                  },
                  {
                    role: "Manager",
                    color: ROLE_COLORS.manager,
                    desc: "Edit/delete clients, manage audits",
                  },
                  {
                    role: "Reviewer",
                    color: ROLE_COLORS.reviewer,
                    desc: "Add clients/sites, review audits",
                  },
                  {
                    role: "Auditor",
                    color: ROLE_COLORS.auditor,
                    desc: "Fill and submit assigned audits",
                  },
                ].map((r) => (
                  <div key={r.role} className="p-2 rounded bg-[#111c18]">
                    <Badge variant="outline" className={`${r.color} mb-1`}>
                      {r.role}
                    </Badge>
                    <p className="text-gray-400 mt-1">{r.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a2420] border-[#1e2e26] mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-[#6aab7e]" />
                Cross-Device User Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-400 space-y-2">
              <p>
                Users are automatically synced to the server. Any user you add
                or update here is instantly pushed to the canister so other
                devices can access it. When you open this page, the latest user
                list is pulled from the server automatically.
              </p>
              <p>
                <strong className="text-gray-300">New device setup:</strong> Log
                in as Admin on the new device, open Admin Panel, and click{" "}
                <strong className="text-gray-300">Sync</strong> to pull all
                users from the server. If sync is unavailable (offline or
                canister cold-starting), use Export/Import as a fallback.
              </p>
              <p className="text-gray-500">
                The Sync button also re-pushes any local users that may be
                missing from the server (recovery after a canister reset).
              </p>
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent
          className="bg-[#1a2420] border-[#3a4f44]"
          data-ocid="admin.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-gray-300">Full Name</Label>
              <Input
                data-ocid="admin.input"
                value={form.fullName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fullName: e.target.value }))
                }
                placeholder="e.g. John Smith"
                className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">Username</Label>
              <Input
                data-ocid="admin.search_input"
                value={form.username}
                onChange={(e) =>
                  setForm((p) => ({ ...p, username: e.target.value }))
                }
                placeholder="e.g. jsmith"
                disabled={!!editingUser}
                className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-500 disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">
                {editingUser
                  ? "New Password (leave blank to keep)"
                  : "Password"}
              </Label>
              <Input
                type="password"
                data-ocid="admin.textarea"
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder={
                  editingUser ? "Leave blank to keep current" : "Set a password"
                }
                className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, role: v as UserRole }))
                }
              >
                <SelectTrigger
                  data-ocid="admin.select"
                  className="bg-[#111c18] border-[#3a4f44] text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                  {["auditor", "reviewer", "manager", "admin"].map((r) => (
                    <SelectItem
                      key={r}
                      value={r}
                      className="text-white focus:bg-[#2d3f38]"
                    >
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="user-enabled" className="text-gray-300">
                Account Enabled
              </Label>
              <Switch
                id="user-enabled"
                data-ocid="admin.switch"
                checked={form.isEnabled}
                onCheckedChange={(v) =>
                  setForm((p) => ({ ...p, isEnabled: v }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              className="border-[#3a4f44] text-gray-300"
              data-ocid="admin.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#4a7c59] hover:bg-[#3d6849] text-white"
              data-ocid="admin.submit_button"
            >
              {saving ? "Saving..." : editingUser ? "Update User" : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDisable}
        onOpenChange={() => setConfirmDisable(null)}
      >
        <AlertDialogContent className="bg-[#1a2420] border-[#3a4f44]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Disable User?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {confirmDisable?.fullName} will be unable to log in. You can
              re-enable them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#3a4f44] text-gray-300">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-800 text-white"
              data-ocid="admin.confirm_button"
              onClick={() => {
                if (confirmDisable) {
                  updateUser(confirmDisable.id, { isEnabled: false });
                  toast.success(`${confirmDisable.fullName} disabled`);
                  setConfirmDisable(null);
                  reload();
                  backendSync.pushUser(confirmDisable.username);
                }
              }}
            >
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
