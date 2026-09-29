import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchDailyTasks, fetchProjects, fetchTeam, updateTask } from "@/lib/api";
import { STATUSES, STATUS_COLORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Warning } from "@phosphor-icons/react";

/** Local date parts — toISOString() would shift the day at WIB (+07:00). */
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

export default function DailyTasks() {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(isoToday());
  const [memberId, setMemberId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    Promise.all([fetchTeam(), fetchProjects()]).then(([t, p]) => {
      setTeam(t);
      setProjects(p);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDailyTasks({
      ...(date ? { date } : {}),
      ...(memberId !== "all" ? { member_id: memberId } : {}),
      ...(projectId !== "all" ? { project_id: projectId } : {}),
      ...(status !== "all" ? { status } : {}),
    })
      .then((rows) => !cancelled && setTasks(rows))
      .catch(() => !cancelled && setTasks([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, memberId, projectId, status]);

  // Project -> backlog item -> tasks, which is how the board is read out loud
  // in a stand-up.
  const grouped = useMemo(() => {
    const byProject = new Map();
    tasks.forEach((t) => {
      const pk = t.project_id ?? "none";
      if (!byProject.has(pk)) {
        byProject.set(pk, {
          key: pk,
          name: t.project_name,
          code: t.project_code,
          color: t.project_color,
          items: new Map(),
        });
      }
      const proj = byProject.get(pk);
      if (!proj.items.has(t.backlog_item_id)) {
        proj.items.set(t.backlog_item_id, {
          id: t.backlog_item_id,
          wbRef: t.item_wb_ref,
          title: t.item_title,
          status: t.item_status,
          tasks: [],
        });
      }
      proj.items.get(t.backlog_item_id).tasks.push(t);
    });
    return [...byProject.values()]
      .map((p) => ({ ...p, items: [...p.items.values()] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Per-member tally for the selected day.
  const perMember = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (!map.has(t.assignee_id)) {
        map.set(t.assignee_id, {
          id: t.assignee_id,
          name: t.assignee_name || "—",
          role: t.assignee_role,
          color: t.assignee_color,
          total: 0,
          done: 0,
          blocked: 0,
        });
      }
      const m = map.get(t.assignee_id);
      m.total += 1;
      if (t.status === "Done") m.done += 1;
      if (t.blocker) m.blocked += 1;
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [tasks]);

  const setTaskStatus = async (task, next) => {
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await updateTask(task.id, { status: next });
    } catch {
      setTasks(previous);
      toast.error("Could not update task");
    }
  };

  const filtered = memberId !== "all" || projectId !== "all" || status !== "all" || !!date;

  return (
    <div className="space-y-4" data-testid="daily-page">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Date</div>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`rounded-sm h-9 w-40 font-mono text-xs ${
            date ? "border-[#0033CC] bg-[#0033CC]/5" : ""
          }`}
          data-testid="daily-date"
        />
        <Button
          variant="outline"
          className="rounded-sm h-9 text-xs"
          onClick={() => setDate(isoToday())}
          data-testid="daily-today"
        >
          Today
        </Button>

        <div className="h-6 w-px bg-slate-200" />

        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className={`rounded-sm h-9 text-xs border px-2 bg-white ${
            memberId !== "all" ? "border-[#0033CC] bg-[#0033CC]/5" : "border-slate-200"
          }`}
          data-testid="daily-member"
        >
          <option value="all">All members</option>
          {team.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.name} · {m.role}
            </option>
          ))}
        </select>

        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={`rounded-sm h-9 text-xs border px-2 bg-white ${
            projectId !== "all" ? "border-[#0033CC] bg-[#0033CC]/5" : "border-slate-200"
          }`}
          data-testid="daily-project"
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.code ? `${p.code} · ` : ""}
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`rounded-sm h-9 text-xs border px-2 bg-white ${
            status !== "all" ? "border-[#0033CC] bg-[#0033CC]/5" : "border-slate-200"
          }`}
          data-testid="daily-status"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {filtered && (
          <Button
            variant="ghost"
            className="rounded-sm h-9 text-xs text-slate-500"
            onClick={() => {
              setDate("");
              setMemberId("all");
              setProjectId("all");
              setStatus("all");
            }}
            data-testid="daily-clear"
          >
            Show all
          </Button>
        )}

        <div className="ml-auto text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {tasks.length} tasks · {perMember.length} members
        </div>
      </div>

      {/* Per-member tally */}
      {perMember.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="daily-members">
          {perMember.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-slate-200 rounded-sm px-3 py-2 flex items-center gap-2"
              data-testid={`daily-member-${m.id}`}
            >
              <div
                className="w-6 h-6 rounded-sm flex items-center justify-center text-[9px] font-bold text-white font-mono"
                style={{ backgroundColor: m.color || "#64748B" }}
              >
                {m.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold text-slate-900">{m.name}</div>
                <div className="text-[10px] font-mono text-slate-500">
                  {m.total} tasks · {m.done} done
                  {m.blocked > 0 ? ` · ${m.blocked} blocked` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project -> backlog item -> tasks */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-sm p-8 text-center text-sm text-slate-400">
          Loading…
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-sm p-8 text-center text-sm text-slate-400">
          No tasks {date ? `touched on ${date}` : "found"}.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((proj) => (
            <div key={proj.key} data-testid={`daily-project-${proj.code || proj.key}`}>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-white font-mono"
                  style={{ backgroundColor: proj.color || "#64748B" }}
                >
                  {proj.code || "—"}
                </span>
                <h2 className="font-display font-black text-base tracking-tight text-slate-900">
                  {proj.name}
                </h2>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  {proj.items.reduce((a, i) => a + i.tasks.length, 0)} tasks
                </span>
              </div>

              <div className="space-y-2">
                {proj.items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                  >
                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <span className="font-mono text-[10px] font-bold text-slate-500">
                        {item.wbRef}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {item.title}
                      </span>
                      <div className="flex-1" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        {item.status}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {item.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="px-4 py-2 flex items-center gap-3 text-sm"
                          data-testid={`daily-task-${t.id}`}
                        >
                          <div
                            className="w-5 h-5 rounded-sm shrink-0 flex items-center justify-center text-[9px] font-bold text-white font-mono"
                            style={{ backgroundColor: t.assignee_color || "#64748B" }}
                            title={`${t.assignee_name} · ${t.assignee_role}`}
                          >
                            {(t.assignee_name || "—").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-slate-900 flex-1 truncate">{t.title}</span>

                          {t.blocker && (
                            <span
                              className="flex items-center gap-1 text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-1.5 py-0.5 max-w-xs truncate"
                              title={t.blocker}
                            >
                              <Warning size={11} />
                              {t.blocker}
                            </span>
                          )}

                          <select
                            value={t.status}
                            onChange={(e) => setTaskStatus(t, e.target.value)}
                            className="rounded-sm h-7 text-[11px] border px-1.5 font-mono shrink-0"
                            style={{
                              borderColor: STATUS_COLORS[t.status]?.dot || "#CBD5E1",
                              color: STATUS_COLORS[t.status]?.text || "#475569",
                              backgroundColor: STATUS_COLORS[t.status]?.bg || "#fff",
                            }}
                            data-testid={`daily-task-status-${t.id}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
