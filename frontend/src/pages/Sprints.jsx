import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchSprints,
  fetchSprintVelocity,
  createSprint,
  updateSprint,
  deleteSprint,
} from "@/lib/api";
import { SPRINT_STATUSES } from "@/lib/constants";
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
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";

const emptySprint = {
  sprint_number: 1,
  name: "",
  quarter: "Q3 2026",
  start_date: "",
  end_date: "",
  goal: "",
  status: "Planned",
  capacity_sp: 30,
};

const STATUS_COLOR = {
  Planned: { bg: "#F1F5F9", text: "#475569", dot: "#64748B" },
  Active: { bg: "#DBEAFE", text: "#1E40AF", dot: "#0033CC" },
  Completed: { bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
};

export default function Sprints() {
  const [sprints, setSprints] = useState([]);
  const [velocity, setVelocity] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptySprint);

  const load = async () => {
    const [s, v] = await Promise.all([fetchSprints(), fetchSprintVelocity()]);
    setSprints(s);
    setVelocity(v);
  };
  useEffect(() => {
    load();
  }, []);

  const veloMap = Object.fromEntries(velocity.map((v) => [v.sprint_id, v]));

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptySprint,
      sprint_number: (sprints[sprints.length - 1]?.sprint_number || 0) + 1,
      name: `Sprint ${(sprints[sprints.length - 1]?.sprint_number || 0) + 1}`,
    });
    setOpen(true);
  };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...s });
    setOpen(true);
  };
  const save = async () => {
    try {
      const payload = {
        ...form,
        sprint_number: parseInt(form.sprint_number) || 1,
        capacity_sp: parseInt(form.capacity_sp) || 0,
      };
      if (editing) {
        await updateSprint(editing.id, payload);
        toast.success("Sprint updated");
      } else {
        await createSprint(payload);
        toast.success("Sprint created");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error("Save failed");
    }
  };
  const del = async (s) => {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    await deleteSprint(s.id);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-4" data-testid="sprints-page">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          <span className="font-mono font-bold text-slate-900">{sprints.length}</span>{" "}
          sprints across the roadmap
        </div>
        <Button
          onClick={openCreate}
          className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3] h-9"
          data-testid="btn-add-sprint"
        >
          <Plus size={16} weight="bold" className="mr-1" /> New Sprint
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sprints.map((s) => {
          const v = veloMap[s.id] || { planned_sp: 0, completed_sp: 0, items: 0 };
          const sc = STATUS_COLOR[s.status] || STATUS_COLOR.Planned;
          const pct =
            v.planned_sp > 0
              ? Math.round((v.completed_sp / v.planned_sp) * 100)
              : 0;
          return (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-sm p-4 hover:border-[#0033CC] transition-colors"
              data-testid={`sprint-card-${s.sprint_number}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    {s.quarter}
                  </div>
                  <div className="font-display font-black text-xl tracking-tight text-slate-900 mt-0.5">
                    {s.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    {s.start_date} → {s.end_date}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-semibold"
                    style={{ backgroundColor: sc.bg, color: sc.text }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: sc.dot }}
                    />
                    {s.status}
                  </span>
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1.5 hover:bg-slate-100 rounded-sm text-slate-500 hover:text-slate-900"
                    data-testid={`edit-sprint-${s.sprint_number}`}
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    onClick={() => del(s)}
                    className="p-1.5 hover:bg-red-50 rounded-sm text-slate-500 hover:text-red-600"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
              {s.goal && (
                <div className="text-xs text-slate-700 mb-3 line-clamp-2">{s.goal}</div>
              )}
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <Mini label="Planned" value={`${v.planned_sp} SP`} />
                <Mini label="Done" value={`${v.completed_sp} SP`} />
                <Mini label="Items" value={v.items} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500">
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
                <div className="text-[10px] font-mono text-slate-500 mt-1">
                  Capacity: {s.capacity_sp} SP · Load:{" "}
                  {s.capacity_sp > 0
                    ? Math.round((v.planned_sp / s.capacity_sp) * 100)
                    : 0}
                  %
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight">
              {editing ? `Edit ${editing.name}` : "New Sprint"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sprint #">
              <Input
                type="number"
                value={form.sprint_number}
                onChange={(e) =>
                  setForm({ ...form, sprint_number: e.target.value })
                }
                className="rounded-sm font-mono"
                data-testid="sprint-number"
              />
            </Field>
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-sm"
                data-testid="sprint-name"
              />
            </Field>
            <Field label="Quarter">
              <Select
                value={form.quarter}
                onValueChange={(v) => setForm({ ...form, quarter: v })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027"].map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {SPRINT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start Date">
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
                className="rounded-sm font-mono"
              />
            </Field>
            <Field label="End Date">
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="rounded-sm font-mono"
              />
            </Field>
            <Field label="Capacity (SP)">
              <Input
                type="number"
                value={form.capacity_sp}
                onChange={(e) =>
                  setForm({ ...form, capacity_sp: e.target.value })
                }
                className="rounded-sm font-mono"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Goal">
                <Textarea
                  value={form.goal || ""}
                  onChange={(e) => setForm({ ...form, goal: e.target.value })}
                  rows={2}
                  className="rounded-sm"
                  data-testid="sprint-goal"
                />
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
              data-testid="sprint-save"
            >
              {editing ? "Save changes" : "Create sprint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-sm py-1.5">
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
