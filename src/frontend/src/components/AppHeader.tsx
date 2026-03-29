import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, Users } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { Session } from "../lib/session";

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

type NavPage = {
  name: string;
  clientId?: string;
  clientName?: string;
};

interface Props {
  session: Session;
  currentPage?: string;
  onNavigate: (page: NavPage) => void;
}

export default function AppHeader({ session, currentPage, onNavigate }: Props) {
  const { logout } = useAuth();
  const role = session.role;

  return (
    <header className="bg-[#1a2420] border-b border-[#3a4f44] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNavigate({ name: "dashboard" })}
        >
          <img
            src="/assets/uploads/image-019d38f8-f918-70cd-9a4b-dbde1288b762-1.png"
            alt="SWiSH SAFE-T"
            className="h-10 w-auto object-contain"
          />
        </button>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Button
            variant={currentPage === "dashboard" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onNavigate({ name: "dashboard" })}
            className="text-gray-300 hover:text-white"
          >
            Dashboard
          </Button>
          {(role === "admin" || role === "manager" || role === "reviewer") && (
            <Button
              variant={currentPage === "clients" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onNavigate({ name: "clients" })}
              className="text-gray-300 hover:text-white"
            >
              Clients
            </Button>
          )}
          {role === "admin" && (
            <Button
              variant={currentPage === "admin" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onNavigate({ name: "admin" })}
              className="text-gray-300 hover:text-white"
            >
              Admin
            </Button>
          )}
        </nav>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-gray-300 hover:text-white"
            >
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium leading-none">
                  {session.fullName}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-xs ${ROLE_COLORS[role] ?? ""}`}
                >
                  {session.isTemporaryAdmin
                    ? "Temporary Admin"
                    : (ROLE_LABELS[role] ?? role)}
                </Badge>
                <ChevronDown className="h-3 w-3" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#243028] border-[#3a4f44]"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm text-white font-medium">
                {session.fullName}
              </p>
              <p className="text-xs text-gray-400">{session.username}</p>
            </div>
            <DropdownMenuSeparator className="bg-[#3a4f44]" />
            {role === "admin" && (
              <DropdownMenuItem
                onClick={() => onNavigate({ name: "admin" })}
                className="text-gray-300 focus:bg-[#3a4f44] cursor-pointer gap-2"
              >
                <Users className="h-4 w-4" />
                Admin Panel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-[#3a4f44]" />
            <DropdownMenuItem
              onClick={logout}
              className="text-red-400 focus:bg-[#3a4f44] cursor-pointer gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
