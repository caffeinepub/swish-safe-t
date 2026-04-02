import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import type { Session } from "../lib/session";

type NavPage = {
  name: string;
  clientId?: string;
  clientName?: string;
  auditId?: string;
  siteId?: string;
};

interface Props {
  session: Session;
  currentPage: string;
  onNavigate: (page: NavPage) => void;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-900/40 text-red-300 border-red-700",
  manager: "bg-blue-900/40 text-blue-300 border-blue-700",
  reviewer: "bg-purple-900/40 text-purple-300 border-purple-700",
  auditor: "bg-green-900/40 text-green-300 border-green-700",
};
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  reviewer: "Reviewer",
  auditor: "Auditor",
};

export default function MobileNav({ session, currentPage, onNavigate }: Props) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const role = session.role;

  const nav = (name: string, label: string, icon: React.ReactNode) => {
    const active = currentPage === name;
    return (
      <button
        key={name}
        type="button"
        onClick={() => {
          onNavigate({ name });
          setOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
          active
            ? "bg-[#4a7c59]/25 text-[#8aad3a] border border-[#8aad3a]/25"
            : "text-gray-400 hover:text-white hover:bg-[#1e2e26]"
        }`}
      >
        <span
          className={`shrink-0 ${active ? "text-[#8aad3a]" : "text-gray-600"}`}
        >
          {icon}
        </span>
        <span className="flex-1 text-left">{label}</span>
      </button>
    );
  };

  return (
    <div className="md:hidden bg-[#0d1912] border-b border-[#1e2e26] px-3 py-2 flex items-center gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e2e26] transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 bg-[#0d1912] border-r border-[#1e2e26] p-0"
        >
          {/* Logo */}
          <div className="p-4 border-b border-[#1e2e26] flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#4a7c59]/20 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-[#8aad3a]" fill="currentColor" />
            </div>
            <div>
              <div className="text-white font-bold text-sm tracking-tight">
                SWiSH SAFE-T
              </div>
              <div className="text-gray-600 text-[9px] tracking-wider">
                ELECTRICAL AUDIT
              </div>
            </div>
          </div>
          {/* User info */}
          <div className="px-3 py-3 border-b border-[#1e2e26]">
            <p className="text-xs text-gray-500">{session.fullName}</p>
            <Badge
              variant="outline"
              className={`text-[9px] px-1 h-4 mt-1 ${ROLE_COLORS[role] ?? ""}`}
            >
              {session.isTemporaryAdmin
                ? "Temp Admin"
                : (ROLE_LABELS[role] ?? role)}
            </Badge>
          </div>
          {/* Nav items */}
          <nav className="flex-1 px-2 py-3 space-y-0.5">
            {nav(
              "dashboard",
              "Dashboard",
              <LayoutDashboard className="h-4 w-4" />,
            )}
            {nav(
              "task-list",
              "Task List",
              <ClipboardList className="h-4 w-4" />,
            )}
            {(role === "admin" || role === "manager" || role === "reviewer") &&
              nav(
                "clients",
                "Clients & Sites",
                <Building2 className="h-4 w-4" />,
              )}
            {(role === "admin" || role === "manager") &&
              nav("templates", "Templates", <FileText className="h-4 w-4" />)}
            {(role === "admin" || role === "manager") &&
              nav("admin", "Users Panel", <Users className="h-4 w-4" />)}
          </nav>
          {/* Logout */}
          <div className="absolute bottom-0 left-0 right-0 px-2 pb-4 border-t border-[#1e2e26] pt-2">
            <button
              type="button"
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-900/15 transition-all"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-[#8aad3a]" fill="currentColor" />
        <span className="text-white font-bold text-sm">SWiSH SAFE-T</span>
      </div>
    </div>
  );
}
