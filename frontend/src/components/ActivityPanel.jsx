import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchActivity,
  createComment,
  deleteActivity,
  fetchTeam,
} from "@/lib/api";
import { getActorId } from "@/lib/currentUser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ChatCircle,
  ClockClockwise,
  Trash,
  PaperPlaneTilt,
} from "@phosphor-icons/react";

const FIELD_LABELS = {
  status: "Status",
  priority: "Priority",
  dev_assignee_id: "Dev assignee",
  qa_assignee_id: "QA assignee",
  uiux_assignee_id: "UI/UX assignee",
  data_eng_assignee_id: "Data Engineer assignee",
  sprint_id: "Sprint",
  project_id: "Project",
  phase: "Phase",
  story_points: "Story points",
  percent_done: "% done",
};

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function ActivityPanel({ itemId, teamMap: passedTeamMap, sprintMap, projectMap }) {
  const [activity, setActivity] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("all"); // all | comment | change

  const load = async () => {
    setLoading(true);
    const [a, t] = await Promise.all([
      fetchActivity(itemId),
      passedTeamMap ? Promise.resolve([]) : fetchTeam(),
    ]);
    setActivity(a);
    if (!passedTeamMap) setTeam(t);
    setLoading(false);
  };

  useEffect(() => {
    if (itemId) load();
  }, [itemId]);

  const teamMap =
    passedTeamMap || Object.fromEntries(team.map((m) => [m.id, m]));

  const submit = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    try {
      const actor_id = getActorId() || null;
      await createComment(itemId, { text: body, actor_id });
      setText("");
      load();
    } catch (err) {
      toast.error("Failed to post comment");
    }
  };

  const removeComment = async (id) => {
    if (!window.confirm("Delete this comment?")) return;
    await deleteActivity(id);
    load();
  };

  const formatValue = (field, value) => {
    if (value === "—" || value === "None" || value == null) return "—";
    if (
      field === "dev_assignee_id" ||
      field === "qa_assignee_id" ||
      field === "uiux_assignee_id" ||
      field === "data_eng_assignee_id"
    ) {
      return teamMap[value]?.name || value;
    }
    if (field === "sprint_id") {
      return sprintMap?.[value]?.name || value;
    }
    if (field === "project_id") {
      return projectMap?.[value]?.name || value;
    }
    return value;
  };

  const filtered = activity.filter((a) =>
    filter === "all" ? true : a.kind === filter,
  );

  const commentCount = activity.filter((a) => a.kind === "comment").length;
  const changeCount = activity.filter((a) => a.kind === "change").length;

  return (
    <div className="border-t border-slate-200 pt-4 mt-2" data-testid="activity-panel">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Activity & Comments
        </div>
        <div className="flex items-center gap-1">
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={`All · ${activity.length}`}
            testId="activity-filter-all"
          />
          <FilterPill
            active={filter === "comment"}
            onClick={() => setFilter("comment")}
            label={`Comments · ${commentCount}`}
            icon={ChatCircle}
            testId="activity-filter-comment"
          />
          <FilterPill
            active={filter === "change"}
            onClick={() => setFilter("change")}
            label={`History · ${changeCount}`}
            icon={ClockClockwise}
            testId="activity-filter-change"
          />
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={submit}
        className="flex gap-2 mb-4"
        data-testid="comment-composer"
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment… (use the 'Acting as' picker top-right to attribute)"
          rows={2}
          className="rounded-sm text-sm flex-1"
          data-testid="comment-input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <Button
          type="submit"
          disabled={!text.trim()}
          className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3] self-end"
          data-testid="comment-submit"
        >
          <PaperPlaneTilt size={14} weight="bold" />
        </Button>
      </form>

      {/* Timeline */}
      {loading ? (
        <div className="text-xs text-slate-400 text-center py-4">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-6 italic">
          No activity yet
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
          {filtered.map((a) => {
            const actor = a.actor_id ? teamMap[a.actor_id] : null;
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 p-2.5 rounded-sm border ${
                  a.kind === "comment"
                    ? "bg-blue-50/40 border-blue-100"
                    : "bg-slate-50 border-slate-100"
                }`}
                data-testid={`activity-${a.id}`}
              >
                {actor ? (
                  <div
                    className="w-7 h-7 rounded-sm flex items-center justify-center text-[10px] font-bold text-white font-mono shrink-0"
                    style={{ backgroundColor: actor.avatar_color || "#0033CC" }}
                    title={actor.name}
                  >
                    {actor.name.slice(0, 2).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-sm bg-slate-200 flex items-center justify-center shrink-0">
                    {a.kind === "comment" ? (
                      <ChatCircle size={12} weight="duotone" className="text-slate-500" />
                    ) : (
                      <ClockClockwise size={12} weight="duotone" className="text-slate-500" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900">
                        {actor?.name || "System"}
                      </span>
                      {a.kind === "change" && (
                        <span className="text-slate-500">
                          {" "}
                          updated{" "}
                          <span className="font-semibold text-slate-700">
                            {FIELD_LABELS[a.field] || a.field}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">
                        {timeAgo(a.created_at)}
                      </span>
                      {a.kind === "comment" && (
                        <button
                          onClick={() => removeComment(a.id)}
                          className="text-slate-400 hover:text-red-600 p-0.5"
                          data-testid={`activity-delete-${a.id}`}
                          title="Delete"
                        >
                          <Trash size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  {a.kind === "comment" && a.text && (
                    <p className="text-sm text-slate-800 whitespace-pre-wrap mt-1">
                      {a.text}
                    </p>
                  )}
                  {a.kind === "change" && (
                    <div className="text-xs mt-1 font-mono flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-sm bg-white border border-slate-200 text-slate-500 line-through">
                        {formatValue(a.field, a.from_value)}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="px-1.5 py-0.5 rounded-sm bg-white border border-slate-300 text-slate-900 font-semibold">
                        {formatValue(a.field, a.to_value)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label, icon: Icon, testId }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-mono uppercase tracking-widest font-bold border transition-colors ${
        active
          ? "bg-[#0033CC] text-white border-[#0033CC]"
          : "bg-white text-slate-600 border-slate-200 hover:border-[#0033CC]"
      }`}
      data-testid={testId}
    >
      {Icon && <Icon size={10} weight="bold" />}
      {label}
    </button>
  );
}
