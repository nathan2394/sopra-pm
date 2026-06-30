import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchTeam,
  fetchTeamWorkload,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from "@/lib/api";
import { ROLES, SYSTEMS } from "@/lib/constants";
import { SystemBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Plus, PencilSimple, Trash, Info } from "@phosphor-icons/react";

const emptyMember = {
  name: "",
  role: "Backend Dev",
  email: "",
  areas: [],
  rules: "",
  capacity_sp: 20,
  avatar_color: "#0033CC",
};

const COLORS = [
  "#0033CC",
  "#7C3AED",
  "#0369A1",
  "#047857",
  "#B91C1C",
  "#D97706",
  "#BE185D",
  "#4338CA",
  "#854D0E",
  "#0F766E",
];

export default function Team() {
  const [workload, setWorkload] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyMember);

  const load = async () => {
    const w = await fetchTeamWorkload();
    setWorkload(w);
  };
  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyMember, avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)] });
    setOpen(true);
  };
  const openEdit = async (id) => {
    const team = await fetchTeam();
    const m = team.find((x) => x.id === id);
    setEditing(m);
    setForm({ ...m, email: m.email || "", rules: m.rules || "" });
    setOpen(true);
  };
  const save = async () => {
    try {
      const payload = {
        ...form,
        capacity_sp: parseInt(form.capacity_sp) || 0,
        email: form.email || null,
        rules: form.rules || null,
      };
      if (editing) {
        await updateTeamMember(editing.id, payload);
        toast.success("Member updated");
      } else {
        await createTeamMember(payload);
        toast.success("Member added");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error("Save failed");
    }
  };
  const del = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    await deleteTeamMember(id);
    toast.success("Removed");
    load();
  };

  const toggleArea = (a) => {
    setForm((f) => ({
      ...f,
      areas: f.areas.includes(a)
        ? f.areas.filter((x) => x !== a)
        : [...f.areas, a],
    }));
  };

  const byRole = workload.reduce((acc, m) => {
    (acc[m.role] = acc[m.role] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="team-page">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          <span className="font-mono font-bold text-slate-900">{workload.length}</span>{" "}
          team members across {Object.keys(byRole).length} roles
        </div>
        <Button
          onClick={openCreate}
          className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3] h-9"
          data-testid="btn-add-member"
        >
          <Plus size={16} weight="bold" className="mr-1" /> Add Member
        </Button>
      </div>

      {Object.entries(byRole).map(([role, members]) => (
        <div key={role}>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            {role} · {members.length}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => (
              <div
                key={m.id}
                className="bg-white border border-slate-200 rounded-sm p-4 hover:border-[#0033CC] transition-colors"
                data-testid={`member-card-${m.id}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-sm flex items-center justify-center text-sm font-bold text-white font-mono shrink-0"
                    style={{ backgroundColor: m.avatar_color || "#0033CC" }}
                  >
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-base text-slate-900 leading-tight">
                      {m.name}
                    </div>
                    <div className="text-xs text-slate-500">{m.role}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(m.id)}
                      className="p-1.5 hover:bg-slate-100 rounded-sm text-slate-500"
                      data-testid={`edit-member-${m.id}`}
                    >
                      <PencilSimple size={14} />
                    </button>
                    <button
                      onClick={() => del(m.id, m.name)}
                      className="p-1.5 hover:bg-red-50 rounded-sm text-slate-500 hover:text-red-600"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>

                {m.areas?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {m.areas.map((a) =>
                      SYSTEMS.includes(a) ? (
                        <SystemBadge key={a} system={a} />
                      ) : (
                        <span
                          key={a}
                          className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold bg-slate-100 text-slate-700"
                        >
                          {a}
                        </span>
                      ),
                    )}
                  </div>
                )}

                {m.rules && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-sm p-2 mb-3">
                    <Info size={12} className="mt-0.5 text-amber-600 shrink-0" />
                    <span>{m.rules}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Mini label="Items" value={m.dev_items + m.qa_items} />
                  <Mini label="In Prog" value={m.in_progress} />
                  <Mini label="Done SP" value={m.done_sp} />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">
                    <span>Utilization</span>
                    <span className="font-bold text-slate-900">
                      {m.utilization_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-sm h-2 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(m.utilization_pct, 100)}%`,
                        backgroundColor:
                          m.utilization_pct > 100
                            ? "#DC2626"
                            : m.utilization_pct > 80
                              ? "#D97706"
                              : "#0033CC",
                      }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    {m.assigned_sp} / {m.capacity_sp} SP capacity
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight">
              {editing ? `Edit ${editing.name}` : "New Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-sm"
                data-testid="member-name"
              />
            </Field>
            <Field label="Role">
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-sm"
              />
            </Field>
            <Field label="Capacity (SP / sprint)">
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
              <Field label="System Ownership">
                <div className="flex flex-wrap gap-2">
                  {SYSTEMS.map((a) => {
                    const sel = form.areas.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleArea(a)}
                        className={`px-2.5 py-1 rounded-sm text-xs font-semibold border transition-colors ${
                          sel
                            ? "bg-[#0033CC] text-white border-[#0033CC]"
                            : "bg-white text-slate-700 border-slate-200 hover:border-[#0033CC]"
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Rules / Constraints">
                <Textarea
                  value={form.rules}
                  onChange={(e) => setForm({ ...form, rules: e.target.value })}
                  rows={2}
                  className="rounded-sm"
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Avatar Color">
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, avatar_color: c })}
                      className={`w-7 h-7 rounded-sm border-2 ${
                        form.avatar_color === c
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
              data-testid="member-save"
            >
              {editing ? "Save changes" : "Add member"}
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
