import { useEffect, useMemo, useState } from "react";
import {
  fetchBacklog,
  fetchProjects,
  fetchSprints,
  fetchTeam,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_COLORS,
  STATUS_COLORS,
  STATUSES,
  SYSTEM_COLORS,
} from "@/lib/constants";
import { PriorityBadge, StatusBadge, SystemBadge } from "@/components/Badges";

// Format from the LOCAL date parts. toISOString() converts to UTC first, which
// shifts the day for any timezone east of Greenwich (WIB is +07:00), so every
// quick range would start and end a day early.
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const QUICK_RANGES = [
  {
    label: "This month",
    range: () => {
      const n = new Date();
      return [
        iso(new Date(n.getFullYear(), n.getMonth(), 1)),
        iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)),
      ];
    },
  },
  {
    label: "This quarter",
    range: () => {
      const n = new Date();
      const q = Math.floor(n.getMonth() / 3);
      return [
        iso(new Date(n.getFullYear(), q * 3, 1)),
        iso(new Date(n.getFullYear(), q * 3 + 3, 0)),
      ];
    },
  },
  {
    label: "This year",
    range: () => {
      const y = new Date().getFullYear();
      return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))];
    },
  },
];

export default function Roadmap() {
  const [items, setItems] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [team, setTeam] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    Promise.all([
      fetchBacklog(),
      fetchSprints(),
      fetchTeam(),
      fetchProjects(),
    ]).then(([b, s, t, p]) => {
      setItems(b);
      setSprints(s);
      setTeam(t);
      setProjects(p);
    });
  }, []);

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  const teamMap = useMemo(
    () => Object.fromEntries(team.map((m) => [m.id, m])),
    [team],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((i) => {
        if (projectFilter !== "all" && String(i.project_id) !== projectFilter)
          return false;
        if (statusFilter !== "all" && i.status !== statusFilter) return false;
        return true;
      }),
    [items, projectFilter, statusFilter],
  );

  const itemsBySprint = useMemo(() => {
    const map = {};
    filteredItems.forEach((i) => {
      if (!i.sprint_id) return;
      (map[i.sprint_id] = map[i.sprint_id] || []).push(i);
    });
    return map;
  }, [filteredItems]);

  // A sprint is in range when it overlaps it at all — not only when it sits
  // wholly inside — otherwise a sprint straddling the boundary disappears.
  const filteredSprints = useMemo(
    () =>
      sprints.filter((s) => {
        if (dateFrom && s.end_date < dateFrom) return false;
        if (dateTo && s.start_date > dateTo) return false;
        return true;
      }),
    [sprints, dateFrom, dateTo],
  );

  const activeRange = useMemo(() => {
    if (!dateFrom && !dateTo) return null;
    const hit = QUICK_RANGES.find((r) => {
      const [from, to] = r.range();
      return from === dateFrom && to === dateTo;
    });
    return hit ? hit.label : "custom";
  }, [dateFrom, dateTo]);

  // Visible sprints: in the date range, and — when a project is selected —
  // actually carrying some of that project's work. Otherwise the roadmap fills
  // with empty sprint headers.
  const itemFilterActive = projectFilter !== "all" || statusFilter !== "all";

  const visibleSprints = useMemo(
    () =>
      itemFilterActive
        ? filteredSprints.filter((s) => (itemsBySprint[s.id] || []).length > 0)
        : filteredSprints,
    [filteredSprints, itemsBySprint, itemFilterActive],
  );

  const sprintsByQuarter = useMemo(() => {
    const map = {};
    visibleSprints.forEach((s) => {
      (map[s.quarter] = map[s.quarter] || []).push(s);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.sprint_number - b.sprint_number),
    );
    return map;
  }, [visibleSprints]);


  return (
    <div className="space-y-6" data-testid="roadmap-page">
      {/* Date filter */}
      <div className="bg-white border border-slate-200 rounded-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Project
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger
            className={`rounded-sm h-9 w-56 ${
              projectFilter !== "all" ? "border-[#0033CC] bg-[#0033CC]/5" : ""
            }`}
            data-testid="roadmap-project-filter"
          >
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.code ? `${p.code} · ` : ""}
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Status
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className={`rounded-sm h-9 w-40 ${
              statusFilter !== "all" ? "border-[#0033CC] bg-[#0033CC]/5" : ""
            }`}
            data-testid="roadmap-status-filter"
          >
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((st) => (
              <SelectItem key={st} value={st}>
                {st}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-slate-200" />

        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Dates
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className={`rounded-sm h-9 w-40 font-mono text-xs ${
              dateFrom ? "border-[#0033CC] bg-[#0033CC]/5" : ""
            }`}
            data-testid="roadmap-date-from"
          />
          <span className="text-slate-400 text-xs">→</span>
          <Input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className={`rounded-sm h-9 w-40 font-mono text-xs ${
              dateTo ? "border-[#0033CC] bg-[#0033CC]/5" : ""
            }`}
            data-testid="roadmap-date-to"
          />
        </div>

        {QUICK_RANGES.map((r) => (
          <Button
            key={r.label}
            variant={activeRange === r.label ? "default" : "outline"}
            aria-pressed={activeRange === r.label}
            className={`rounded-sm h-9 text-xs ${
              activeRange === r.label
                ? "bg-[#0033CC] hover:bg-[#0028A3] text-white border-[#0033CC]"
                : ""
            }`}
            onClick={() => {
              const [from, to] = r.range();
              setDateFrom(from);
              setDateTo(to);
            }}
            data-testid={`roadmap-range-${r.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {r.label}
          </Button>
        ))}

        {(dateFrom || dateTo || itemFilterActive) && (
          <Button
            variant="ghost"
            className="rounded-sm h-9 text-xs text-slate-500"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setProjectFilter("all");
              setStatusFilter("all");
            }}
            data-testid="roadmap-date-clear"
          >
            Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {(activeRange || itemFilterActive) && (
            <span
              className="px-2 py-1 rounded-sm bg-[#0033CC]/10 text-[#0033CC] text-[10px] font-mono uppercase tracking-widest font-bold"
              data-testid="roadmap-filter-active"
            >
              Filtered
              {projectFilter !== "all" && projectMap[projectFilter]
                ? ` · ${projectMap[projectFilter].code || projectMap[projectFilter].name}`
                : ""}
              {statusFilter !== "all" ? ` · ${statusFilter}` : ""}
              {activeRange && activeRange !== "custom" ? ` · ${activeRange}` : ""}
            </span>
          )}
          <span
            className={`text-[10px] font-mono uppercase tracking-widest ${
              activeRange || itemFilterActive
                ? "text-[#0033CC] font-bold"
                : "text-slate-500"
            }`}
          >
            {visibleSprints.length} of {sprints.length} sprints
          </span>
        </div>
      </div>

      {/* Roadmap timeline */}
      <div className="space-y-6">
        {Object.entries(sprintsByQuarter).map(([quarter, qsprints]) => (
          <div key={quarter} data-testid={`roadmap-quarter-${quarter.replace(/\s+/g, "-")}`}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="font-display font-black text-xl tracking-tighter text-slate-900">
                {quarter}
              </h2>
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                {qsprints.length} sprints
              </span>
            </div>
            <div className="space-y-2">
              {qsprints.map((s) => {
                const sItems = itemsBySprint[s.id] || [];
                return (
                  <div
                    key={s.id}
                    className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold text-sm text-slate-900">
                          {s.name}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {s.start_date} → {s.end_date}
                        </span>
                        <span className="text-xs text-slate-600 max-w-md truncate">
                          {s.goal}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        {sItems.filter((x) => x.status === "Done").length}/
                        {sItems.length} done ·{" "}
                        {sItems.reduce((a, b) => a + b.story_points, 0)} SP
                      </span>
                    </div>
                    {sItems.length > 0 && (
                      <div className="divide-y divide-slate-100">
                        <div className="px-4 py-1.5 flex items-center gap-3 bg-slate-50/70 border-b border-slate-200 text-[9px] font-mono uppercase tracking-widest text-slate-400">
                          <span className="w-14 shrink-0">Ref</span>
                          <span className="flex-1">Item</span>
                          <span className="w-24 shrink-0 text-right">Status</span>
                          <span className="w-16 shrink-0 text-right">Progress</span>
                          <span className="w-[92px] shrink-0 flex items-center gap-1">
                            {["Dev", "AI", "UX", "QA"].map((c) => (
                              <span key={c} className="w-5 text-center">
                                {c}
                              </span>
                            ))}
                          </span>
                          <span className="w-12 shrink-0 text-right">SP</span>
                        </div>
                        {sItems.map((i) => (
                          <div
                            key={i.id}
                            className="px-4 py-2 flex items-center gap-3 text-sm hover:bg-slate-50"
                          >
                            <span className="font-mono text-[10px] font-bold text-slate-500 w-14 shrink-0">
                              {i.wb_ref}
                            </span>
                            <PriorityBadge priority={i.priority} />
                            <SystemBadge system={i.system} />
                            {i.project_id && projectMap[i.project_id] && (
                              <span
                                className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-white font-mono shrink-0"
                                style={{
                                  backgroundColor:
                                    projectMap[i.project_id].color || "#64748B",
                                }}
                                title={`${projectMap[i.project_id].name}${
                                  i.phase ? ` · ${i.phase}` : ""
                                }`}
                              >
                                {projectMap[i.project_id].code || "PRJ"}
                              </span>
                            )}
                            <span className="text-slate-900 font-medium flex-1 truncate">
                              {i.title}
                            </span>
                            <span className="w-24 shrink-0 flex justify-end">
                              <StatusBadge status={i.status} />
                            </span>
                            <div
                              className="w-16 shrink-0 flex items-center gap-1.5"
                              title={`${i.percent_done}% done`}
                            >
                              <div className="flex-1 bg-slate-100 rounded-sm h-1 overflow-hidden">
                                <div
                                  className="h-full"
                                  style={{
                                    width: `${i.percent_done}%`,
                                    backgroundColor:
                                      STATUS_COLORS[i.status]?.dot || "#64748B",
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-slate-500 w-7 text-right">
                                {i.percent_done}%
                              </span>
                            </div>
                            <div className="w-[92px] shrink-0 flex items-center gap-1">
                              <AssigneeChip
                                role="Dev"
                                member={teamMap[i.dev_assignee_id]}
                              />
                              <AssigneeChip
                                role="AI Engineer"
                                member={teamMap[i.data_eng_assignee_id]}
                              />
                              <AssigneeChip
                                role="UI/UX"
                                member={teamMap[i.uiux_assignee_id]}
                              />
                              <AssigneeChip
                                role="QA/QC"
                                member={teamMap[i.qa_assignee_id]}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-700 w-12 shrink-0 text-right">
                              {i.story_points} SP
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One assignee slot on a roadmap line. Empty slots keep the columns aligned. */
function AssigneeChip({ role, member }) {
  if (!member) {
    return (
      <div
        className="w-5 h-5 rounded-sm border border-dashed border-slate-200"
        title={`${role}: unassigned`}
      />
    );
  }
  return (
    <div
      className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white font-mono"
      style={{ backgroundColor: member.avatar_color || "#64748B" }}
      title={`${role}: ${member.name}`}
    >
      {member.name.slice(0, 2).toUpperCase()}
    </div>
  );
}
