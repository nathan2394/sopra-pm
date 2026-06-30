import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";
import {
  fetchBacklog,
  fetchTeam,
  fetchSprints,
  updateBacklogItem,
} from "@/lib/api";
import { STATUSES } from "@/lib/constants";
import { PriorityBadge, SystemBadge } from "@/components/Badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DotsSixVertical } from "@phosphor-icons/react";

const COLUMN_META = {
  Backlog: { tint: "#F1F5F9", accent: "#64748B" },
  "In Progress": { tint: "#EFF6FF", accent: "#0033CC" },
  "In Review": { tint: "#F5F3FF", accent: "#7C3AED" },
  Done: { tint: "#ECFDF5", accent: "#059669" },
};

export default function SprintBoard() {
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);

  const load = async () => {
    const [b, t, s] = await Promise.all([
      fetchBacklog(),
      fetchTeam(),
      fetchSprints(),
    ]);
    setItems(b);
    setTeam(t);
    setSprints(s);
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

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, destination, source } = result;
    if (destination.droppableId === source.droppableId) return;
    const newStatus = destination.droppableId;
    // optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === draggableId ? { ...i, status: newStatus } : i)),
    );
    try {
      await updateBacklogItem(draggableId, { status: newStatus });
      toast.success(`Moved to ${newStatus}`);
    } catch (e) {
      toast.error("Move failed");
      load();
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
          <Select value={selectedSprint || ""} onValueChange={setSelectedSprint}>
            <SelectTrigger className="rounded-sm h-9 w-72" data-testid="sprint-select">
              <SelectValue placeholder="Choose sprint…" />
            </SelectTrigger>
            <SelectContent>
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
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

      {/* Kanban */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUSES.map((status) => {
            const meta = COLUMN_META[status];
            const colItems = columns[status] || [];
            const totalSp = colItems.reduce((a, b) => a + b.story_points, 0);
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
                      className="px-3 py-2.5 border-b border-slate-200/70 flex items-center justify-between bg-white/40"
                      style={{ borderTopColor: meta.accent }}
                    >
                      <div className="flex items-center gap-2">
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
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        {totalSp} SP
                      </span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[180px] max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin">
                      {colItems.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-xs text-slate-400 text-center py-8">
                          No items
                        </div>
                      )}
                      {colItems.map((item, idx) => (
                        <Draggable draggableId={item.id} index={idx} key={item.id}>
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
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="font-mono text-[10px] font-bold text-slate-500">
                                      {item.wb_ref}
                                    </span>
                                    <PriorityBadge priority={item.priority} />
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
    </div>
  );
}
