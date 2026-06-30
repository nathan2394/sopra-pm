import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  fetchBacklog,
  fetchTeam,
  fetchSprints,
  fetchProjects,
  createBacklogItem,
  updateBacklogItem,
  deleteBacklogItem,
} from "@/lib/api";
import {
  PRIORITIES,
  STATUSES,
  SYSTEMS,
  PRIORITY_COLORS,
} from "@/lib/constants";
import { PriorityBadge, SystemBadge, StatusBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import ActivityPanel from "@/components/ActivityPanel";
import { getActorId } from "@/lib/currentUser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MagnifyingGlass,
  DotsThreeVertical,
  X,
  PencilSimple,
  Trash,
  CaretDown,
  CaretRight,
  Stack,
  Rows,
} from "@phosphor-icons/react";

const emptyItem = {
  wb_ref: "",
  title: "",
  system: "Internal",
  priority: "P2",
  quarter: "Q3 2026",
  project_id: null,
  phase: "",
  sprint_id: null,
  dev_assignee_id: null,
  qa_assignee_id: null,
  story_points: 0,
  status: "Backlog",
  notes: "",
};

export default function Backlog() {
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupByProject, setGroupByProject] = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [filters, setFilters] = useState({
    priority: "all",
    system: "all",
    quarter: "all",
    status: "all",
    sprint_id: "all",
    project_id: "all",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);

  const loadAll = async () => {
    setLoading(true);
    const [b, t, s, p] = await Promise.all([
      fetchBacklog(),
      fetchTeam(),
      fetchSprints(),
      fetchProjects(),
    ]);
    setItems(b);
    setTeam(t);
    setSprints(s);
    setProjects(p);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const quarters = useMemo(
    () => Array.from(new Set(items.map((i) => i.quarter))).sort(),
    [items],
  );

  const teamMap = useMemo(
    () => Object.fromEntries(team.map((t) => [t.id, t])),
    [team],
  );
  const sprintMap = useMemo(
    () => Object.fromEntries(sprints.map((s) => [s.id, s])),
    [sprints],
  );
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filters.priority !== "all" && i.priority !== filters.priority) return false;
      if (filters.system !== "all" && i.system !== filters.system) return false;
      if (filters.quarter !== "all" && i.quarter !== filters.quarter) return false;
      if (filters.status !== "all" && i.status !== filters.status) return false;
      if (filters.sprint_id !== "all" && i.sprint_id !== filters.sprint_id) return false;
      if (filters.project_id !== "all") {
        if (filters.project_id === "_none" && i.project_id) return false;
        if (filters.project_id !== "_none" && i.project_id !== filters.project_id) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !i.title.toLowerCase().includes(q) &&
          !i.wb_ref.toLowerCase().includes(q) &&
          !(i.notes || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [items, filters, search]);

  // Group items: project -> phase -> items
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((i) => {
      const pkey = i.project_id || "_unassigned";
      if (!map[pkey]) {
        map[pkey] = { project: projectMap[i.project_id] || null, phases: {} };
      }
      const phkey = i.phase || "Unphased";
      (map[pkey].phases[phkey] = map[pkey].phases[phkey] || []).push(i);
    });
    // Sort phases alphabetically
    Object.values(map).forEach((g) => {
      g.phaseList = Object.entries(g.phases).sort(([a], [b]) => a.localeCompare(b));
      g.totalSp = Object.values(g.phases)
        .flat()
        .reduce((a, b) => a + b.story_points, 0);
      g.totalItems = Object.values(g.phases).flat().length;
      g.doneSp = Object.values(g.phases)
        .flat()
        .reduce((a, b) => (b.status === "Done" ? a + b.story_points : a), 0);
    });
    // Sort projects: real projects first by name, then _unassigned
    const entries = Object.entries(map).sort(([ka, va], [kb, vb]) => {
      if (ka === "_unassigned") return 1;
      if (kb === "_unassigned") return -1;
      return (va.project?.name || "").localeCompare(vb.project?.name || "");
    });
    return entries;
  }, [filtered, projectMap]);

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== "all");

  const openCreate = (presets = {}) => {
    setEditing(null);
    setForm({
      ...emptyItem,
      wb_ref: `WB-${String(items.length + 50).padStart(2, "0")}`,
      ...presets,
    });
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...emptyItem, ...item, phase: item.phase || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        story_points: parseInt(form.story_points) || 0,
        sprint_id: form.sprint_id || null,
        project_id: form.project_id || null,
        phase: form.phase || null,
        dev_assignee_id: form.dev_assignee_id || null,
        qa_assignee_id: form.qa_assignee_id || null,
      };
      if (editing) {
        await updateBacklogItem(editing.id, payload, getActorId() || undefined);
        toast.success("Item updated");
      } else {
        await createBacklogItem(payload);
        toast.success("Item created");
      }
      setDialogOpen(false);
      loadAll();
    } catch (e) {
      toast.error("Save failed: " + (e?.message || "unknown"));
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete ${item.wb_ref} – ${item.title}?`)) return;
    await deleteBacklogItem(item.id);
    toast.success("Deleted");
    loadAll();
  };

  const updateStatus = async (item, status) => {
    await updateBacklogItem(item.id, { status }, getActorId() || undefined);
    toast.success(`Moved to ${status}`);
    loadAll();
  };

  const toggleCollapsed = (key) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  return (
    <div className="space-y-4" data-testid="backlog-page">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              placeholder="Search WB ref, title, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-sm"
              data-testid="backlog-search"
            />
          </div>

          <FilterSelect
            value={filters.project_id}
            onChange={(v) => setFilters((f) => ({ ...f, project_id: v }))}
            options={[
              { value: "all", label: "All projects" },
              { value: "_none", label: "— No project —" },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
            testId="filter-project"
            width="w-44"
          />
          <FilterSelect
            value={filters.priority}
            onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
            options={[
              { value: "all", label: "All priorities" },
              ...PRIORITIES.map((p) => ({ value: p, label: p })),
            ]}
            testId="filter-priority"
          />
          <FilterSelect
            value={filters.system}
            onChange={(v) => setFilters((f) => ({ ...f, system: v }))}
            options={[
              { value: "all", label: "All systems" },
              ...SYSTEMS.map((s) => ({ value: s, label: s })),
            ]}
            testId="filter-system"
          />
          <FilterSelect
            value={filters.quarter}
            onChange={(v) => setFilters((f) => ({ ...f, quarter: v }))}
            options={[
              { value: "all", label: "All quarters" },
              ...quarters.map((q) => ({ value: q, label: q })),
            ]}
            testId="filter-quarter"
          />
          <FilterSelect
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={[
              { value: "all", label: "All status" },
              ...STATUSES.map((s) => ({ value: s, label: s })),
            ]}
            testId="filter-status"
          />

          <button
            onClick={() => setGroupByProject((g) => !g)}
            className={`h-9 px-3 rounded-sm border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              groupByProject
                ? "bg-[#0033CC] text-white border-[#0033CC]"
                : "bg-white text-slate-700 border-slate-200 hover:border-[#0033CC]"
            }`}
            data-testid="toggle-group-project"
            title="Group by project"
          >
            {groupByProject ? <Stack size={14} /> : <Rows size={14} />}
            {groupByProject ? "Grouped" : "Flat"}
          </button>

          <Button
            onClick={() => openCreate()}
            className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3] h-9"
            data-testid="btn-add-backlog"
          >
            <Plus size={16} weight="bold" className="mr-1" />
            New Item
          </Button>
        </div>

        {activeFilters.length > 0 && (
          <div
            className="flex items-center gap-2 flex-wrap"
            data-testid="active-filters"
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Active filters:
            </span>
            {activeFilters.map(([k, v]) => (
              <button
                key={k}
                onClick={() => setFilters((f) => ({ ...f, [k]: "all" }))}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-sm text-xs font-semibold text-slate-700"
                data-testid={`chip-${k}`}
              >
                {k}:{" "}
                {k === "sprint_id"
                  ? sprintMap[v]?.name
                  : k === "project_id"
                    ? v === "_none"
                      ? "No project"
                      : projectMap[v]?.name
                    : v}
                <X size={12} />
              </button>
            ))}
            <button
              onClick={() =>
                setFilters({
                  priority: "all",
                  system: "all",
                  quarter: "all",
                  status: "all",
                  sprint_id: "all",
                  project_id: "all",
                })
              }
              className="text-xs text-[#0033CC] font-semibold hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Flat or Grouped View */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-sm p-12 text-center text-slate-400">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-sm p-12 text-center text-slate-400">
          No items match the filters
        </div>
      ) : groupByProject ? (
        <div className="space-y-4" data-testid="backlog-grouped">
          {grouped.map(([key, g]) => {
            const isCollapsed = collapsed[key];
            const projectColor = g.project?.color || "#94A3B8";
            const pct =
              g.totalSp > 0 ? Math.round((g.doneSp / g.totalSp) * 100) : 0;
            return (
              <div
                key={key}
                className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                data-testid={`project-group-${g.project?.code || "unassigned"}`}
              >
                <div
                  className="h-1"
                  style={{ backgroundColor: projectColor }}
                />
                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 hover:bg-slate-50">
                  <button
                    onClick={() => toggleCollapsed(key)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    {isCollapsed ? (
                      <CaretRight size={14} weight="bold" />
                    ) : (
                      <CaretDown size={14} weight="bold" />
                    )}
                    <div
                      className="w-7 h-7 rounded-sm flex items-center justify-center text-[10px] font-bold text-white font-mono shrink-0"
                      style={{ backgroundColor: projectColor }}
                    >
                      {g.project?.code ||
                        (g.project ? g.project.name.slice(0, 2).toUpperCase() : "—")}
                    </div>
                    <div>
                      <div className="font-display font-bold text-base text-slate-900 leading-tight">
                        {g.project?.name || "Unassigned items"}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-0.5">
                        {g.phaseList.length} phase
                        {g.phaseList.length !== 1 ? "s" : ""} ·{" "}
                        {g.totalItems} items · {g.doneSp}/{g.totalSp} SP ·{" "}
                        {pct}%
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-slate-100 rounded-sm h-1.5 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            pct >= 100
                              ? "#059669"
                              : pct >= 50
                                ? "#0033CC"
                                : "#D97706",
                        }}
                      />
                    </div>
                    {g.project && (
                      <Link
                        to={`/projects/${g.project.id}`}
                        className="text-xs font-semibold text-[#0033CC] hover:underline px-2 py-1 rounded-sm hover:bg-slate-100"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                </div>
                {!isCollapsed && (
                  <div>
                    {g.phaseList.map(([phase, phItems]) => {
                      const phSp = phItems.reduce(
                        (a, b) => a + b.story_points,
                        0,
                      );
                      const phDoneSp = phItems.reduce(
                        (a, b) => (b.status === "Done" ? a + b.story_points : a),
                        0,
                      );
                      const phPct = phSp > 0 ? Math.round((phDoneSp / phSp) * 100) : 0;
                      return (
                        <div key={phase} className="border-t border-slate-100">
                          <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold">
                                {phase}
                              </span>
                              <span className="text-xs text-slate-500">
                                · {phItems.length} item
                                {phItems.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                {phDoneSp}/{phSp} SP · {phPct}%
                              </span>
                              {g.project && (
                                <button
                                  onClick={() =>
                                    openCreate({
                                      project_id: g.project.id,
                                      phase: phase === "Unphased" ? "" : phase,
                                      system: g.project.system || "Internal",
                                    })
                                  }
                                  className="text-[10px] font-mono uppercase tracking-widest text-[#0033CC] hover:underline"
                                >
                                  + add
                                </button>
                              )}
                            </div>
                          </div>
                          <ItemsTable
                            items={phItems}
                            teamMap={teamMap}
                            sprintMap={sprintMap}
                            onEdit={openEdit}
                            onStatus={updateStatus}
                            onDelete={handleDelete}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <ItemsTable
            items={filtered}
            teamMap={teamMap}
            sprintMap={sprintMap}
            projectMap={projectMap}
            showProject
            onEdit={openEdit}
            onStatus={updateStatus}
            onDelete={handleDelete}
          />
          <div className="border-t border-slate-200 px-4 py-2 flex justify-between text-xs text-slate-500 bg-slate-50">
            <span>
              <span className="font-semibold text-slate-900">
                {filtered.length}
              </span>{" "}
              / {items.length} items
            </span>
            <span>
              Total SP:{" "}
              <span className="font-mono font-bold text-slate-900">
                {filtered.reduce((a, b) => a + b.story_points, 0)}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="rounded-sm max-w-2xl max-h-[90vh] overflow-y-auto"
          data-testid="item-dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight">
              {editing ? `Edit ${editing.wb_ref}` : "New Backlog Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                WB Ref
              </Label>
              <Input
                value={form.wb_ref}
                onChange={(e) => setForm({ ...form, wb_ref: e.target.value })}
                className="rounded-sm font-mono"
                data-testid="form-wb-ref"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Story Points
              </Label>
              <Input
                type="number"
                value={form.story_points}
                onChange={(e) =>
                  setForm({ ...form, story_points: e.target.value })
                }
                className="rounded-sm font-mono"
                data-testid="form-sp"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Title
              </Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-sm"
                data-testid="form-title"
              />
            </div>

            <SelectField
              label="Project"
              value={form.project_id || "_none"}
              onChange={(v) =>
                setForm({ ...form, project_id: v === "_none" ? null : v })
              }
              options={[
                { value: "_none", label: "— No project —" },
                ...projects.map((p) => ({
                  value: p.id,
                  label: `${p.code || ""} · ${p.name}`.trim(),
                })),
              ]}
              testId="form-project"
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Phase (within project)
              </Label>
              <Input
                value={form.phase || ""}
                onChange={(e) => setForm({ ...form, phase: e.target.value })}
                placeholder="e.g. Phase 1, Phase 2"
                className="rounded-sm"
                disabled={!form.project_id}
                data-testid="form-phase"
              />
            </div>

            <SelectField
              label="System"
              value={form.system}
              onChange={(v) => setForm({ ...form, system: v })}
              options={SYSTEMS.map((s) => ({ value: s, label: s }))}
              testId="form-system"
            />
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(v) => setForm({ ...form, priority: v })}
              options={PRIORITIES.map((p) => ({
                value: p,
                label: `${p} – ${PRIORITY_COLORS[p].label}`,
              }))}
              testId="form-priority"
            />
            <SelectField
              label="Quarter"
              value={form.quarter}
              onChange={(v) => setForm({ ...form, quarter: v })}
              options={["Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027"].map((q) => ({
                value: q,
                label: q,
              }))}
              testId="form-quarter"
            />
            <SelectField
              label="Sprint"
              value={form.sprint_id || "_none"}
              onChange={(v) =>
                setForm({ ...form, sprint_id: v === "_none" ? null : v })
              }
              options={[
                { value: "_none", label: "— No sprint —" },
                ...sprints.map((s) => ({
                  value: s.id,
                  label: `${s.name} · ${s.quarter}`,
                })),
              ]}
              testId="form-sprint"
            />
            <SelectField
              label="Dev Assignee"
              value={form.dev_assignee_id || "_none"}
              onChange={(v) =>
                setForm({ ...form, dev_assignee_id: v === "_none" ? null : v })
              }
              options={[
                { value: "_none", label: "— Unassigned —" },
                ...team
                  .filter(
                    (t) => t.role === "Backend Dev" || t.role === "Product Manager",
                  )
                  .map((t) => ({
                    value: t.id,
                    label: `${t.name} · ${t.role}`,
                  })),
              ]}
              testId="form-dev"
            />
            <SelectField
              label="QA Assignee"
              value={form.qa_assignee_id || "_none"}
              onChange={(v) =>
                setForm({ ...form, qa_assignee_id: v === "_none" ? null : v })
              }
              options={[
                { value: "_none", label: "— Unassigned —" },
                ...team
                  .filter((t) => t.role === "QA")
                  .map((t) => ({ value: t.id, label: t.name })),
              ]}
              testId="form-qa"
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={STATUSES.map((s) => ({ value: s, label: s }))}
              testId="form-status"
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                % Done
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.percent_done || 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    percent_done: parseInt(e.target.value) || 0,
                  })
                }
                className="rounded-sm font-mono"
                data-testid="form-percent"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Notes / Rules
              </Label>
              <Textarea
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="rounded-sm"
                rows={2}
                data-testid="form-notes"
              />
            </div>
          </div>

          {editing && (
            <ActivityPanel
              itemId={editing.id}
              teamMap={teamMap}
              sprintMap={sprintMap}
              projectMap={projectMap}
            />
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-sm"
              data-testid="form-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3]"
              data-testid="form-save"
            >
              {editing ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemsTable({
  items,
  teamMap,
  sprintMap,
  projectMap,
  showProject = false,
  onEdit,
  onStatus,
  onDelete,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" data-testid="backlog-table">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            <th className="text-left px-4 py-2.5 font-semibold">Ref</th>
            <th className="text-left px-4 py-2.5 font-semibold">Title</th>
            {showProject && (
              <th className="text-left px-4 py-2.5 font-semibold">Project</th>
            )}
            <th className="text-left px-4 py-2.5 font-semibold">System</th>
            <th className="text-left px-4 py-2.5 font-semibold">Prio</th>
            <th className="text-left px-4 py-2.5 font-semibold">Sprint</th>
            <th className="text-left px-4 py-2.5 font-semibold">Dev</th>
            <th className="text-left px-4 py-2.5 font-semibold">QA</th>
            <th className="text-right px-4 py-2.5 font-semibold">SP</th>
            <th className="text-left px-4 py-2.5 font-semibold">Status</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr
              key={i.id}
              className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              data-testid={`backlog-row-${i.wb_ref}`}
            >
              <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-600">
                {i.wb_ref}
              </td>
              <td className="px-4 py-2.5">
                <button
                  onClick={() => onEdit(i)}
                  className="text-sm font-semibold text-slate-900 hover:text-[#0033CC] text-left"
                  data-testid={`edit-${i.wb_ref}`}
                >
                  {i.title}
                </button>
                {i.notes && (
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {i.notes}
                  </div>
                )}
              </td>
              {showProject && (
                <td className="px-4 py-2.5">
                  {i.project_id && projectMap?.[i.project_id] ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.5 rounded-sm text-[10px] font-bold text-white font-mono"
                        style={{
                          backgroundColor: projectMap[i.project_id].color,
                        }}
                      >
                        {projectMap[i.project_id].code || "—"}
                      </span>
                      {i.phase && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          · {i.phase}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              )}
              <td className="px-4 py-2.5">
                <SystemBadge system={i.system} />
              </td>
              <td className="px-4 py-2.5">
                <PriorityBadge priority={i.priority} />
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                {sprintMap[i.sprint_id]?.name || "—"}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-700">
                {teamMap[i.dev_assignee_id]?.name || (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-700">
                {teamMap[i.qa_assignee_id]?.name || (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold">
                {i.story_points}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={i.status} />
              </td>
              <td className="px-2 py-2.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1 hover:bg-slate-200 rounded-sm"
                      data-testid={`row-menu-${i.wb_ref}`}
                    >
                      <DotsThreeVertical size={16} weight="bold" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(i)}>
                      <PencilSimple size={14} className="mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {STATUSES.filter((s) => s !== i.status).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => onStatus(i, s)}
                      >
                        Move to {s}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(i)}
                      className="text-red-600"
                    >
                      <Trash size={14} className="mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterSelect({ value, onChange, options, testId, width = "w-40" }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 rounded-sm ${width}`} data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SelectField({ label, value, onChange, options, testId }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-sm" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
