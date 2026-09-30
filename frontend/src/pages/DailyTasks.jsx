import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchDailyTasks, fetchProjects, fetchTeam, updateTask } from "@/lib/api";
import { TASK_STATUSES, TASK_STATUS_COLORS, taskStatus } from "@/lib/constants";
import TaskStatusToggle from "@/components/TaskStatusToggle";
import { isoToday, isEvening, plural, summarizeByMember } from "@/lib/dailyReport";
import { daysBetween } from "@/lib/insights";
import DailyReportDialog from "@/components/DailyReportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Warning, Moon, X } from "@phosphor-icons/react";

const GROUP_BY = [
  { value: "project", label: "Project" },
  { value: "member", label: "Member" },
  { value: "status", label: "Status" },
];

const GROUP_BY_KEY = "daily-tasks-group-by";

// "day": what was registered or touched on one date (stand-up / today).
// "until": everything created up to a date — the running list of what is
// still open per member and project.
const MODES = [
  { value: "day", label: "Day" },
  { value: "until", label: "Open until" },
];

const createdOn = (t) => (t.created_at || "").slice(0, 10);

const readGroupBy = () => {
  try {
    const v = localStorage.getItem(GROUP_BY_KEY);
    return GROUP_BY.some((g) => g.value === v) ? v : "project";
  } catch {
    return "project";
  }
};

function Avatar({ name, color, size = "w-5 h-5", title }) {
  return (
    <div
      className={`${size} rounded-sm shrink-0 flex items-center justify-center text-[9px] font-bold text-white font-mono`}
      style={{ backgroundColor: color || "#64748B" }}
      title={title}
    >
      {(name || "—").slice(0, 2).toUpperCase()}
    </div>
  );
}

function ProjectTag({ code, color, title }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-white font-mono shrink-0"
      style={{ backgroundColor: color || "#64748B" }}
      title={title}
    >
      {code || "—"}
    </span>
  );
}

/** One task row. Which context columns show depends on how the list is grouped. */
function TaskLine({ task: t, showAssignee = true, showItem = false, showAge = false, onStatus }) {
  const age = showAge && createdOn(t) ? daysBetween(createdOn(t), isoToday()) : null;
  return (
    <div
      className="px-4 py-2 flex items-center gap-3 text-sm"
      data-testid={`daily-task-${t.id}`}
    >
      {showAssignee && (
        <Avatar
          name={t.assignee_name}
          color={t.assignee_color}
          title={`${t.assignee_name} · ${t.assignee_role}`}
        />
      )}
      {showItem && (
        <>
          <ProjectTag code={t.project_code} color={t.project_color} title={t.project_name} />
          <span
            className="font-mono text-[10px] font-bold text-slate-500 shrink-0"
            title={t.item_title}
          >
            {t.item_wb_ref}
          </span>
        </>
      )}
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

      {age != null && t.status !== "Complete" && (
        <span
          className={`text-[10px] font-mono rounded-sm px-1 py-0.5 shrink-0 ${
            age >= 7 ? "bg-amber-50 text-amber-800 font-bold" : "text-slate-500"
          }`}
          title={`Created ${createdOn(t)}`}
          data-testid={`daily-task-age-${t.id}`}
        >
          {age === 0 ? "today" : `${age}d open`}
        </span>
      )}

      <TaskStatusToggle
        status={t.status}
        onChange={(next) => onStatus(t, next)}
        className="w-28"
        testId={`daily-task-status-${t.id}`}
      />
    </div>
  );
}

function GroupHeader({ children, count }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      {children}
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
        {plural(count, "task")}
      </span>
    </div>
  );
}

export default function DailyTasks() {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState("day");
  const [date, setDate] = useState(isoToday());
  const [until, setUntil] = useState(isoToday());
  const [memberId, setMemberId] = useState(null);
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState(null);
  const [groupBy, setGroupBy] = useState(readGroupBy);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    Promise.all([fetchTeam(), fetchProjects()]).then(([t, p]) => {
      setTeam(t);
      setProjects(p);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_BY_KEY, groupBy);
    } catch {
      /* per-viewer convenience only */
    }
  }, [groupBy]);

  // Date and project narrow what is fetched. Member and status are filtered
  // here instead, so their chips keep showing every option with its count.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDailyTasks({
      ...(mode === "day" && date ? { date } : {}),
      ...(projectId !== "all" ? { project_id: projectId } : {}),
    })
      .then((rows) => !cancelled && setTasks(rows.map((t) => ({ ...t, status: taskStatus(t.status) }))))
      .catch(() => !cancelled && setTasks([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mode, date, projectId]);

  const scoped = useMemo(
    () => (mode === "until" ? tasks.filter((t) => createdOn(t) <= until) : tasks),
    [tasks, mode, until],
  );

  // "Hasn't updated" only means something for a single day across every
  // project; otherwise list just the members who have tasks in scope.
  const members = useMemo(() => {
    const all = summarizeByMember(scoped, team);
    return mode === "day" && projectId === "all" && date ? all : all.filter((m) => m.updated);
  }, [scoped, team, mode, projectId, date]);
  const updatedMembers = members.filter((m) => m.updated);
  const missingMembers = members.filter((m) => !m.updated);

  const memberTasks = useMemo(
    () => (memberId == null ? scoped : scoped.filter((t) => t.assignee_id === memberId)),
    [scoped, memberId],
  );

  const statusCounts = useMemo(() => {
    const c = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0]));
    memberTasks.forEach((t) => (c[t.status] = (c[t.status] || 0) + 1));
    return c;
  }, [memberTasks]);

  const visible = useMemo(
    () => (status == null ? memberTasks : memberTasks.filter((t) => t.status === status)),
    [memberTasks, status],
  );

  // Project -> backlog item -> tasks, which is how the board is read out loud
  // in a stand-up.
  const byProject = useMemo(() => {
    const map = new Map();
    visible.forEach((t) => {
      const pk = t.project_id ?? "none";
      if (!map.has(pk)) {
        map.set(pk, {
          key: pk,
          name: t.project_name,
          code: t.project_code,
          color: t.project_color,
          items: new Map(),
        });
      }
      const proj = map.get(pk);
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
    return [...map.values()]
      .map((p) => ({ ...p, items: [...p.items.values()] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [visible]);

  const byMember = useMemo(
    () => summarizeByMember(visible, []).filter((m) => m.total > 0),
    [visible],
  );

  const byStatus = useMemo(
    () =>
      TASK_STATUSES.map((s) => ({ status: s, tasks: visible.filter((t) => t.status === s) })).filter(
        (g) => g.tasks.length > 0,
      ),
    [visible],
  );

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

  const filtered =
    memberId != null || projectId !== "all" || status != null || (mode === "day" && !!date);

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    // Open-until is for chasing what is left, so start on the open tasks.
    setStatus(next === "until" ? "Incomplete" : null);
  };
  const selectedMember = members.find((m) => m.id === memberId);

  return (
    <div className="space-y-4" data-testid="daily-page">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="flex rounded-sm border border-slate-200 overflow-hidden" data-testid="daily-mode">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.value}
              onClick={() => switchMode(m.value)}
              className={`px-3 h-9 text-xs font-semibold ${
                mode === m.value ? "bg-[#0033CC] text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
              aria-pressed={mode === m.value}
              data-testid={`daily-mode-${m.value}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {mode === "day" ? "Date" : "Created up to"}
        </div>
        <Input
          type="date"
          value={mode === "day" ? date : until}
          onChange={(e) =>
            mode === "day" ? setDate(e.target.value) : setUntil(e.target.value || isoToday())
          }
          className={`rounded-sm h-9 w-40 font-mono text-xs ${
            mode === "until" || date ? "border-[#0033CC] bg-[#0033CC]/5" : ""
          }`}
          data-testid="daily-date"
        />
        <Button
          variant="outline"
          className="rounded-sm h-9 text-xs"
          onClick={() => (mode === "day" ? setDate(isoToday()) : setUntil(isoToday()))}
          data-testid="daily-today"
        >
          Today
        </Button>

        <div className="h-6 w-px bg-slate-200" />

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

        {filtered && (
          <Button
            variant="ghost"
            className="rounded-sm h-9 text-xs text-slate-500"
            onClick={() => {
              if (mode === "day") setDate("");
              setMemberId(null);
              setProjectId("all");
              setStatus(null);
            }}
            data-testid="daily-clear"
          >
            Show all
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            {plural(visible.length, "task")} · {plural(updatedMembers.length, "member")}
          </span>
          {mode === "day" && date && (
            <Button
              variant={isEvening() && date === isoToday() ? "default" : "outline"}
              className={`rounded-sm h-9 text-xs ${
                isEvening() && date === isoToday()
                  ? "bg-[#0033CC] hover:bg-[#0028A3]"
                  : ""
              }`}
              onClick={() => setReportOpen(true)}
              data-testid="daily-report-open"
            >
              <Moon size={14} className="mr-1.5" />
              Evening report
            </Button>
          )}
        </div>
      </div>

      {/* Member chips — click to filter, click again to clear */}
      {members.length > 0 && (
        <div className="space-y-2" data-testid="daily-members">
          <div className="flex flex-wrap gap-2">
            {updatedMembers.map((m) => {
              const active = memberId === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMemberId(active ? null : m.id)}
                  className={`bg-white border rounded-sm px-3 py-2 flex items-center gap-2 text-left transition-colors ${
                    active
                      ? "border-[#0033CC] ring-1 ring-[#0033CC] bg-[#0033CC]/5"
                      : "border-slate-200 hover:border-slate-400"
                  } ${memberId != null && !active ? "opacity-50" : ""}`}
                  data-testid={`daily-member-${m.id}`}
                  aria-pressed={active}
                >
                  <Avatar name={m.name} color={m.color} size="w-6 h-6" />
                  <div className="leading-tight">
                    <div className="text-xs font-semibold text-slate-900">{m.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {plural(m.total, "task")} · {m.counts.Incomplete || 0} open
                      {m.blocked > 0 ? ` · ${m.blocked} blocked` : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {missingMembers.length > 0 && (
            <div
              className="flex items-center gap-2 flex-wrap text-xs"
              data-testid="daily-not-updated"
            >
              <span className="text-[10px] font-mono uppercase tracking-widest text-red-600 font-bold">
                No update {date === isoToday() ? "yet" : "that day"} · {missingMembers.length}
              </span>
              {missingMembers.map((m) => (
                <span
                  key={m.id}
                  className="flex items-center gap-1.5 border border-dashed border-red-200 bg-red-50 text-red-700 rounded-sm px-2 py-1"
                  title={m.role}
                  data-testid={`daily-missing-${m.id}`}
                >
                  <Avatar name={m.name} color={m.color} size="w-4 h-4" />
                  {m.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status chips + view switch */}
      <div className="flex items-center gap-2 flex-wrap" data-testid="daily-statuses">
        {TASK_STATUSES.map((s) => {
          const c = TASK_STATUS_COLORS[s];
          const active = status === s;
          return (
            <button
              type="button"
              key={s}
              onClick={() => setStatus(active ? null : s)}
              className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs font-mono transition-opacity ${
                status != null && !active ? "opacity-40" : ""
              } ${active ? "ring-1" : ""}`}
              style={{
                backgroundColor: c.bg,
                color: c.text,
                borderColor: active ? c.dot : "transparent",
                "--tw-ring-color": c.dot,
              }}
              data-testid={`daily-status-${s.replace(/\s+/g, "-").toLowerCase()}`}
              aria-pressed={active}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
              {s}
              <span className="font-bold">{statusCounts[s] || 0}</span>
            </button>
          );
        })}

        {(memberId != null || status != null) && (
          <button
            type="button"
            onClick={() => {
              setMemberId(null);
              setStatus(null);
            }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 px-1"
            data-testid="daily-clear-chips"
          >
            <X size={12} />
            {[selectedMember?.name, status].filter(Boolean).join(" · ")}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            View by
          </span>
          <div className="flex rounded-sm border border-slate-200 bg-white overflow-hidden">
            {GROUP_BY.map((g) => (
              <button
                type="button"
                key={g.value}
                onClick={() => setGroupBy(g.value)}
                className={`px-3 h-8 text-xs font-semibold ${
                  groupBy === g.value
                    ? "bg-[#0033CC] text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                data-testid={`daily-view-${g.value}`}
                aria-pressed={groupBy === g.value}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-sm p-8 text-center text-sm text-slate-400">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-sm p-8 text-center text-sm text-slate-400">
          No tasks{" "}
          {mode === "until" ? `created up to ${until}` : date ? `touched on ${date}` : "found"}
          {memberId != null || status != null ? " for this filter" : ""}.
        </div>
      ) : groupBy === "member" ? (
        /* Member -> tasks */
        <div className="space-y-4">
          {byMember.map((m) => (
            <div key={m.id} data-testid={`daily-group-member-${m.id}`}>
              <GroupHeader count={m.total}>
                <Avatar name={m.name} color={m.color} size="w-6 h-6" />
                <h2 className="font-display font-black text-base tracking-tight text-slate-900">
                  {m.name}
                </h2>
                <span className="text-xs text-slate-500">{m.role}</span>
                {m.blocked > 0 && (
                  <span className="text-[10px] font-mono text-amber-700">
                    {m.blocked} blocked
                  </span>
                )}
              </GroupHeader>
              <div className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100">
                {m.tasks.map((t) => (
                  <TaskLine
                    key={t.id}
                    task={t}
                    showAssignee={false}
                    showItem
                    showAge={mode === "until"}
                    onStatus={setTaskStatus}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : groupBy === "status" ? (
        /* Status -> tasks */
        <div className="space-y-4">
          {byStatus.map((g) => {
            const c = TASK_STATUS_COLORS[g.status];
            return (
              <div
                key={g.status}
                data-testid={`daily-group-status-${g.status.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <GroupHeader count={g.tasks.length}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dot }} />
                  <h2 className="font-display font-black text-base tracking-tight text-slate-900">
                    {g.status}
                  </h2>
                </GroupHeader>
                <div
                  className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100 border-l-2"
                  style={{ borderLeftColor: c.dot }}
                >
                  {g.tasks.map((t) => (
                    <TaskLine key={t.id} task={t} showItem showAge={mode === "until"}
                    onStatus={setTaskStatus} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Project -> backlog item -> tasks */
        <div className="space-y-4">
          {byProject.map((proj) => (
            <div key={proj.key} data-testid={`daily-project-${proj.code || proj.key}`}>
              <GroupHeader count={proj.items.reduce((a, i) => a + i.tasks.length, 0)}>
                <ProjectTag code={proj.code} color={proj.color} />
                <h2 className="font-display font-black text-base tracking-tight text-slate-900">
                  {proj.name}
                </h2>
              </GroupHeader>

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
                        <TaskLine key={t.id} task={t} showAge={mode === "until"}
                    onStatus={setTaskStatus} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <DailyReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        date={date}
        members={members}
      />
    </div>
  );
}
