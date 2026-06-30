import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  fetchBacklog,
  fetchTeam,
  fetchSprints,
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
} from "@phosphor-icons/react";

const emptyItem = {
  wb_ref: "",
  title: "",
  system: "Internal",
  priority: "P2",
  quarter: "Q3 2026",
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    priority: "all",
    system: "all",
    quarter: "all",
    status: "all",
    sprint_id: "all",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);

  const loadAll = async () => {
    setLoading(true);
    const [b, t, s] = await Promise.all([
      fetchBacklog(),
      fetchTeam(),
      fetchSprints(),
    ]);
    setItems(b);
    setTeam(t);
    setSprints(s);
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

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filters.priority !== "all" && i.priority !== filters.priority) return false;
      if (filters.system !== "all" && i.system !== filters.system) return false;
      if (filters.quarter !== "all" && i.quarter !== filters.quarter) return false;
      if (filters.status !== "all" && i.status !== filters.status) return false;
      if (filters.sprint_id !== "all" && i.sprint_id !== filters.sprint_id) return false;
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

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== "all");

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyItem,
      wb_ref: `WB-${String(items.length + 50).padStart(2, "0")}`,
    });
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        story_points: parseInt(form.story_points) || 0,
        sprint_id: form.sprint_id || null,
        dev_assignee_id: form.dev_assignee_id || null,
        qa_assignee_id: form.qa_assignee_id || null,
      };
      if (editing) {
        await updateBacklogItem(editing.id, payload);
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
    await updateBacklogItem(item.id, { status });
    toast.success(`Moved to ${status}`);
    loadAll();
  };

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

          <Button
            onClick={openCreate}
            className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3] h-9"
            data-testid="btn-add-backlog"
          >
            <Plus size={16} weight="bold" className="mr-1" />
            New Item
          </Button>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap" data-testid="active-filters">
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
                {k}: {k === "sprint_id" ? sprintMap[v]?.name : v}
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
                })
              }
              className="text-xs text-[#0033CC] font-semibold hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="backlog-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                <th className="text-left px-4 py-2.5 font-semibold">Ref</th>
                <th className="text-left px-4 py-2.5 font-semibold">Title</th>
                <th className="text-left px-4 py-2.5 font-semibold">System</th>
                <th className="text-left px-4 py-2.5 font-semibold">Prio</th>
                <th className="text-left px-4 py-2.5 font-semibold">Quarter</th>
                <th className="text-left px-4 py-2.5 font-semibold">Sprint</th>
                <th className="text-left px-4 py-2.5 font-semibold">Dev</th>
                <th className="text-left px-4 py-2.5 font-semibold">QA</th>
                <th className="text-right px-4 py-2.5 font-semibold">SP</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    No items match the filters
                  </td>
                </tr>
              )}
              {filtered.map((i) => (
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
                      onClick={() => openEdit(i)}
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
                  <td className="px-4 py-2.5">
                    <SystemBadge system={i.system} />
                  </td>
                  <td className="px-4 py-2.5">
                    <PriorityBadge priority={i.priority} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                    {i.quarter}
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
                        <DropdownMenuItem onClick={() => openEdit(i)}>
                          <PencilSimple size={14} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {STATUSES.filter((s) => s !== i.status).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => updateStatus(i, s)}
                          >
                            Move to {s}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(i)}
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
        <div className="border-t border-slate-200 px-4 py-2 flex justify-between text-xs text-slate-500 bg-slate-50">
          <span>
            <span className="font-semibold text-slate-900">{filtered.length}</span> /{" "}
            {items.length} items
          </span>
          <span>
            Total SP:{" "}
            <span className="font-mono font-bold text-slate-900">
              {filtered.reduce((a, b) => a + b.story_points, 0)}
            </span>
          </span>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-sm max-w-2xl" data-testid="item-dialog">
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
                  .filter((t) => t.role === "Backend Dev" || t.role === "Product Manager")
                  .map((t) => ({ value: t.id, label: `${t.name} · ${t.role}` })),
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

function FilterSelect({ value, onChange, options, testId }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 rounded-sm w-40" data-testid={testId}>
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
