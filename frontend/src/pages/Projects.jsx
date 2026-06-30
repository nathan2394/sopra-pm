import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  fetchProjects,
  fetchBacklog,
  fetchTeam,
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/api";
import {
  SYSTEMS,
  PROJECT_STATUSES,
  PROJECT_COLORS,
} from "@/lib/constants";
import { SystemBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  PencilSimple,
  Trash,
  Stack,
  ArrowRight,
} from "@phosphor-icons/react";

const emptyProject = {
  name: "",
  code: "",
  description: "",
  system: "",
  owner_id: "",
  color: "#0033CC",
  status: "Active",
};

const STATUS_COLOR = {
  Active: { bg: "#DBEAFE", text: "#1E40AF", dot: "#0033CC" },
  Paused: { bg: "#FEF3C7", text: "#92400E", dot: "#D97706" },
  Completed: { bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
  Archived: { bg: "#F1F5F9", text: "#475569", dot: "#64748B" },
};

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProject);

  const load = async () => {
    const [p, b, t] = await Promise.all([
      fetchProjects(),
      fetchBacklog(),
      fetchTeam(),
    ]);
    setProjects(p);
    setItems(b);
    setTeam(t);
  };
  useEffect(() => {
    load();
  }, []);

  const teamMap = useMemo(
    () => Object.fromEntries(team.map((m) => [m.id, m])),
    [team],
  );

  const stats = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      map[p.id] = {
        items: 0,
        total_sp: 0,
        done_sp: 0,
        phases: new Set(),
      };
    });
    items.forEach((i) => {
      if (!i.project_id || !map[i.project_id]) return;
      const s = map[i.project_id];
      s.items += 1;
      s.total_sp += i.story_points;
      if (i.status === "Done") s.done_sp += i.story_points;
      if (i.phase) s.phases.add(i.phase);
    });
    return map;
  }, [projects, items]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyProject,
      color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
    });
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      ...p,
      code: p.code || "",
      description: p.description || "",
      system: p.system || "",
      owner_id: p.owner_id || "",
    });
    setOpen(true);
  };
  const save = async () => {
    try {
      const payload = {
        ...form,
        code: form.code || null,
        description: form.description || null,
        system: form.system || null,
        owner_id: form.owner_id || null,
      };
      if (editing) {
        await updateProject(editing.id, payload);
        toast.success("Project updated");
      } else {
        await createProject(payload);
        toast.success("Project created");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error("Save failed");
    }
  };
  const del = async (p) => {
    if (
      !window.confirm(
        `Delete project "${p.name}"? Backlog items will be unlinked (not deleted).`,
      )
    )
      return;
    await deleteProject(p.id);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-4" data-testid="projects-page">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          <span className="font-mono font-bold text-slate-900">
            {projects.length}
          </span>{" "}
          projects · grouping container for multi-phase deliverables
        </div>
        <Button
          onClick={openCreate}
          className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3] h-9"
          data-testid="btn-add-project"
        >
          <Plus size={16} weight="bold" className="mr-1" /> New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => {
          const s = stats[p.id] || { items: 0, total_sp: 0, done_sp: 0, phases: new Set() };
          const sc = STATUS_COLOR[p.status] || STATUS_COLOR.Active;
          const pct =
            s.total_sp > 0 ? Math.round((s.done_sp / s.total_sp) * 100) : 0;
          return (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-[#0033CC] transition-colors"
              data-testid={`project-card-${p.code || p.id}`}
            >
              <div
                className="h-1.5"
                style={{ backgroundColor: p.color || "#0033CC" }}
              />
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-sm flex items-center justify-center text-xs font-bold text-white font-mono"
                      style={{ backgroundColor: p.color || "#0033CC" }}
                    >
                      {p.code || p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-display font-bold text-base text-slate-900 leading-tight">
                        {p.name}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-0.5">
                        {p.code || "—"} · {teamMap[p.owner_id]?.name || "No owner"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 hover:bg-slate-100 rounded-sm text-slate-500"
                      data-testid={`edit-project-${p.code || p.id}`}
                    >
                      <PencilSimple size={14} />
                    </button>
                    <button
                      onClick={() => del(p)}
                      className="p-1.5 hover:bg-red-50 rounded-sm text-slate-500 hover:text-red-600"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-semibold"
                    style={{ backgroundColor: sc.bg, color: sc.text }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: sc.dot }}
                    />
                    {p.status}
                  </span>
                  {p.system && <SystemBadge system={p.system} />}
                </div>

                {p.description && (
                  <p className="text-xs text-slate-600 mb-3 line-clamp-3">
                    {p.description}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Mini label="Phases" value={s.phases.size} />
                  <Mini label="Items" value={s.items} />
                  <Mini label="SP" value={`${s.done_sp}/${s.total_sp}`} />
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">
                    <span>Progress</span>
                    <span className="font-bold text-slate-900">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-sm h-1.5 overflow-hidden">
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
                </div>

                <button
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="w-full text-xs font-semibold text-[#0033CC] hover:text-[#0028A3] flex items-center justify-center gap-1 py-2 border border-slate-200 rounded-sm hover:bg-slate-50"
                  data-testid={`open-project-${p.code || p.id}`}
                >
                  <Stack size={14} />
                  Open project board
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-xl" data-testid="project-dialog">
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight">
              {editing ? `Edit ${editing.name}` : "New Project"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Sopra Cash Engine"
                  className="rounded-sm"
                  data-testid="project-name"
                />
              </Field>
            </div>
            <Field label="Code (short)">
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="SCE"
                maxLength={6}
                className="rounded-sm font-mono uppercase"
                data-testid="project-code"
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="System (default tag)">
              <Select
                value={form.system || "_none"}
                onValueChange={(v) =>
                  setForm({ ...form, system: v === "_none" ? "" : v })
                }
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="— none —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— none —</SelectItem>
                  {SYSTEMS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Owner (PM / Lead)">
              <Select
                value={form.owner_id || "_none"}
                onValueChange={(v) =>
                  setForm({ ...form, owner_id: v === "_none" ? "" : v })
                }
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="— unassigned —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— unassigned —</SelectItem>
                  {team.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="Description">
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Phase 1: ...\nPhase 2: ...\nPhase 3: ..."
                  className="rounded-sm"
                  data-testid="project-description"
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Color">
                <div className="flex gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-sm border-2 ${
                        form.color === c
                          ? "border-slate-900"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </Field>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3]"
              data-testid="project-save"
            >
              {editing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-sm py-1.5 text-center">
      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="font-mono font-bold text-sm text-slate-900">{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
        {label}
      </Label>
      {children}
    </div>
  );
}
