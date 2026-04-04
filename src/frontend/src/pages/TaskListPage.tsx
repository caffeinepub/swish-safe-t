import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Printer,
  RefreshCw,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { NavPage } from "../App";
import MobileNav from "../components/MobileNav";
import Sidebar from "../components/Sidebar";
import { backendSync } from "../lib/backendSync";
import { auditStore, clientStore, siteStore } from "../lib/dataStore";
import type { Audit, Site } from "../lib/dataStore";
import type { Session } from "../lib/session";
import { getUsers } from "../lib/userStore";

interface Props {
  session: Session;
  onNavigate: (page: NavPage) => void;
}

type AuditStatus = Audit["status"] | "Unstarted";

const VALID_STATUSES = new Set<AuditStatus>([
  "Unstarted",
  "Draft",
  "Submitted",
  "PendingApproval",
  "ReturnedForCorrection",
  "Completed",
]);

function normalizeStatus(raw: string): AuditStatus {
  if (VALID_STATUSES.has(raw as AuditStatus)) return raw as AuditStatus;
  const lower = raw.toLowerCase().replace(/\s+/g, "");
  if (lower === "approved" || lower === "completed") return "Completed";
  if (lower === "returned" || lower === "rejected")
    return "ReturnedForCorrection";
  if (lower === "pendingapproval" || lower === "underreview")
    return "PendingApproval";
  if (
    lower === "submitted" ||
    lower === "pendingreview" ||
    lower === "pendingforreview"
  )
    return "Submitted";
  return "Draft";
}

function getDisplayStatus(audit: Audit | null): AuditStatus {
  if (!audit) return "Unstarted";
  return normalizeStatus(audit.status as string);
}

const STATUS_BADGE: Record<AuditStatus, { label: string; cls: string }> = {
  Unstarted: {
    label: "ASSIGNED",
    cls: "bg-gray-700/40 text-gray-300 border-gray-600/50",
  },
  Draft: {
    label: "IN PROGRESS",
    cls: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  },
  Submitted: {
    label: "PENDING FOR REVIEW",
    cls: "bg-orange-900/40 text-orange-300 border-orange-700/50",
  },
  PendingApproval: {
    label: "PENDING APPROVAL",
    cls: "bg-amber-900/40 text-amber-300 border-amber-700/50",
  },
  ReturnedForCorrection: {
    label: "RETURNED FOR CORRECTION",
    cls: "bg-rose-900/40 text-rose-300 border-rose-700/50",
  },
  Completed: {
    label: "COMPLETED",
    cls: "bg-green-900/40 text-green-300 border-green-700/50",
  },
};

export default function TaskListPage({ session, onNavigate }: Props) {
  const role = session.role;
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [assignedSites, setAssignedSites] = useState(() =>
    siteStore.getAssignedToUser(session.userId, role, session.username),
  );
  const [allAudits, setAllAudits] = useState(() => auditStore.getAll());

  const refreshData = useCallback(() => {
    setAssignedSites(
      siteStore.getAssignedToUser(session.userId, role, session.username),
    );
    setAllAudits(auditStore.getAll());
  }, [session.userId, session.username, role]);

  // Pull all audit reports from canister on mount so latest status is shown
  useEffect(() => {
    setSyncing(true);
    backendSync
      .loadAllAudits()
      .then(() => refreshData())
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [refreshData]);
  const allClients = clientStore.getAll();

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of allClients) m[c.id] = c.name;
    return m;
  }, [allClients]);

  const siteAuditMap = useMemo(() => {
    const m: Record<string, Audit | null> = {};
    for (const site of assignedSites) {
      const audits = allAudits.filter((a) => a.siteId === site.id);
      m[site.id] = audits.length
        ? audits.sort((a, b) => b.lastSavedAt - a.lastSavedAt)[0]
        : null;
    }
    return m;
  }, [assignedSites, allAudits]);

  const counts = useMemo(() => {
    let unstarted = 0;
    let inProgress = 0;
    let pendingReview = 0;
    let underReview = 0;
    let completed = 0;
    for (const site of assignedSites) {
      const audit = siteAuditMap[site.id];
      const st = getDisplayStatus(audit);
      if (st === "Unstarted") unstarted++;
      else if (st === "Draft") inProgress++;
      else if (st === "Submitted") pendingReview++;
      else if (st === "PendingApproval") underReview++;
      else if (st === "Completed") completed++;
    }
    return { unstarted, inProgress, pendingReview, underReview, completed };
  }, [assignedSites, siteAuditMap]);

  const filteredSites = useMemo(() => {
    if (!search.trim()) return assignedSites;
    const q = search.toLowerCase();
    return assignedSites.filter((s) => {
      const client = clientMap[s.clientId] ?? "";
      return (
        (s.branchName || s.siteName || "").toLowerCase().includes(q) ||
        client.toLowerCase().includes(q) ||
        (s.branchCode || s.siteCode || "").toLowerCase().includes(q) ||
        (s.auditorName || "").toLowerCase().includes(q) ||
        (s.reviewerName || "").toLowerCase().includes(q)
      );
    });
  }, [assignedSites, search, clientMap]);

  const canEditDelete = role === "admin" || role === "manager";

  const openQuestionnaire = (site: Site) => {
    const audit = siteAuditMap[site.id];
    onNavigate({ name: "questionnaire", siteId: site.id, auditId: audit?.id });
  };

  const handleManualSync = () => {
    setSyncing(true);
    backendSync
      .loadAllAudits()
      .then(() => refreshData())
      .catch(() => {})
      .finally(() => setSyncing(false));
  };

  const SUMMARY_CARDS = [
    {
      label: "Assigned Reports",
      count: counts.unstarted,
      icon: <Calendar className="h-6 w-6" />,
      bg: "bg-blue-900/30",
      col: "text-blue-300",
      border: "border-blue-800/40",
    },
    {
      label: "Reports In-Progress",
      count: counts.inProgress,
      icon: <TrendingUp className="h-6 w-6" />,
      bg: "bg-orange-900/30",
      col: "text-orange-300",
      border: "border-orange-800/40",
    },
    {
      label: "Pending For Review",
      count: counts.pendingReview,
      icon: <ClipboardList className="h-6 w-6" />,
      bg: "bg-teal-900/30",
      col: "text-teal-300",
      border: "border-teal-800/40",
    },
    {
      label: "Pending Approval",
      count: counts.underReview,
      icon: <AlertTriangle className="h-6 w-6" />,
      bg: "bg-amber-900/30",
      col: "text-amber-300",
      border: "border-amber-800/40",
    },
    {
      label: "Completed Reports",
      count: counts.completed,
      icon: <Star className="h-6 w-6" />,
      bg: "bg-green-900/30",
      col: "text-green-300",
      border: "border-green-800/40",
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#111c18]">
      <Sidebar
        session={session}
        currentPage="task-list"
        onNavigate={onNavigate}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav
          session={session}
          currentPage="task-list"
          onNavigate={onNavigate}
        />
        <header className="bg-[#0d1912] border-b border-[#1e2e26] px-6 py-3 shrink-0 flex items-center gap-2">
          <div>
            <h1 className="text-lg font-bold text-white">Task List</h1>
            <p className="text-xs text-gray-500">Your assigned site audits</p>
          </div>
          {syncing && (
            <span className="ml-2 text-xs text-gray-500 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Syncing…
            </span>
          )}
        </header>
        <main className="flex-1 p-5 overflow-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {SUMMARY_CARDS.map((c) => (
              <div
                key={c.label}
                className={`${c.bg} ${c.border} border rounded-xl p-4 flex flex-col gap-2`}
              >
                <div className={`${c.col}`}>{c.icon}</div>
                <div>
                  <p className="text-xs text-gray-400 leading-tight">
                    {c.label}
                  </p>
                  <p className={`text-3xl font-bold ${c.col}`}>{c.count}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table card */}
          <div className="bg-[#1a2420] border border-[#1e2e26] rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e2e26]">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white border border-[#3a4f44]"
                onClick={handleManualSync}
                disabled={syncing}
                title="Refresh report statuses from server"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white border border-[#3a4f44]"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white border border-[#3a4f44]"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white border border-[#3a4f44]"
              >
                <Printer className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Search:</span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 w-48 bg-[#111c18] border-[#3a4f44] text-white text-sm"
                    placeholder="Search sites..."
                    data-ocid="task.search_input"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e2e26]">
                    {[
                      "Title",
                      "Branch Code",
                      "Scheduled On",
                      "Auditor",
                      "Reviewer",
                      "Started On",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 whitespace-nowrap"
                      >
                        {h}{" "}
                        <ChevronDown className="h-3 w-3 inline text-gray-600" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSites.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12 text-gray-500 text-sm"
                        data-ocid="task.empty_state"
                      >
                        {search
                          ? "No matching sites found"
                          : "No sites assigned to you"}
                      </td>
                    </tr>
                  )}
                  {filteredSites.map((site, idx) => {
                    const audit = siteAuditMap[site.id];
                    const status = getDisplayStatus(audit);
                    const badge = STATUS_BADGE[status] ?? STATUS_BADGE.Draft;
                    const clientName = clientMap[site.clientId] ?? "";
                    const isExpanded = expandedRow === site.id;
                    const startedOn = audit?.startedAt
                      ? new Date(audit.startedAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : audit?.lastSavedAt
                        ? new Date(audit.lastSavedAt).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            },
                          )
                        : "—";
                    return (
                      <Fragment key={site.id}>
                        <tr
                          className="border-b border-[#151f1a] hover:bg-[#1a2720]/60 transition-colors cursor-pointer"
                          onClick={() =>
                            setExpandedRow(isExpanded ? null : site.id)
                          }
                          onKeyUp={(e) =>
                            e.key === "Enter" &&
                            setExpandedRow(isExpanded ? null : site.id)
                          }
                          data-ocid={`task.item.${idx + 1}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-[#8aad3a] shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                              )}
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                  <span className="text-white text-[9px] font-bold">
                                    B
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white whitespace-nowrap">
                                    #{site.branchCode || site.siteCode || ""},{" "}
                                    {clientName}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {site.branchType || "Urban"},{" "}
                                    {site.branchCity || site.city || ""},{" "}
                                    {site.branchState || site.state || ""}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {site.branchCode || site.siteCode || "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">
                            {site.scheduledAuditDate || site.scheduledDate
                              ? new Date(
                                  site.scheduledAuditDate ||
                                    site.scheduledDate ||
                                    "",
                                ).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {(() => {
                              const allUsers = getUsers().filter(
                                (u) => u.isEnabled,
                              );
                              const byId = allUsers.find(
                                (u) =>
                                  u.id ===
                                  (site.auditorId ||
                                    site.assignedAuditorId ||
                                    ""),
                              );
                              const byUsername =
                                !byId && site.auditorUsername
                                  ? allUsers.find(
                                      (u) =>
                                        u.username.toLowerCase() ===
                                        (
                                          site.auditorUsername || ""
                                        ).toLowerCase(),
                                    )
                                  : null;
                              const resolved = byId || byUsername;
                              return resolved
                                ? resolved.fullName?.trim() || resolved.username
                                : site.auditorName ||
                                    site.assignedAuditorName ||
                                    "—";
                            })()}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {(() => {
                              const allUsers = getUsers().filter(
                                (u) => u.isEnabled,
                              );
                              const byId = site.reviewerId
                                ? allUsers.find((u) => u.id === site.reviewerId)
                                : null;
                              const byUsername =
                                !byId && site.reviewerUsername
                                  ? allUsers.find(
                                      (u) =>
                                        u.username.toLowerCase() ===
                                        (
                                          site.reviewerUsername || ""
                                        ).toLowerCase(),
                                    )
                                  : null;
                              const resolved = byId || byUsername;
                              return resolved
                                ? resolved.fullName?.trim() || resolved.username
                                : site.reviewerName || "—";
                            })()}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">
                            {startedOn}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold whitespace-nowrap px-2 py-0.5 ${badge.cls}`}
                            >
                              {badge.label}
                            </Badge>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-[#151f1a] bg-[#111c18]/60">
                            <td colSpan={7} className="px-10 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 mr-2">
                                  Action
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-[#3a4f44] text-gray-300 hover:bg-[#2d3f38]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openQuestionnaire(site);
                                  }}
                                  data-ocid={`task.secondary_button.${idx + 1}`}
                                >
                                  View
                                </Button>
                                {canEditDelete && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-[#3a4f44] text-gray-300 hover:bg-[#2d3f38]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openQuestionnaire(site);
                                    }}
                                    data-ocid={`task.edit_button.${idx + 1}`}
                                  >
                                    Edit
                                  </Button>
                                )}
                                {canEditDelete && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-red-900 text-red-400 hover:bg-red-900/20"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    data-ocid={`task.delete_button.${idx + 1}`}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
