import { useEffect, useState } from "react";
import {
  fetchSummary,
  fetchQuarterly,
  fetchSprintVelocity,
  fetchTeamWorkload,
} from "@/lib/api";
import { PRIORITY_COLORS, SYSTEM_COLORS } from "@/lib/constants";
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
  Cell,
} from "recharts";
import {
  TrendUp,
  CheckCircle,
  Clock,
  Stack,
  Warning,
  Target,
} from "@phosphor-icons/react";

function Card({ children, className = "", ...rest }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function KpiCard({ label, value, suffix, icon: Icon, accent, testId, hint }) {
  return (
    <Card className="p-5" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {label}
        </div>
        {Icon && (
          <div
            className="w-7 h-7 rounded-sm flex items-center justify-center"
            style={{ backgroundColor: accent + "1A", color: accent }}
          >
            <Icon size={16} weight="duotone" />
          </div>
        )}
      </div>
      <div className="font-display font-black text-4xl tracking-tighter text-slate-900 mt-3">
        {value}
        {suffix && (
          <span className="text-base font-bold text-slate-400 ml-1">
            {suffix}
          </span>
        )}
      </div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [quarterly, setQuarterly] = useState([]);
  const [velocity, setVelocity] = useState([]);
  const [workload, setWorkload] = useState([]);

  useEffect(() => {
    Promise.all([
      fetchSummary(),
      fetchQuarterly(),
      fetchSprintVelocity(),
      fetchTeamWorkload(),
    ]).then(([s, q, v, w]) => {
      setSummary(s);
      setQuarterly(q);
      setVelocity(v);
      setWorkload(w);
    });
  }, []);

  if (!summary) {
    return (
      <div className="text-slate-500" data-testid="dashboard-loading">
        Loading…
      </div>
    );
  }

  const priorityRows = ["P1", "P2", "P3", "P4"].map((p) => ({
    priority: p,
    ...summary.by_priority[p],
    label: PRIORITY_COLORS[p].label,
  }));

  const systemRows = Object.entries(summary.by_system).map(([k, v]) => ({
    system: k,
    ...v,
  }));

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Total Story Points"
          value={summary.total_sp}
          icon={Stack}
          accent="#0033CC"
          testId="kpi-total-sp"
          hint={`${summary.total_items} items in backlog`}
        />
        <KpiCard
          label="Completion"
          value={summary.completion_pct}
          suffix="%"
          icon={TrendUp}
          accent="#059669"
          testId="kpi-completion"
          hint={`${summary.done_sp} SP delivered`}
        />
        <KpiCard
          label="Done"
          value={summary.done_items}
          icon={CheckCircle}
          accent="#059669"
          testId="kpi-done"
          hint="Items completed"
        />
        <KpiCard
          label="In Progress"
          value={summary.in_progress}
          icon={Clock}
          accent="#0033CC"
          testId="kpi-in-progress"
          hint="Currently building"
        />
        <KpiCard
          label="In Review"
          value={summary.in_review}
          icon={Target}
          accent="#7C3AED"
          testId="kpi-in-review"
          hint="QA / Acceptance"
        />
        <KpiCard
          label="Backlog"
          value={summary.backlog}
          icon={Warning}
          accent="#D97706"
          testId="kpi-backlog"
          hint="Awaiting start"
        />
      </div>

      {/* Quarterly + Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="card-quarterly">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Quarterly Roadmap
              </div>
              <h2 className="font-display font-bold text-xl text-slate-900 mt-1">
                Planned vs Delivered SP
              </h2>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={quarterly}
                margin={{ top: 5, right: 10, bottom: 0, left: -10 }}
              >
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="2 2" vertical={false} />
                <XAxis
                  dataKey="quarter"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="square"
                />
                <Bar
                  dataKey="total_sp"
                  fill="#0033CC"
                  name="Planned SP"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="done_sp"
                  fill="#059669"
                  name="Done SP"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5" data-testid="card-velocity">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Sprint Velocity
              </div>
              <h2 className="font-display font-bold text-xl text-slate-900 mt-1">
                Per-Sprint Output
              </h2>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={velocity}
                margin={{ top: 5, right: 10, bottom: 0, left: -10 }}
              >
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="2 2" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="square"
                />
                <Line
                  type="monotone"
                  dataKey="planned_sp"
                  stroke="#0033CC"
                  strokeWidth={2}
                  name="Planned"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed_sp"
                  stroke="#059669"
                  strokeWidth={2}
                  name="Completed"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Priority & System */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="card-priority">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            By Priority
          </div>
          <h2 className="font-display font-bold text-xl text-slate-900 mt-1 mb-4">
            Critical Path Distribution
          </h2>
          <div className="space-y-3">
            {priorityRows.map((row) => {
              const c = PRIORITY_COLORS[row.priority];
              const pct =
                row.sp > 0 ? Math.round((row.done_sp / row.sp) * 100) : 0;
              return (
                <div
                  key={row.priority}
                  data-testid={`priority-row-${row.priority}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded-sm text-xs font-bold font-mono"
                        style={{ backgroundColor: c.bg, color: c.text }}
                      >
                        {row.priority}
                      </span>
                      <span className="text-sm text-slate-700">
                        {row.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        · {row.count} items
                      </span>
                    </div>
                    <div className="text-sm font-mono font-semibold text-slate-900">
                      {row.done_sp}/{row.sp} SP
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-sm h-2 overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: c.dot,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5" data-testid="card-system">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            By System
          </div>
          <h2 className="font-display font-bold text-xl text-slate-900 mt-1 mb-4">
            Effort per Product Area
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={systemRows}
                layout="vertical"
                margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="2 2" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="system"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="sp" name="Total SP" radius={[0, 2, 2, 0]}>
                  {systemRows.map((row) => (
                    <Cell
                      key={row.system}
                      fill={SYSTEM_COLORS[row.system]?.text || "#0033CC"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Team workload */}
      <Card className="p-5" data-testid="card-workload">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Team Effectiveness
            </div>
            <h2 className="font-display font-bold text-xl text-slate-900 mt-1">
              Workload & Delivery per Engineer
            </h2>
          </div>
          <div className="text-xs text-slate-500">
            Sorted by assigned story points
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              <th className="text-left py-2 font-semibold">Member</th>
              <th className="text-left py-2 font-semibold">Role</th>
              <th className="text-right py-2 font-semibold">Items</th>
              <th className="text-right py-2 font-semibold">In Prog</th>
              <th className="text-right py-2 font-semibold">Done SP</th>
              <th className="text-left py-2 font-semibold pl-4 w-2/5">
                Utilization
              </th>
            </tr>
          </thead>
          <tbody>
            {workload.map((w) => (
              <tr
                key={w.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                data-testid={`workload-row-${w.id}`}
              >
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold text-white font-mono"
                      style={{ backgroundColor: w.avatar_color || "#0033CC" }}
                    >
                      {w.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {w.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-sm text-slate-600">{w.role}</td>
                <td className="py-3 text-right font-mono text-sm">
                  {w.dev_items}
                </td>
                <td className="py-3 text-right font-mono text-sm">
                  {w.in_progress}
                </td>
                <td className="py-3 text-right font-mono text-sm font-semibold">
                  {w.done_sp}/{w.assigned_sp}
                </td>
                <td className="py-3 pl-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-sm h-2 overflow-hidden relative">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(w.utilization_pct, 100)}%`,
                          backgroundColor:
                            w.utilization_pct > 100
                              ? "#DC2626"
                              : w.utilization_pct > 80
                                ? "#D97706"
                                : "#0033CC",
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold w-14 text-right">
                      {w.utilization_pct}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
