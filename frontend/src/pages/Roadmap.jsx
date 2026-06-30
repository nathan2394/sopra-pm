import { useEffect, useMemo, useState } from "react";
import {
  fetchBacklog,
  fetchSprints,
  fetchTeam,
  fetchQuarterly,
} from "@/lib/api";
import { PRIORITY_COLORS, SYSTEM_COLORS } from "@/lib/constants";
import { PriorityBadge, SystemBadge } from "@/components/Badges";

export default function Roadmap() {
  const [items, setItems] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [team, setTeam] = useState([]);
  const [quarterly, setQuarterly] = useState([]);

  useEffect(() => {
    Promise.all([
      fetchBacklog(),
      fetchSprints(),
      fetchTeam(),
      fetchQuarterly(),
    ]).then(([b, s, t, q]) => {
      setItems(b);
      setSprints(s);
      setTeam(t);
      setQuarterly(q);
    });
  }, []);

  const teamMap = useMemo(
    () => Object.fromEntries(team.map((m) => [m.id, m])),
    [team],
  );

  const sprintsByQuarter = useMemo(() => {
    const map = {};
    sprints.forEach((s) => {
      (map[s.quarter] = map[s.quarter] || []).push(s);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.sprint_number - b.sprint_number),
    );
    return map;
  }, [sprints]);

  const itemsBySprint = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      if (!i.sprint_id) return;
      (map[i.sprint_id] = map[i.sprint_id] || []).push(i);
    });
    return map;
  }, [items]);

  return (
    <div className="space-y-6" data-testid="roadmap-page">
      {/* Quarter Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quarterly.map((q) => (
          <div
            key={q.quarter}
            className="bg-white border border-slate-200 rounded-sm p-4"
            data-testid={`q-summary-${q.quarter.replace(/\s+/g, "-")}`}
          >
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              {q.quarter}
            </div>
            <div className="flex items-end justify-between mt-1">
              <div className="font-display font-black text-3xl text-slate-900">
                {q.total_sp}
                <span className="text-sm text-slate-400 ml-1">SP</span>
              </div>
              <div className="text-xs font-mono text-slate-500">
                {q.items} items
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-sm h-1.5 overflow-hidden mt-2">
              <div
                className="h-full bg-[#059669]"
                style={{ width: `${q.completion_pct}%` }}
              />
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-1">
              {q.done_sp} SP done · {q.completion_pct}%
            </div>
          </div>
        ))}
      </div>

      {/* Roadmap timeline */}
      <div className="space-y-6">
        {Object.entries(sprintsByQuarter).map(([quarter, qsprints]) => (
          <div key={quarter} data-testid={`roadmap-quarter-${quarter.replace(/\s+/g, "-")}`}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="font-display font-black text-xl tracking-tighter text-slate-900">
                {quarter}
              </h2>
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                {qsprints.length} sprints
              </span>
            </div>
            <div className="space-y-2">
              {qsprints.map((s) => {
                const sItems = itemsBySprint[s.id] || [];
                return (
                  <div
                    key={s.id}
                    className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold text-sm text-slate-900">
                          {s.name}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {s.start_date} → {s.end_date}
                        </span>
                        <span className="text-xs text-slate-600 max-w-md truncate">
                          {s.goal}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        {sItems.length} items ·{" "}
                        {sItems.reduce((a, b) => a + b.story_points, 0)} SP
                      </span>
                    </div>
                    {sItems.length > 0 && (
                      <div className="divide-y divide-slate-100">
                        {sItems.map((i) => (
                          <div
                            key={i.id}
                            className="px-4 py-2 flex items-center gap-3 text-sm hover:bg-slate-50"
                          >
                            <span className="font-mono text-[10px] font-bold text-slate-500 w-14 shrink-0">
                              {i.wb_ref}
                            </span>
                            <PriorityBadge priority={i.priority} />
                            <SystemBadge system={i.system} />
                            <span className="text-slate-900 font-medium flex-1 truncate">
                              {i.title}
                            </span>
                            <span className="text-xs text-slate-600">
                              {teamMap[i.dev_assignee_id]?.name || "—"}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-700 w-12 text-right">
                              {i.story_points} SP
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
