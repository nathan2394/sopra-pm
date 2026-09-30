import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";
import {
  fetchBacklog,
  fetchDailyTasks,
  fetchTeam,
  fetchSprints,
  fetchProjects,
  updateBacklogItem,
} from "@/lib/api";
import ItemDialog from "@/components/ItemDialog";
import { STATUSES, taskStatus } from "@/lib/constants";
import { isoToday } from "@/lib/dailyReport";
import { daysBetween } from "@/lib/insights";
import { PriorityBadge, SystemBadge } from "@/components/Badges";
import { getActorId } from "@/lib/currentUser";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DotsSixVertical, Warning, ListChecks } from "@phosphor-icons/react";

/** An open item with no task activity for this many days reads as stalled. */
const IDLE_DAYS = 3;

/**
 * Task roll-up per backlog item: how many, how many complete, how many
 * blocked, and how many days since any of them was created or touched.
 */
function taskStatsByItem(tasks, today) {
  const map = new Map();
  tasks.forEach((t) => {
    if (!map.has(t.backlog_item_id)) {
      map.set(t.backlog_item_id, { total: 0, complete: 0, blocked: 0, last: "" });
    }
    const s = map.get(t.backlog_item_id);
    s.total += 1;
    if (taskStatus(t.status) === "Complete") s.complete += 1;
    if (t.blocker) s.blocked += 1;
    const touched = (t.updated_at || t.created_at || "").slice(0, 10);
    if (touched > s.last) s.last = touched;
  });
  map.forEach((s) => (s.idleDays = s.last ? daysBetween(s.last, today) : null));
  return map;
}

/** One line on the card: task progress and how recently anyone worked on it. */
function TaskActivity({ stats, done }) {
  if (!stats) {
    return done ? null : (
      <div
        className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1 text-[10px] font-mono text-slate-400"
        data-testid="card-no-tasks"
      >
        <ListChecks size={11} />
        No tasks registered
      </div>
    );
  }
  const pct = Math.round((stats.complete / stats.total) * 100);
  const idle = !done && stats.idleDays >= IDLE_DAYS;
  const activity =
    stats.idleDays === 0 ? "Active today" : stats.idleDays === 1 ? "Yesterday" : `${stats.idleDays}d ago`;
  return (
    <div className="mt-2 pt-2 border-t border-slate-100" data-testid="card-task-activity">
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
        <span
          className="flex items-center gap-1 text-slate-600 whitespace-nowrap"
          title={`${pct}% of tasks complete`}
        >
          <ListChecks size={11} />
          <b className="text-slate-900">{stats.complete}/{stats.total}</b> tasks
          {stats.blocked > 0 && (
            <span className="flex items-center gap-0.5 text-amber-700 ml-1" title="Tasks with a blocker">
              <Warning size={11} />
              {stats.blocked}
            </span>
          )}
        </span>
        <span
          className={`rounded-sm px-1 whitespace-nowrap ${
            idle
              ? "bg-amber-50 text-amber-800 font-bold"
              : stats.idleDays === 0
                ? "text-emerald-700 font-semibold"
                : "text-slate-500"
          }`}
          title={`Last task activity ${stats.last}`}
        >
          {idle ? `Idle ${stats.idleDays}d` : activity}
        </span>
      </div>
      <div className="mt-1 h-1 bg-slate-100 rounded-sm overflow-hidden">
        <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const COLUMN_META = {
  Backlog: { tint: "#F1F5F9", accent: "#64748B" },
  "In Progress": { tint: "#EFF6FF", accent: "#0033CC" },
  Pending: { tint: "#FFF7ED", accent: "#EA580C" },
  "In Review": { tint: "#F5F3FF", accent: "#7C3AED" },
  Done: { tint: "#ECFDF5", accent: "#059669" },
};

export default function SprintBoard() {
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [tasks, setTasks] = useState([]);
  // Edit a card in place — no detour through the Backlog page.
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item, phase: item.phase || "", url: item.url || "" });
  };

  const closeEdit = (open) => {
    if (!open) {
      setEditing(null);
      setForm(null);
    }
  };

  const applyUpdated = (updated) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditing(updated);
    setForm((f) => ({ ...f, ...updated }));
  };

  const handleSave = async () => {
    try {
      const updated = await updateBacklogItem(
        editing.id,
        {
          ...form,
          story_points: parseInt(form.story_points) || 0,
          percent_done: parseInt(form.percent_done) || 0,
          sprint_id: form.sprint_id || null,
          project_id: form.project_id || null,
          phase: form.phase || null,
          dev_assignee_id: form.dev_assignee_id || null,
          qa_assignee_id: form.qa_assignee_id || null,
          uiux_assignee_id: form.uiux_assignee_id || null,
          data_eng_assignee_id: form.data_eng_assignee_id || null,
        },
        getActorId() || undefined,
      );
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      toast.success("Item updated");
      closeEdit(false);
    } catch (e) {
      toast.error("Save failed");
    }
  };

  const load = async () => {
    const [b, t, s, p, tk] = await Promise.all([
      fetchBacklog(),
      fetchTeam(),
      fetchSprints(),
      fetchProjects(),
      // Every task, not one day's: the card shows total progress and how long
      // the item has been quiet. The board still loads if this call fails.
      fetchDailyTasks().catch(() => []),
    ]);
    setTasks(tk);
    setItems(b);
    setTeam(t);
    setSprints(s);
    setProjects(p);
    if (!selectedSprint && s.length > 0) {
      const active = s.find((x) => x.status === "Active");
      setSelectedSprint(active?.id || s[0].id);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const teamMap = useMemo(
    () => Object.fromEntries(team.map((t) => [t.id, t])),
    [team],
  );
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  const sprintMap = useMemo(
    () => Object.fromEntries(sprints.map((s) => [s.id, s])),
    [sprints],
  );

  const sprintItems = useMemo(
    () => items.filter((i) => i.sprint_id === selectedSprint),
    [items, selectedSprint],
  );

  const columns = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map((s) => [s, []]));
    sprintItems.forEach((i) => map[i.status]?.push(i));
    return map;
  }, [sprintItems]);

  const currentSprint = sprints.find((s) => s.id === selectedSprint);

  const today = isoToday();
  const taskStats = useMemo(() => taskStatsByItem(tasks, today), [tasks, today]);

  // Sprint-wide: task progress and which open items look stalled.
  const sprintActivity = useMemo(() => {
    let total = 0;
    let complete = 0;
    let activeToday = 0;
    let idle = 0;
    let noTasks = 0;
    sprintItems.forEach((i) => {
      const s = taskStats.get(i.id);
      if (s) {
        total += s.total;
        complete += s.complete;
      }
      if (i.status === "Done") return;
      if (!s) noTasks += 1;
      else if (s.idleDays === 0) activeToday += 1;
      else if (s.idleDays >= IDLE_DAYS) idle += 1;
    });
    return { total, complete, activeToday, idle, noTasks };
  }, [sprintItems, taskStats]);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, destination, source } = result;
    if (destination.droppableId === source.droppableId) return;

    // draggableId is always a string (the library requires it); item ids are
    // numbers, so convert back before touching state or the API.
    const itemId = Number(draggableId);
    const newStatus = destination.droppableId;
    const previousStatus = source.droppableId;

    // Optimistic move, so the card lands where it was dropped straight away.
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i)),
    );

    try {
      const updated = await updateBacklogItem(
        itemId,
        { status: newStatus },
        getActorId() || undefined,
      );
      // Moving to Done also sets percent_done and actual_date server-side, so
      // take the server's version of the row rather than just the new status.
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      toast.success(`Moved to ${newStatus}`);
    } catch (e) {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: previousStatus } : i)),
      );
      toast.error("Move failed");
    }
  };

  return (
    <div className="space-y-4" data-testid="board-page">
      {/* Sprint selector */}
      <div className="bg-white border border-slate-200 rounded-sm p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Sprint
          </div>
          <Select
            value={selectedSprint != null ? String(selectedSprint) : ""}
            onValueChange={(v) => setSelectedSprint(Number(v))}
          >
            <SelectTrigger className="rounded-sm h-9 w-72" data-testid="sprint-select">
              <SelectValue placeholder="Choose sprint…" />
            </SelectTrigger>
            <SelectContent>
              {sprints.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name} · {s.quarter} · {s.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentSprint && (
            <>
              <div className="h-6 w-px bg-slate-200" />
              <div className="text-xs text-slate-600">
                <span className="font-mono">
                  {currentSprint.start_date} → {currentSprint.end_date}
                </span>
              </div>
            </>
          )}
        </div>
        {currentSprint && (
          <div className="text-xs text-slate-600 max-w-xl">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mr-2">
              Goal:
            </span>
            {currentSprint.goal || "No goal set"}
          </div>
        )}
      </div>

      {/* Task activity across the sprint */}
      {currentSprint && (
        <div
          className="flex items-center gap-x-5 gap-y-2 flex-wrap text-xs text-slate-600 px-1"
          data-testid="sprint-activity"
        >
          <span className="flex items-center gap-1.5">
            <ListChecks size={14} className="text-slate-400" />
            <b className="font-mono text-slate-900">
              {sprintActivity.complete}/{sprintActivity.total}
            </b>
            tasks complete
          </span>
          <span className="text-emerald-700">
            <b className="font-mono">{sprintActivity.activeToday}</b> items active today
          </span>
          <span className={sprintActivity.idle ? "text-amber-800 font-semibold" : ""}>
            <b className="font-mono">{sprintActivity.idle}</b> idle {IDLE_DAYS}+ days
          </span>
          <span className={sprintActivity.noTasks ? "text-slate-700" : ""}>
            <b className="font-mono">{sprintActivity.noTasks}</b> open{" "}
            {sprintActivity.noTasks === 1 ? "item" : "items"} without tasks
          </span>
        </div>
      )}

      {/* Kanban */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {STATUSES.map((status) => {
            const meta = COLUMN_META[status];
            const colItems = columns[status] || [];
            const totalSp = colItems.reduce((a, b) => a + b.story_points, 0);
            const colTasks = colItems.reduce(
              (a, b) => {
                const s = taskStats.get(b.id);
                return s ? [a[0] + s.complete, a[1] + s.total] : a;
              },
              [0, 0],
            );
            return (
              <Droppable droppableId={status} key={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-sm border border-slate-200 transition-colors ${
                      snapshot.isDraggingOver ? "ring-2 ring-[#0033CC]" : ""
                    }`}
                    style={{ backgroundColor: meta.tint }}
                    data-testid={`column-${status.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <div
                      className="px-3 py-2.5 border-b border-slate-200/70 bg-white/40"
                      style={{ borderTopColor: meta.accent }}
                    >
                     <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: meta.accent }}
                        />
                        <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-700 font-bold">
                          {status}
                        </h3>
                        <span className="text-xs text-slate-500 font-mono">
                          · {colItems.length}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 whitespace-nowrap">
                        {totalSp} SP
                      </span>
                     </div>
                      {colTasks[1] > 0 && (
                        <div
                          className="mt-1 text-[10px] font-mono text-slate-500"
                          title={`${colTasks[0]} of ${colTasks[1]} tasks complete`}
                        >
                          {colTasks[0]}/{colTasks[1]} tasks complete
                        </div>
                      )}
                    </div>
                    <div className="p-2 space-y-2 min-h-[180px] max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin">
                      {colItems.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-xs text-slate-400 text-center py-8">
                          No items
                        </div>
                      )}
                      {colItems.map((item, idx) => (
                        <Draggable draggableId={String(item.id)} index={idx} key={item.id}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={`bg-white border border-slate-200 rounded-sm p-3 ${
                                snap.isDragging ? "shadow-lg" : ""
                              }`}
                              data-testid={`card-${item.wb_ref}`}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  {...prov.dragHandleProps}
                                  className="mt-0.5 text-slate-300 hover:text-slate-600 cursor-grab"
                                >
                                  <DotsSixVertical size={14} weight="bold" />
                                </div>
                                <div
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => openEdit(item)}
                                  data-testid={`open-${item.wb_ref}`}
                                >
                                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                    <span className="font-mono text-[10px] font-bold text-slate-500">
                                      {item.wb_ref}
                                    </span>
                                    <PriorityBadge priority={item.priority} />
                                    {item.project_id &&
                                      projectMap[item.project_id] && (
                                        <span
                                          className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-white font-mono"
                                          style={{
                                            backgroundColor:
                                              projectMap[item.project_id].color,
                                          }}
                                          title={
                                            projectMap[item.project_id].name +
                                            (item.phase ? ` · ${item.phase}` : "")
                                          }
                                        >
                                          {projectMap[item.project_id].code ||
                                            "PRJ"}
                                          {item.phase ? ` · ${item.phase.replace("Phase ", "P")}` : ""}
                                        </span>
                                      )}
                                  </div>
                                  <div className="text-sm font-semibold text-slate-900 leading-tight mb-2">
                                    {item.title}
                                  </div>
                                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                                    <SystemBadge system={item.system} />
                                    <div className="flex items-center gap-1.5">
                                      {item.dev_assignee_id && (
                                        <div
                                          title={teamMap[item.dev_assignee_id]?.name}
                                          className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white font-mono"
                                          style={{
                                            backgroundColor:
                                              teamMap[item.dev_assignee_id]
                                                ?.avatar_color || "#0033CC",
                                          }}
                                        >
                                          {teamMap[item.dev_assignee_id]?.name
                                            ?.slice(0, 2)
                                            .toUpperCase()}
                                        </div>
                                      )}
                                      <span className="text-xs font-mono font-bold text-slate-700">
                                        {item.story_points}SP
                                      </span>
                                    </div>
                                  </div>
                                  <TaskActivity
                                    stats={taskStats.get(item.id)}
                                    done={item.status === "Done"}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {form && (
        <ItemDialog
          open={!!editing}
          onOpenChange={closeEdit}
          form={form}
          setForm={setForm}
          editing={editing}
          onSave={handleSave}
          onAttachmentChanged={applyUpdated}
          team={team}
          sprints={sprints}
          projects={projects}
          teamMap={teamMap}
          sprintMap={sprintMap}
          projectMap={projectMap}
        />
      )}
    </div>
  );
}
