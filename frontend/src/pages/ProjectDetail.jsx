import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  fetchProjectSummary,
  fetchBacklog,
  fetchTeam,
  fetchSprints,
  updateBacklogItem,
} from "@/lib/api";
import { PriorityBadge, SystemBadge, StatusBadge } from "@/components/Badges";
import { STATUSES } from "@/lib/constants";
import { getActorId } from "@/lib/currentUser";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Stack, Target } from "@phosphor-icons/react";

export default function ProjectDetail() {
  const { id } = useParams();
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  const [sprints, setSprints] = useState([]);

  const load = async () => {
    const [sum, b, t, s] = await Promise.all([
      fetchProjectSummary(id),
      fetchBacklog({ project_id: id }),
      fetchTeam(),
      fetchSprints(),
    ]);
    setSummary(sum);
    setItems(b);
    setTeam(t);
    setSprints(s);
  };

  useEffect(() => {
    load();
  }, [id]);

  const teamMap = useMemo(
    () => Object.fromEntries(team.map((m) => [m.id, m])),
    [team],
  );
  const sprintMap = useMemo(
    () => Object.fromEntries(sprints.map((s) => [s.id, s])),
    [sprints],
  );

  const byPhase = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      const k = i.phase || "Unphased";
      (map[k] = map[k] || []).push(i);
    });
    return map;
  }, [items]);

  const changeStatus = async (itemId, status) => {
    await updateBacklogItem(itemId, { status }, getActorId() || undefined);
    toast.success(`Moved to ${status}`);
    load();
  };

  if (!summary) {
    return <div className="text-slate-500">Loading…</div>;
  }
  const p = summary.project;
  const pct = summary.completion_pct;

  return (
    <div className="space-y-6" data-testid="project-detail">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0033CC]"
        data-testid="back-projects"
      >
        <ArrowLeft size={14} /> All Projects
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="h-2" style={{ backgroundColor: p.color || "#0033CC" }} />
        <div className="p-5 flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-sm flex items-center justify-center text-base font-bold text-white font-mono shrink-0"
              style={{ backgroundColor: p.color || "#0033CC" }}
            >
              {p.code || p.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                {p.code} · {p.status} · Owner:{" "}
                {teamMap[p.owner_id]?.name || "—"}
              </div>
              <h1 className="font-display font-black text-3xl tracking-tighter text-slate-900 mt-1">
                {p.name}
              </h1>
              {p.system && (
                <div className="mt-2">
                  <SystemBadge system={p.system} />
                </div>
              )}
              {p.description && (
                <p className="text-sm text-slate-600 mt-3 max-w-2xl whitespace-pre-line">
                  {p.description}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <Stat label="Phases" value={summary.phases.length} icon={Stack} />
            <Stat label="Items" value={summary.items} icon={Target} />
            <Stat
              label="Story Points"
              value={`${summary.done_sp}/${summary.total_sp}`}
            />
            <Stat label="Done %" value={`${pct}%`} accent="#059669" />
          </div>
        </div>
      </div>

      {/* Phase progress */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
          Phase Progress
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {summary.phases.map((ph) => (
            <div
              key={ph.phase}
              className="bg-white border border-slate-200 rounded-sm p-3"
              data-testid={`phase-stat-${ph.phase.replace(/\s+/g, "-")}`}
            >
              <div className="text-xs font-bold text-slate-900 mb-1.5">
                {ph.phase}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">
                {ph.items} items · {ph.done_sp}/{ph.total_sp} SP
              </div>
              <div className="w-full bg-slate-100 rounded-sm h-1.5 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${ph.completion_pct}%`,
                    backgroundColor:
                      ph.completion_pct >= 100
                        ? "#059669"
                        : ph.completion_pct >= 50
                          ? "#0033CC"
                          : "#D97706",
                  }}
                />
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1">
                {ph.completion_pct}% complete
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items grouped by phase */}
      <div className="space-y-6">
        {Object.entries(byPhase)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([phase, phaseItems]) => (
            <div key={phase} data-testid={`phase-section-${phase.replace(/\s+/g, "-")}`}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-display font-black text-xl tracking-tighter text-slate-900">
                  {phase}
                </h2>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  {phaseItems.length} items ·{" "}
                  {phaseItems.reduce((a, b) => a + b.story_points, 0)} SP
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      <th className="text-left px-4 py-2 font-semibold">Ref</th>
                      <th className="text-left px-4 py-2 font-semibold">
                        Title
                      </th>
                      <th className="text-left px-4 py-2 font-semibold">
                        Prio
                      </th>
                      <th className="text-left px-4 py-2 font-semibold">
                        Sprint
                      </th>
                      <th className="text-left px-4 py-2 font-semibold">Dev</th>
                      <th className="text-right px-4 py-2 font-semibold">SP</th>
                      <th className="text-left px-4 py-2 font-semibold">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {phaseItems.map((i) => (
                      <tr
                        key={i.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-600">
                          {i.wb_ref}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-slate-900">
                          {i.title}
                        </td>
                        <td className="px-4 py-2">
                          <PriorityBadge priority={i.priority} />
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-600">
                          {sprintMap[i.sprint_id]?.name || "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-700">
                          {teamMap[i.dev_assignee_id]?.name || "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-sm font-semibold">
                          {i.story_points}
                        </td>
                        <td className="px-4 py-2">
                          <Select
                            value={i.status}
                            onValueChange={(v) => changeStatus(i.id, v)}
                          >
                            <SelectTrigger className="h-7 rounded-sm border-transparent hover:border-slate-200 w-32 px-1">
                              <StatusBadge status={i.status} />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }) {
  return (
    <div className="bg-slate-50 rounded-sm p-2 min-w-[80px]">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center justify-center gap-1">
        {Icon && <Icon size={11} />}
        {label}
      </div>
      <div
        className="font-display font-black text-xl text-slate-900 mt-0.5"
        style={accent ? { color: accent } : {}}
      >
        {value}
      </div>
    </div>
  );
}
