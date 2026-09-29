import { useEffect, useMemo, useState } from "react";
import {
  fetchSummary,
  fetchQuarterly,
  fetchSprintVelocity,
  fetchBacklog,
  fetchProjects,
  fetchSprints,
  fetchTeam,
} from "@/lib/api";
import { PRIORITY_COLORS } from "@/lib/constants";
import { isoToday } from "@/lib/dailyReport";
import {
  attentionItems,
  findActiveSprint,
  isOverdue,
  memberLoad,
  projectOverview,
  sprintProgress,
} from "@/lib/insights";
import TodayTasksCard from "@/components/TodayTasksCard";
import ProjectOverviewCard from "@/components/dashboard/ProjectOverviewCard";
import AttentionCard from "@/components/dashboard/AttentionCard";
import TeamLoadCard from "@/components/dashboard/TeamLoadCard";
import {
  Card,
  CardTitle,
  Meter,
  StatusBar,
  StatusLegend,
} from "@/components/dashboard/parts";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  TrendUp,
  Lightning,
  FolderSimple,
  CalendarX,
  PauseCircle,
  UsersThree,
} from "@phosphor-icons/react";

// Legend text stays in text ink; the square swatch carries the series colour.
const legendText = (value) => <span style={{ color: "#475569" }}>{value}</span>;

const TOOLTIP_STYLE = {
  background: "white",
  border: "1px solid #E5E7EB",
  borderRadius: 4,
  fontSize: 12,
};

function KpiCard({ label, value, suffix, icon: Icon, accent, testId, hint, tone, children }) {
  return (
    <Card className="p-5 flex flex-col" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {label}
        </div>
        {Icon && (
          <div
            className="w-7 h-7 rounded-sm flex items-center justify-center shrink-0"
            style={{ backgroundColor: accent + "1A", color: accent }}
          >
            <Icon size={16} weight="duotone" />
          </div>
        )}
      </div>
      <div className="font-display font-black text-4xl tracking-tighter text-slate-900 mt-3">
        {value}
        {suffix && <span className="text-base font-bold text-slate-400 ml-1">{suffix}</span>}
      </div>
      {children}
      {hint && (
        <div
          className={`text-xs mt-1 ${
            tone === "bad" ? "text-red-700 font-semibold" : tone === "good" ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          {hint}
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [quarterly, setQuarterly] = useState([]);
  const [velocity, setVelocity] = useState([]);
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [team, setTeam] = useState([]);
  const today = isoToday();

  useEffect(() => {
    Promise.all([
      fetchSummary(),
      fetchQuarterly(),
      fetchSprintVelocity(),
      fetchBacklog(),
      fetchProjects(),
      fetchSprints(),
      fetchTeam(),
    ]).then(([s, q, v, b, p, sp, t]) => {
      setSummary(s);
      setQuarterly(q);
      setVelocity(v);
      setItems(b);
      setProjects(p);
      setSprints(sp);
      setTeam(t);
    });
  }, []);

  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const teamMap = useMemo(() => Object.fromEntries(team.map((m) => [m.id, m])), [team]);

  const activeSprint = useMemo(() => findActiveSprint(sprints, today), [sprints, today]);
  const sprint = useMemo(
    () => sprintProgress(activeSprint, items, today),
    [activeSprint, items, today],
  );
  const projectRows = useMemo(
    () => projectOverview(projects, items, team, today),
    [projects, items, team, today],
  );
  const memberRows = useMemo(
    () => memberLoad(team, items, activeSprint, today),
    [team, items, activeSprint, today],
  );
  const attention = useMemo(
    () => attentionItems(items, activeSprint, today),
    [items, activeSprint, today],
  );

  const overdueItems = useMemo(() => items.filter((i) => isOverdue(i, today)), [items, today]);

  const statusCounts = useMemo(() => {
    if (!summary) return {};
    return {
      Backlog: summary.backlog,
      "In Progress": summary.in_progress,
      Pending: summary.pending,
      "In Review": summary.in_review,
      Done: summary.done_items,
    };
  }, [summary]);

  if (!summary) {
    return (
      <div className="text-slate-500" data-testid="dashboard-loading">
        Loading…
      </div>
    );
  }

  const liveProjects = projectRows.filter((r) => r.id != null && r.health !== "No items");
  const offTrack = liveProjects.filter((r) => r.health === "Off track").length;
  const atRisk = liveProjects.filter((r) => r.health === "At risk").length;
  const overdueSp = overdueItems.reduce((a, i) => a + (i.story_points || 0), 0);
  const teamSprintSp = memberRows.reduce((a, r) => a + r.sprintSp, 0);
  const teamCapacity = memberRows.reduce((a, r) => a + r.capacity, 0);
  const teamLoad = teamCapacity ? Math.round((teamSprintSp / teamCapacity) * 100) : 0;
  const overloaded = memberRows.filter((r) => r.flag === "Overloaded").length;

  const priorityRows = ["P1", "P2", "P3", "P4"].map((p) => ({
    priority: p,
    ...summary.by_priority[p],
    label: PRIORITY_COLORS[p].label,
  }));

  const systemRows = Object.entries(summary.by_system)
    .map(([k, v]) => ({ system: k, done_sp: v.done_sp, remaining_sp: v.sp - v.done_sp, sp: v.sp }))
    .sort((a, b) => b.sp - a.sp);

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Overall Delivery"
          value={summary.completion_pct}
          suffix="%"
          icon={TrendUp}
          accent="#059669"
          testId="kpi-completion"
          hint={`${summary.done_sp} of ${summary.total_sp} SP delivered`}
        />
        <KpiCard
          label={sprint ? sprint.sprint.name : "Active Sprint"}
          value={sprint ? sprint.donePct : "—"}
          suffix={sprint ? "%" : null}
          icon={Lightning}
          accent="#0033CC"
          testId="kpi-sprint"
          tone={sprint?.behind ? "bad" : sprint ? "good" : null}
          hint={
            sprint
              ? sprint.behind
                ? `Behind · day ${sprint.day}/${sprint.totalDays}`
                : `On pace · day ${sprint.day}/${sprint.totalDays}`
              : "No active sprint"
          }
        >
          {sprint && (
            <div className="mt-2">
              <Meter
                value={sprint.donePct}
                marker={sprint.timePct}
                title={`${sprint.doneSp}/${sprint.plannedSp} SP done · ${sprint.timePct}% of sprint elapsed (tick)`}
              />
            </div>
          )}
        </KpiCard>
        <KpiCard
          label="Projects at Risk"
          value={offTrack + atRisk}
          suffix={`/ ${liveProjects.length}`}
          icon={FolderSimple}
          accent="#D97706"
          testId="kpi-projects-risk"
          tone={offTrack ? "bad" : null}
          hint={`${offTrack} off track · ${atRisk} at risk`}
        />
        <KpiCard
          label="Overdue Items"
          value={overdueItems.length}
          icon={CalendarX}
          accent="#DC2626"
          testId="kpi-overdue"
          tone={overdueItems.length ? "bad" : "good"}
          hint={overdueItems.length ? `${overdueSp} SP past target date` : "Nothing past target"}
        />
        <KpiCard
          label="On Hold"
          value={summary.pending}
          icon={PauseCircle}
          accent="#EA580C"
          testId="kpi-pending"
          hint="Items in Pending"
        />
        <KpiCard
          label="Team Sprint Load"
          value={activeSprint ? teamLoad : "—"}
          suffix={activeSprint ? "%" : null}
          icon={UsersThree}
          accent="#7C3AED"
          testId="kpi-team-load"
          tone={overloaded ? "bad" : null}
          hint={
            activeSprint
              ? `${teamSprintSp}/${teamCapacity} SP · ${overloaded} overloaded`
              : "No active sprint"
          }
        />
      </div>

      {/* Portfolio status */}
      <Card className="p-5" data-testid="card-portfolio">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Portfolio · {summary.total_items} items · {summary.total_sp} SP
          </div>
          <StatusLegend counts={statusCounts} />
        </div>
        <StatusBar counts={statusCounts} height="h-3" />
      </Card>

      {/* Projects */}
      <ProjectOverviewCard rows={projectRows} />

      {/* What to chase + today's updates */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <AttentionCard rows={attention} projectMap={projectMap} teamMap={teamMap} />
        <div className="xl:col-span-2">
          <TodayTasksCard />
        </div>
      </div>

      {/* Members */}
      <TeamLoadCard rows={memberRows} sprint={activeSprint} />

      {/* Delivery trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="card-velocity">
          <CardTitle eyebrow="Sprint Velocity" title="Planned vs Completed SP" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={velocity} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="#EEF0F3" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" formatter={legendText} />
                <Line
                  type="monotone"
                  dataKey="planned_sp"
                  stroke="#0033CC"
                  strokeWidth={2}
                  name="Planned"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed_sp"
                  stroke="#059669"
                  strokeWidth={2}
                  name="Completed"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5" data-testid="card-quarterly">
          <CardTitle eyebrow="Quarterly Roadmap" title="Planned vs Delivered SP" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={quarterly}
                margin={{ top: 5, right: 10, bottom: 0, left: -10 }}
                barGap={2}
                maxBarSize={32}
              >
                <CartesianGrid stroke="#EEF0F3" vertical={false} />
                <XAxis dataKey="quarter" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#F1F5F9" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" formatter={legendText} />
                <Bar dataKey="total_sp" fill="#0033CC" name="Planned SP" radius={[4, 4, 0, 0]} />
                <Bar dataKey="done_sp" fill="#059669" name="Delivered SP" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Priority & System */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="card-priority">
          <CardTitle eyebrow="By Priority" title="Critical Path Delivery" />
          <div className="space-y-3">
            {priorityRows.map((row) => {
              const c = PRIORITY_COLORS[row.priority];
              const pct = row.sp > 0 ? Math.round((row.done_sp / row.sp) * 100) : 0;
              return (
                <div key={row.priority} data-testid={`priority-row-${row.priority}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded-sm text-xs font-bold font-mono"
                        style={{ backgroundColor: c.bg, color: c.text }}
                      >
                        {row.priority}
                      </span>
                      <span className="text-sm text-slate-700">{row.label}</span>
                      <span className="text-xs text-slate-500">· {row.count} items</span>
                    </div>
                    <div className="text-sm font-mono font-semibold text-slate-900">
                      {row.done_sp}/{row.sp} SP · {pct}%
                    </div>
                  </div>
                  <Meter value={pct} color={c.dot} title={`${pct}% delivered`} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5" data-testid="card-system">
          <CardTitle eyebrow="By System" title="Delivered vs Remaining per Area" />
          <div style={{ height: Math.max(systemRows.length * 36 + 40, 160) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={systemRows}
                layout="vertical"
                margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="#EEF0F3" horizontal={false} />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="system"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#F1F5F9" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="square" formatter={legendText} />
                <Bar
                  dataKey="done_sp"
                  stackId="sp"
                  fill="#059669"
                  name="Delivered SP"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  barSize={18}
                />
                <Bar
                  dataKey="remaining_sp"
                  stackId="sp"
                  fill="#CBD5E1"
                  name="Remaining SP"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
