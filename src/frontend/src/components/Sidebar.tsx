import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  User,
  Users,
  Zap,
} from "lucide-react";
import type React from "react";
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

export default function Sidebar({ session, currentPage, onNavigate }: Props) {
  const { logout } = useAuth();
  const role = session.role;

  const navItem = (
    name: string,
    label: string,
    icon: React.ReactNode,
    badge?: number,
  ) => {
    const active = currentPage === name;
    return (
      <button
        key={name}
        type="button"
        onClick={() => onNavigate({ name })}
        data-ocid={`sidebar.${name}.link`}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
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
        {badge !== undefined && badge > 0 && (
          <Badge className="bg-[#8aad3a]/20 text-[#8aad3a] border-[#8aad3a]/40 text-[10px] px-1.5 h-4">
            {badge}
          </Badge>
        )}
        {active && <ChevronRight className="h-3 w-3 text-[#8aad3a] shrink-0" />}
      </button>
    );
  };

  return (
    <aside className="w-56 shrink-0 min-h-screen bg-[#0d1912] border-r border-[#1e2e26] flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-[#1e2e26]">
        <button
          type="button"
          onClick={() => onNavigate({ name: "dashboard" })}
          className="flex items-center gap-2.5 cursor-pointer w-full"
        >
          <div className="h-8 w-8 rounded-lg bg-[#4a7c59]/20 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-[#8aad3a]" fill="currentColor" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-white font-bold text-sm tracking-tight">
              SWiSH SAFE-T
            </div>
            <div className="text-gray-600 text-[9px] tracking-wider">
              ELECTRICAL AUDIT
            </div>
          </div>
        </button>
      </div>

      {/* User */}
      <div className="px-3 py-3 border-b border-[#1e2e26]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-[#4a7c59]/25 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-[#8aad3a]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-600">Hello,</p>
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {session.fullName.split(" ")[0]}
            </p>
            <Badge
              variant="outline"
              className={`text-[9px] px-1 h-3.5 mt-0.5 ${ROLE_COLORS[role] ?? ""}`}
            >
              {session.isTemporaryAdmin
                ? "Temp Admin"
                : (ROLE_LABELS[role] ?? role)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItem(
          "dashboard",
          "Dashboard",
          <LayoutDashboard className="h-4 w-4" />,
        )}
        {navItem(
          "task-list",
          "Task List",
          <ClipboardList className="h-4 w-4" />,
        )}
        {(role === "admin" || role === "manager" || role === "reviewer") &&
          navItem(
            "clients",
            "Clients & Sites",
            <Building2 className="h-4 w-4" />,
          )}
        {(role === "admin" || role === "manager") &&
          navItem("templates", "Templates", <FileText className="h-4 w-4" />)}

        {(role === "admin" || role === "manager" || role === "reviewer") && (
          <>
            <div className="px-3 pt-4 pb-1">
              <p className="text-[9px] font-semibold text-gray-700 uppercase tracking-widest">
                Quick Actions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ name: "clients" })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-[#1e2e26] transition-all"
              data-ocid="sidebar.add_site.button"
            >
              <Plus className="h-4 w-4 text-gray-600 shrink-0" />
              <span>Add New Site</span>
            </button>
          </>
        )}

        <div className="px-3 pt-4 pb-1">
          <p className="text-[9px] font-semibold text-gray-700 uppercase tracking-widest">
            Account Pages
          </p>
        </div>
        {role === "admin" &&
          navItem("admin", "Admin Panel", <Users className="h-4 w-4" />)}
        {navItem("profile", "Profile", <User className="h-4 w-4" />)}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-3 pt-2 border-t border-[#1e2e26]">
        <button
          type="button"
          onClick={logout}
          data-ocid="sidebar.logout.button"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-900/15 transition-all"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign Out</span>
        </button>
        <p className="text-center text-[9px] text-gray-700 mt-2">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-500"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </aside>
  );
}
