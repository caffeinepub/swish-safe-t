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
  Building2,
  MapPin,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { NavPage } from "../App";
import MobileNav from "../components/MobileNav";
import Sidebar from "../components/Sidebar";
import { type Client, clientStore, siteStore } from "../lib/dataStore";
import type { Session } from "../lib/session";

interface Props {
  session: Session;
  onNavigate: (page: NavPage) => void;
}
interface ClientForm {
  name: string;
  industry: string;
  contactName: string;
  contactEmail: string;
}

export default function ClientsPage({ session, onNavigate }: Props) {
  const role = session.role;
  const canEditDelete = role === "admin" || role === "manager";
  const [clients, setClients] = useState<Client[]>(() =>
    clientStore.getAll().filter((c) => c.isEnabled),
  );
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>({
    name: "",
    industry: "",
    contactName: "",
    contactEmail: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const reload = () =>
    setClients(clientStore.getAll().filter((c) => c.isEnabled));

  const openAdd = () => {
    setEditClient(null);
    setForm({ name: "", industry: "", contactName: "", contactEmail: "" });
    setShowForm(true);
  };
  const openEdit = (c: Client) => {
    setEditClient(c);
    setForm({
      name: c.name,
      industry: c.industry,
      contactName: c.contactName,
      contactEmail: c.contactEmail,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Client name is required");
      return;
    }
    setSaving(true);
    try {
      if (editClient) {
        clientStore.update(editClient.id, { ...form });
        toast.success("Client updated");
      } else {
        clientStore.add({
          ...form,
          isEnabled: true,
          createdBy: session.userId,
        });
        toast.success("Client added");
      }
      setShowForm(false);
      reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#111c18]">
      <Sidebar
        session={session}
        currentPage="clients"
        onNavigate={onNavigate}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav
          session={session}
          currentPage="clients"
          onNavigate={onNavigate}
        />
        <header className="bg-[#0d1912] border-b border-[#1e2e26] px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#8aad3a]" />
            <h1 className="text-lg font-bold text-white">Clients</h1>
          </div>
          {role === "reviewer" && (
            <Badge
              variant="outline"
              className="text-xs text-purple-300 border-purple-700"
            >
              View &amp; Add Only
            </Badge>
          )}
        </header>
        <main className="flex-1 p-5 overflow-auto">
          <Card className="bg-[#1a2420] border-[#1e2e26]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-base">
                All Clients
              </CardTitle>
              <Button
                size="sm"
                onClick={openAdd}
                className="bg-[#4a7c59] hover:bg-[#3d6849] text-white gap-1.5"
                data-ocid="clients.add.button"
              >
                <Plus className="h-4 w-4" />
                Add Client
              </Button>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div
                  className="text-center py-12"
                  data-ocid="clients.empty_state"
                >
                  <Building2 className="h-8 w-8 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 text-sm">
                    No clients yet. Click &quot;Add Client&quot; to get started.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#1e2e26]">
                  {clients.map((c, idx) => {
                    const siteCount = siteStore.getByClient(c.id).length;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between py-3 px-1"
                        data-ocid={`clients.item.${idx + 1}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-white">
                              {c.name}
                            </p>
                            <Badge
                              variant="outline"
                              className="text-[10px] text-[#8aad3a] border-[#4a7c59]/50 h-4 px-1"
                            >
                              {siteCount} site{siteCount !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400">
                            {c.industry || "No industry specified"}
                          </p>
                          {c.contactName && (
                            <p className="text-xs text-gray-500">
                              Contact: {c.contactName}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              onNavigate({
                                name: "sites",
                                clientId: c.id,
                                clientName: c.name,
                              })
                            }
                            className="gap-1 text-xs text-[#6aab7e] hover:text-white"
                            data-ocid={`clients.sites_button.${idx + 1}`}
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            <span>Sites</span>
                          </Button>
                          {canEditDelete && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  onNavigate({ name: "config", clientId: c.id })
                                }
                                className="gap-1 text-xs text-gray-400 hover:text-white"
                                data-ocid={`clients.config_button.${idx + 1}`}
                              >
                                <Settings className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Config</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-white"
                                onClick={() => openEdit(c)}
                                data-ocid={`clients.edit_button.${idx + 1}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-400"
                                onClick={() => setDeleteTarget(c)}
                                data-ocid={`clients.delete_button.${idx + 1}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent
          className="bg-[#1a2420] border-[#3a4f44]"
          data-ocid="clients.form.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              {editClient ? "Edit Client" : "Add Client"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-gray-300">Client Name *</Label>
              <Input
                data-ocid="clients.name.input"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. HDFC Bank"
                className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">Industry</Label>
              <Input
                value={form.industry}
                onChange={(e) =>
                  setForm((p) => ({ ...p, industry: e.target.value }))
                }
                placeholder="e.g. Banking, Manufacturing"
                className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">Contact Name</Label>
              <Input
                value={form.contactName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, contactName: e.target.value }))
                }
                placeholder="Primary contact person"
                className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">Contact Email</Label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm((p) => ({ ...p, contactEmail: e.target.value }))
                }
                placeholder="contact@example.com"
                className="bg-[#111c18] border-[#3a4f44] text-white placeholder:text-gray-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              className="border-[#3a4f44] text-gray-300"
              data-ocid="clients.form.cancel.button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#4a7c59] hover:bg-[#3d6849] text-white"
              data-ocid="clients.form.save.button"
            >
              {editClient ? "Update" : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-[#1a2420] border-[#3a4f44]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Remove Client?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Remove &quot;{deleteTarget?.name}&quot;? This can be reversed by
              an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-[#3a4f44] text-gray-300"
              data-ocid="clients.delete.cancel.button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-800 text-white"
              data-ocid="clients.delete.confirm.button"
              onClick={() => {
                if (deleteTarget) {
                  clientStore.delete(deleteTarget.id);
                  toast.success("Client removed");
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
