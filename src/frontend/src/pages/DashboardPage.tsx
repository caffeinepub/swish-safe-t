import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  ClipboardList,
  Filter,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NavPage } from "../App";
import Sidebar from "../components/Sidebar";
import { auditStore, clientStore, siteStore } from "../lib/dataStore";
import type { Session } from "../lib/session";

interface Props {
  session: Session;
  onNavigate: (page: NavPage) => void;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const CHART_COLORS = [
  "#8aad3a",
  "#4a7c59",
  "#6aab7e",
  "#c5e06a",
  "#3d6849",
  "#a3c96b",
];
const STATE_COLORS = [
  "#8aad3a",
  "#6aab7e",
  "#4a7c59",
  "#c5e06a",
  "#3d6849",
  "#a3c96b",
  "#7ab86a",
  "#5c9e50",
  "#d4e87a",
  "#2d5038",
];
const BRANCH_TYPE_COLORS: Record<string, string> = {
  Metro: "#8aad3a",
  Urban: "#4a7c59",
  "Semi-urban": "#c5e06a",
  Rural: "#6aab7e",
};

type CTooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
};
type PTooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
};
type LabelProps = {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
};

export default function DashboardPage({ session, onNavigate }: Props) {
  const role = session.role;
  const [clientFilter, setClientFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");

  const allClients = clientStore.getAll().filter((c) => c.isEnabled);
  const allSites = siteStore.getAll().filter((s) => s.isEnabled);
  const allAudits =
    role === "auditor"
      ? auditStore.getByAuditor(session.userId)
      : auditStore.getAll();

  const filteredAudits = useMemo(() => {
    let audits = allAudits;
    if (clientFilter !== "all")
      audits = audits.filter((a) => a.clientId === clientFilter);
    if (timeFilter !== "all") {
      const cutoff =
        Date.now() - Number.parseInt(timeFilter) * 24 * 60 * 60 * 1000;
      audits = audits.filter((a) => a.lastSavedAt >= cutoff);
    }
    return audits;
  }, [allAudits, clientFilter, timeFilter]);

  const filteredSites = useMemo(() => {
    if (clientFilter !== "all")
      return allSites.filter((s) => s.clientId === clientFilter);
    return allSites;
  }, [allSites, clientFilter]);

  const pendingAudits = filteredAudits.filter(
    (a) =>
      a.status === "Draft" ||
      a.status === "Submitted" ||
      a.status === "PendingReReview",
  );

  const monthlyData = useMemo(() => {
    return MONTHS.map((month, i) => {
      const row: Record<string, string | number> = { month };
      for (const client of allClients) {
        row[client.name] = filteredAudits.filter((a) => {
          const d = new Date(a.lastSavedAt);
          return d.getMonth() === i && a.clientId === client.id;
        }).length;
      }
      return row;
    });
  }, [filteredAudits, allClients]);

  const stateData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const site of filteredSites) {
      const state = site.branchState || site.state || "Unknown";
      counts[state] = (counts[state] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredSites]);

  const branchTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const site of filteredSites) {
      const type = site.branchType || "Urban";
      counts[type] = (counts[type] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredSites]);

  const CustomTooltip = ({ active, payload }: CTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#1a2420] border border-[#3a4f44] rounded-lg p-3 text-xs">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: p.fill }}
            />
            <span className="text-gray-400">{p.name}:</span>
            <span className="text-white font-medium">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const PieTooltipEl = ({ active, payload }: PTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#1a2420] border border-[#3a4f44] rounded-lg p-2 text-xs">
        <p className="text-white">
          {payload[0].name}: <strong>{payload[0].value}</strong>
        </p>
      </div>
    );
  };

  const renderLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: LabelProps) => {
    if (percent < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight="600"
      >
        {Math.round(percent * 100)}%
      </text>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#111c18]">
      <Sidebar
        session={session}
        currentPage="dashboard"
        onNavigate={onNavigate}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-[#0d1912] border-b border-[#1e2e26] px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-white">Dashboard</h1>
            <p className="text-xs text-gray-500">
              Electrical Safety Audit Overview
            </p>
          </div>
          {session.isTemporaryAdmin && (
            <Badge className="bg-yellow-900/40 text-yellow-300 border-yellow-700">
              Temporary Admin
            </Badge>
          )}
        </header>

        <main className="flex-1 p-5 overflow-auto">
          {/* Filter bar */}
          <div
            className="flex flex-wrap items-center gap-3 mb-5 bg-[#1a2420] border border-[#1e2e26] rounded-xl px-4 py-3"
            data-ocid="dashboard.filter.panel"
          >
            <Filter className="h-4 w-4 text-gray-600 shrink-0" />
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger
                className="w-44 bg-[#111c18] border-[#3a4f44] text-white h-8 text-sm"
                data-ocid="dashboard.client.select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                <SelectItem
                  value="all"
                  className="text-white focus:bg-[#2d3f38]"
                >
                  All Banks
                </SelectItem>
                {allClients.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    className="text-white focus:bg-[#2d3f38]"
                  >
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger
                className="w-36 bg-[#111c18] border-[#3a4f44] text-white h-8 text-sm"
                data-ocid="dashboard.time.select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2420] border-[#3a4f44]">
                <SelectItem
                  value="all"
                  className="text-white focus:bg-[#2d3f38]"
                >
                  All time
                </SelectItem>
                <SelectItem
                  value="30"
                  className="text-white focus:bg-[#2d3f38]"
                >
                  Last 30 days
                </SelectItem>
                <SelectItem
                  value="90"
                  className="text-white focus:bg-[#2d3f38]"
                >
                  Last 90 days
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 bg-[#4a7c59] hover:bg-[#3d6849] text-white text-xs"
              data-ocid="dashboard.filter.button"
              onClick={() => {
                setClientFilter("all");
                setTimeFilter("all");
              }}
            >
              Reset
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {[
              {
                label: "Total Clients",
                value: allClients.length,
                icon: <Building2 className="h-5 w-5" />,
                col: "text-[#8aad3a]",
                bg: "bg-[#8aad3a]/10",
              },
              {
                label: "Total Sites",
                value: filteredSites.length,
                icon: <MapPin className="h-5 w-5" />,
                col: "text-[#6aab7e]",
                bg: "bg-[#6aab7e]/10",
              },
              {
                label: "Total Audits",
                value: filteredAudits.length,
                icon: <ClipboardList className="h-5 w-5" />,
                col: "text-[#c5e06a]",
                bg: "bg-[#c5e06a]/10",
              },
              {
                label: "Pending Audits",
                value: pendingAudits.length,
                icon: <TrendingUp className="h-5 w-5" />,
                col: "text-orange-400",
                bg: "bg-orange-900/20",
              },
            ].map((stat) => (
              <Card key={stat.label} className="bg-[#1a2420] border-[#1e2e26]">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center ${stat.col}`}
                    >
                      {stat.icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {stat.value}
                      </p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Monthly bar chart */}
          <Card className="bg-[#1a2420] border-[#1e2e26] mb-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#8aad3a]" />
                Monthly Audit Reports
                <span className="text-gray-500 font-normal text-xs ml-1">
                  (
                  {clientFilter === "all"
                    ? "All Banks"
                    : (allClients.find((c) => c.id === clientFilter)?.name ??
                      "")}
                  )
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={monthlyData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                  barCategoryGap="35%"
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={{ stroke: "#1e2e26" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "rgba(74,124,89,0.08)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                  {allClients
                    .filter(
                      (c) => clientFilter === "all" || c.id === clientFilter,
                    )
                    .map((c, i) => (
                      <Bar
                        key={c.id}
                        dataKey={c.name}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        radius={[3, 3, 0, 0]}
                      />
                    ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Donut charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <Card className="bg-[#1a2420] border-[#1e2e26]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">
                  State / Region Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stateData.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-gray-500 text-sm">
                    No data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stateData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={renderLabel}
                      >
                        {stateData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={STATE_COLORS[i % STATE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltipEl />} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                        iconType="circle"
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="bg-[#1a2420] border-[#1e2e26]">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">
                  Branch Type Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                {branchTypeData.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-gray-500 text-sm">
                    No data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={branchTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={renderLabel}
                      >
                        {branchTypeData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={BRANCH_TYPE_COLORS[entry.name] ?? "#6aab7e"}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltipEl />} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                        iconType="circle"
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Client summary table */}
          <Card className="bg-[#1a2420] border-[#1e2e26]">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#8aad3a]" />
                Client Summary
              </CardTitle>
              {(role === "admin" ||
                role === "manager" ||
                role === "reviewer") && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-[#4a7c59] hover:bg-[#3d6849] text-white"
                  onClick={() => onNavigate({ name: "clients" })}
                  data-ocid="dashboard.clients.button"
                >
                  Manage Clients
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2e26]">
                      {["Client", "Industry", "Sites", "Audits", "Pending"].map(
                        (h) => (
                          <th
                            key={h}
                            className="text-left text-xs font-medium text-gray-500 px-4 py-2"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {allClients
                      .filter(
                        (c) => clientFilter === "all" || c.id === clientFilter,
                      )
                      .map((client, idx) => {
                        const cs = allSites.filter(
                          (s) => s.clientId === client.id,
                        );
                        const ca = filteredAudits.filter(
                          (a) => a.clientId === client.id,
                        );
                        const cp = ca.filter(
                          (a) =>
                            a.status === "Draft" ||
                            a.status === "Submitted" ||
                            a.status === "PendingReReview",
                        );
                        return (
                          <tr
                            key={client.id}
                            className="border-b border-[#151f1a] hover:bg-[#1a2720]/60 transition-colors cursor-pointer"
                            onKeyUp={(e) =>
                              e.key === "Enter" &&
                              onNavigate({
                                name: "sites",
                                clientId: client.id,
                                clientName: client.name,
                              })
                            }
                            onClick={() =>
                              onNavigate({
                                name: "sites",
                                clientId: client.id,
                                clientName: client.name,
                              })
                            }
                            data-ocid={`dashboard.client.item.${idx + 1}`}
                          >
                            <td className="px-4 py-3 font-medium text-white">
                              {client.name}
                            </td>
                            <td className="px-4 py-3 text-gray-400">
                              {client.industry}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className="text-[#8aad3a] border-[#4a7c59]/50 bg-[#4a7c59]/10 text-xs"
                              >
                                {cs.length}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              {ca.length}
                            </td>
                            <td className="px-4 py-3">
                              {cp.length > 0 ? (
                                <Badge className="bg-orange-900/30 text-orange-300 border-orange-700/50 text-xs">
                                  {cp.length}
                                </Badge>
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {allClients.filter(
                  (c) => clientFilter === "all" || c.id === clientFilter,
                ).length === 0 && (
                  <div
                    className="text-center py-8 text-gray-500 text-sm"
                    data-ocid="dashboard.clients.empty_state"
                  >
                    No clients found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
