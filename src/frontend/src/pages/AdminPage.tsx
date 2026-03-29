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
  Loader2,
  Pencil,
  Plus,
  Shield,
  ShieldCheck,
  ToggleLeft,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { NavPage } from "../App";
import Sidebar from "../components/Sidebar";
import { useActor } from "../hooks/useActor";
import {
  listUsersFromBackend,
  upsertUserToBackend,
} from "../lib/backendUserService";
import { hashPassword } from "../lib/crypto";
import type { Session } from "../lib/session";
import type { StoredUser, UserRole } from "../lib/userStore";
import { isTempAdmin } from "../lib/userStore";

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
  const { actor, isFetching } = useActor();
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
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
  const [confirmDisable, setConfirmDisable] = useState<StoredUser | null>(null);

  const reload = async (currentActor: typeof actor) => {
    if (!currentActor) return;
    setLoadingUsers(true);
    try {
      const list = await listUsersFromBackend(currentActor);
      setUsers(list);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (actor && !isFetching) {
      setLoadingUsers(true);
      listUsersFromBackend(actor)
        .then(setUsers)
        .catch(console.error)
        .finally(() => setLoadingUsers(false));
    }
  }, [actor, isFetching]);

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

  const handleSave = async () => {
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
    if (!actor) {
      toast.error("Not connected to backend. Please wait.");
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        const updated: StoredUser = {
          ...editingUser,
          fullName: form.fullName.trim(),
          role: form.role,
          isEnabled: form.isEnabled,
        };
        if (form.password) {
          updated.passwordHash = await hashPassword(
            form.username,
            form.password,
          );
        }
        await upsertUserToBackend(actor, updated);
        toast.success("User updated");
      } else {
        const hash = await hashPassword(form.username.trim(), form.password);
        const newUser: StoredUser = {
          id: form.username.trim(),
          username: form.username.trim(),
          passwordHash: hash,
          fullName: form.fullName.trim(),
          role: form.role,
          originalRole: form.role,
          elevatedUntil: null,
          isEnabled: form.isEnabled,
        };
        await upsertUserToBackend(actor, newUser);
        toast.success("User added successfully");
      }
      setShowForm(false);
      await reload(actor);
    } catch (err) {
      toast.error("Failed to save user. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (u: StoredUser) => {
    if (u.id === session.userId && u.isEnabled) {
      toast.error("You cannot disable your own account");
      return;
    }
    if (u.isEnabled) {
      setConfirmDisable(u);
    } else {
      if (!actor) return;
      await upsertUserToBackend(actor, { ...u, isEnabled: true });
      toast.success(`${u.fullName} enabled`);
      await reload(actor);
    }
  };

  const handleGrantTempAdmin = async (u: StoredUser) => {
    if (!actor) return;
    await upsertUserToBackend(actor, {
      ...u,
      role: "admin",
      elevatedUntil: Date.now() + 24 * 60 * 60 * 1000,
    });
    toast.success(
      `${u.fullName} has been granted Temporary Admin for 24 hours`,
    );
    await reload(actor);
  };

  const isActorReady = !!actor && !isFetching;

  return (
    <div className="flex min-h-screen bg-[#111c18]">
      <Sidebar session={session} currentPage="admin" onNavigate={onNavigate} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-[#0d1912] border-b border-[#1e2e26] px-6 py-3 flex items-center gap-2 shrink-0">
          <Users className="h-5 w-5 text-[#8aad3a]" />
          <h1 className="text-lg font-bold text-white">Admin Panel</h1>
        </header>
        <main className="flex-1 p-5 overflow-auto">
          <Card className="bg-[#1a2420] border-[#1e2e26]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-[#6aab7e]" />
                User Management
              </CardTitle>
              <Button
                size="sm"
                onClick={openAdd}
                disabled={!isActorReady}
                className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5"
                data-ocid="admin.primary_button"
              >
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div
                  className="flex items-center justify-center py-12"
                  data-ocid="admin.loading_state"
                >
                  <Loader2 className="h-6 w-6 animate-spin text-[#6aab7e] mr-2" />
                  <span className="text-gray-400 text-sm">
                    Loading users...
                  </span>
                </div>
              ) : users.length === 0 ? (
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
                          className={`gap-1 text-xs ${u.isEnabled ? "text-gray-400 hover:text-red-400" : "text-green-400 hover:text-green-300"}`}
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
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving...
                </>
              ) : editingUser ? (
                "Update User"
              ) : (
                "Add User"
              )}
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
              onClick={async () => {
                if (confirmDisable && actor) {
                  await upsertUserToBackend(actor, {
                    ...confirmDisable,
                    isEnabled: false,
                  });
                  toast.success(`${confirmDisable.fullName} disabled`);
                  setConfirmDisable(null);
                  await reload(actor);
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
