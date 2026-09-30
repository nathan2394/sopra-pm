import { useMemo, useState } from "react";
import { taskStatus } from "@/lib/constants";

/**
 * The weekly management report, shared by the signed-in page (/weekly) and the
 * public link (/report/weekly) so both show exactly the same thing.
 *
 * Reading order is deliberate: the numbers, then what needs a decision, then
 * what landed, then the composition charts. Task-level detail stays hidden
 * until a bar is clicked, so the summary itself stays short.
 */

// Validated against the light chart surface with the palette checker:
// deutan ΔE 29.3, tritan 15.0, normal 32.0 — all above the separation floor.
const SERIES = {
  Complete: "#10B981",
  Incomplete: "#2563EB",
};

// Role hues are assigned by fixed slot order, so a role keeps its colour no
// matter which projects are on screen. Reference categorical theme, validated
// on the adjacent pairlist: worst CVD ΔE 9.1, normal-vision 19.6. Three slots
// sit under 3:1 on white, so every segment ships a visible count label.
const ROLE_ORDER = ["Backend Dev", "AI Engineer", "QA", "UI/UX", "Product Manager"];
const ROLE_COLORS = {
  "Backend Dev": "#2a78d6",
  "AI Engineer": "#eb6834",
  QA: "#1baf7a",
  "UI/UX": "#eda100",
  "Product Manager": "#e87ba4",
  Other: "#94a3b8",
};
const roleColor = (role) => ROLE_COLORS[role] || ROLE_COLORS.Other;
const roleRank = (role) => {
  const i = ROLE_ORDER.indexOf(role);
  return i === -1 ? ROLE_ORDER.length : i;
};

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const longDate = (s) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const shortDate = (s) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function WeeklyReportView({ from, to, data, error, onPrev, onNext }) {
  // { dim: "project" | "member", key } — null means nothing is drilled into.
  const [selected, setSelected] = useState(null);

  const tasks = useMemo(() => data?.tasks || [], [data]);
  const shipped = useMemo(() => data?.shipped_items || [], [data]);

  const stats = useMemo(() => {
    const complete = tasks.filter((t) => taskStatus(t.status) === "Complete").length;
    return {
      projects: new Set(tasks.map((t) => t.project_id ?? "none")).size,
      tasks: tasks.length,
      complete,
      incomplete: tasks.length - complete,
      pct: tasks.length ? Math.round((complete / tasks.length) * 1000) / 10 : 0,
      blocked: tasks.filter((t) => t.blocker).length,
      members: new Set(tasks.map((t) => t.assignee_id)).size,
    };
  }, [tasks]);

  const group = (dim) => {
    const map = new Map();
    tasks.forEach((t) => {
      const key = dim === "project" ? t.project_id ?? "none" : t.assignee_id;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: dim === "project" ? t.project_name : t.assignee_name || "Unassigned",
          tag: dim === "project" ? t.project_code : t.assignee_role,
          color: dim === "project" ? t.project_color : t.assignee_color,
          tasks: [],
        });
      }
      map.get(key).tasks.push(t);
    });
    return [...map.values()]
      .map((g) => {
        const complete = g.tasks.filter((t) => taskStatus(t.status) === "Complete").length;
        return {
          ...g,
          complete,
          incomplete: g.tasks.length - complete,
          blocked: g.tasks.filter((t) => t.blocker).length,
          total: g.tasks.length,
        };
      })
      .sort((a, b) => b.total - a.total);
  };

  const byProject = useMemo(() => group("project"), [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const byMember = useMemo(() => group("member"), [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who is needed on each project: distinct people, broken down by role.
  const staffing = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      const key = t.project_id ?? "none";
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: t.project_name,
          tag: t.project_code,
          color: t.project_color,
          people: new Map(),
        });
      }
      const p = map.get(key);
      if (!p.people.has(t.assignee_id)) {
        p.people.set(t.assignee_id, {
          id: t.assignee_id,
          name: t.assignee_name || "Unassigned",
          role: t.assignee_role || "Other",
          color: t.assignee_color,
          tasks: 0,
        });
      }
      p.people.get(t.assignee_id).tasks += 1;
    });

    return [...map.values()]
      .map((p) => {
        const people = [...p.people.values()];
        const byRole = new Map();
        people.forEach((m) => {
          if (!byRole.has(m.role)) byRole.set(m.role, []);
          byRole.get(m.role).push(m.name);
        });
        return {
          ...p,
          people,
          total: people.length,
          roles: [...byRole.entries()]
            .map(([role, names]) => ({
              role,
              count: names.length,
              names: names.sort((a, b) => a.localeCompare(b)),
            }))
            .sort((a, b) => roleRank(a.role) - roleRank(b.role)),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [tasks]);

  // The mirror of `staffing`: how many projects each person is spread across.
  const load = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (!map.has(t.assignee_id)) {
        map.set(t.assignee_id, {
          key: t.assignee_id,
          label: t.assignee_name || "Unassigned",
          tag: t.assignee_role,
          color: t.assignee_color,
          projects: new Map(),
        });
      }
      const m = map.get(t.assignee_id);
      const pk = t.project_id ?? "none";
      if (!m.projects.has(pk)) {
        m.projects.set(pk, {
          key: pk,
          name: t.project_name,
          code: t.project_code,
          color: t.project_color,
          tasks: 0,
        });
      }
      m.projects.get(pk).tasks += 1;
    });

    return [...map.values()]
      .map((m) => {
        const projects = [...m.projects.values()].sort((a, b) => b.tasks - a.tasks);
        return { ...m, projects, total: projects.length, taskCount: projects.reduce((a, b) => a + b.tasks, 0) };
      })
      .sort((a, b) => b.total - a.total || b.taskCount - a.taskCount);
  }, [tasks]);

  const blockers = tasks.filter((t) => t.blocker);

  const drill = useMemo(() => {
    if (!selected) return null;
    const rows = selected.dim === "project" ? byProject : byMember;
    return rows.find((r) => String(r.key) === String(selected.key)) || null;
  }, [selected, byProject, byMember]);

  // Drill-down reads backlog item first, then the tasks beneath it — the same
  // shape the board uses, so a reader can map a number back to a deliverable.
  const drillGroups = useMemo(() => {
    if (!drill) return [];
    const map = new Map();
    drill.tasks.forEach((t) => {
      if (!map.has(t.backlog_item_id)) {
        map.set(t.backlog_item_id, {
          id: t.backlog_item_id,
          wbRef: t.item_wb_ref,
          title: t.item_title,
          status: t.item_status,
          projectName: t.project_name,
          tasks: [],
        });
      }
      map.get(t.backlog_item_id).tasks.push(t);
    });
    return [...map.values()]
      .map((g) => ({
        ...g,
        done: g.tasks.filter((t) => taskStatus(t.status) === "Complete").length,
      }))
      .sort((a, b) => b.tasks.length - a.tasks.length);
  }, [drill]);

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="text-3xl mb-2">🔒</div>
        <h1 className="text-lg font-extrabold text-slate-900">Report unavailable</h1>
        <p className="text-sm text-slate-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-2">
            Engineering Portfolio Snapshot
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            IT Weekly Dashboard
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Management &amp; Operational Portfolio View
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm hover:bg-slate-50 print:hidden"
            data-testid="report-prev"
          >
            ←
          </button>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-right">
            <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
              Reporting Week
            </span>
            <span className="text-sm font-bold text-slate-800" data-testid="report-week">
              {shortDate(from)} – {longDate(to)}
            </span>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm hover:bg-slate-50 print:hidden"
            data-testid="report-next"
          >
            →
          </button>
        </div>
      </header>

      {!data ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
          Loading report…
        </div>
      ) : (
        <>
          {/* 1. Headline numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="report-kpis">
            {[
              {
                label: "Total Projects",
                value: stats.projects,
                sub: `${stats.tasks} Total Tasks Tracked`,
                icon: "📁",
                tone: "bg-indigo-50 text-indigo-600",
                labelTone: "text-slate-500",
              },
              {
                label: "Completed",
                value: stats.complete,
                sub: `${stats.pct}% of tasks this week`,
                icon: "✓",
                tone: "bg-emerald-50 text-emerald-600",
                labelTone: "text-emerald-600",
              },
              {
                label: "In Progress",
                value: stats.incomplete,
                sub: `${stats.members} members active`,
                icon: "⏳",
                tone: "bg-amber-50 text-amber-600",
                labelTone: "text-amber-600",
              },
              {
                label: "Decisions / Risks",
                value: stats.blocked,
                sub: stats.blocked ? "Blockers need attention" : "No Open Issues Logged",
                icon: "🛡️",
                tone: stats.blocked ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500",
                labelTone: stats.blocked ? "text-red-600" : "text-slate-500",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/80 flex items-center justify-between"
              >
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${c.labelTone}`}>
                    {c.label}
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-2">{c.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl ${c.tone}`}>
                  {c.icon}
                </div>
              </div>
            ))}
          </div>

          {/* 2. What needs a decision */}
          {blockers.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">🛡️</div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Risks &amp; Blockers</h2>
                  <p className="text-xs text-slate-500">{blockers.length} item(s) need a decision</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {blockers.map((t) => (
                  <div key={t.id} className="px-6 py-3 text-sm" data-testid={`blocker-${t.id}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      {t.project_code && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                          style={{ backgroundColor: t.project_color || "#64748B" }}
                        >
                          {t.project_code}
                        </span>
                      )}
                      <span className="font-semibold text-slate-900">{t.project_name}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-[10px] text-slate-400">{t.item_wb_ref}</span>
                      <span className="text-slate-600">{t.item_title}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 pl-0.5">
                      <span className="text-xs text-slate-500">{t.assignee_name}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-600">{t.title}</span>
                      <span className="text-xs text-red-600">— {t.blocker}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. What landed */}
          {shipped.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden" data-testid="report-delivered">
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">🚀</div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Delivered This Week</h2>
                  <p className="text-xs text-slate-500">
                    {shipped.length} {shipped.length === 1 ? "item" : "items"} completed
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {shipped.map((i) => (
                  <div
                    key={i.id}
                    className="px-6 py-2.5 flex items-center gap-3 text-sm flex-wrap"
                    data-testid={`delivered-${i.id}`}
                  >
                    {i.project_code && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: i.project_color || "#64748B" }}
                      >
                        {i.project_code}
                      </span>
                    )}
                    <span className="font-semibold text-slate-900">{i.project_name}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-400 font-mono">{i.wb_ref}</span>
                    <span className="flex-1 text-slate-700 min-w-[12rem]">{i.title}</span>
                    <span className="text-xs text-slate-500">{i.actual_date}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. Composition — the summary proper. Detail only on click. */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="report-charts">
            <CompositionChart
              title="Tasks by Project"
              caption={`${byProject.length} projects · click a bar for the full task list`}
              rows={byProject}
              dim="project"
              selected={selected}
              onSelect={setSelected}
              showSummary
            />
            <StaffingChart
              byProject={staffing}
              byMember={load}
              selected={selected}
              onSelect={setSelected}
            />
          </section>

          {/* 5. Drill-down, only when asked for */}
          {drill && (
            <section
              className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden"
              data-testid="report-drill"
            >
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: drill.color || "#64748B" }}
                >
                  {(drill.tag || drill.label).slice(0, 3).toUpperCase()}
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{drill.label}</h2>
                  <p className="text-xs text-slate-500">
                    {drill.total} tasks · {drill.complete} completed · {drill.incomplete} in progress
                    {drill.blocked > 0 ? ` · ${drill.blocked} blocked` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="ml-auto text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg border border-slate-200"
                  data-testid="report-drill-close"
                >
                  Close
                </button>
              </div>
              <div className="divide-y divide-slate-200">
                {drillGroups.map((g) => (
                  <div key={g.id} data-testid={`drill-item-${g.id}`}>
                    {/* The backlog item this work sits under */}
                    <div className="px-6 py-2 bg-slate-50 flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-slate-500">
                        {g.wbRef}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{g.title}</span>
                      {selected.dim === "member" && g.projectName && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-500">{g.projectName}</span>
                        </>
                      )}
                      <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        {g.done}/{g.tasks.length} done · {g.status}
                      </span>
                    </div>

                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {g.tasks.map((t) => {
                          const done = taskStatus(t.status) === "Complete";
                          return (
                            <tr key={t.id} data-testid={`report-drill-task-${t.id}`}>
                              <td className="px-6 py-2 text-slate-600 whitespace-nowrap w-44 align-top">
                                {t.assignee_name}
                              </td>
                              <td className="px-3 py-2 text-slate-700">
                                {t.title}
                                {t.blocker && (
                                  <span className="text-red-600 text-xs"> — {t.blocker}</span>
                                )}
                              </td>
                              <td className="px-6 py-2 w-32 align-top">
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    done
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-blue-50 text-blue-700"
                                  }`}
                                >
                                  {done ? "Completed" : "In Progress"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          )}

          <footer className="text-center text-xs text-slate-400 pb-4">
            SOPRA PM · generated {longDate(iso(new Date()))}
          </footer>
        </>
      )}
    </div>
  );
}

/**
 * Horizontal stacked bars: one row per project or member, split complete vs
 * incomplete. Horizontal because the category labels are names, not dates.
 * Each row is a button — clicking drills into its tasks.
 */
function CompositionChart({ title, caption, rows, dim, selected, onSelect, showSummary }) {
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200/80 flex items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{caption}</p>
        </div>
        {/* Legend: two series, so identity is never colour-alone. */}
        <div className="ml-auto flex items-center gap-3">
          {Object.entries(SERIES).map(([name, color]) => (
            <span key={name} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-1">
        {rows.map((r) => {
          const isSelected =
            selected && selected.dim === dim && String(selected.key) === String(r.key);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onSelect(isSelected ? null : { dim, key: r.key })}
              className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors ${
                isSelected ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
              data-testid={`chart-${dim}-${r.key}`}
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-800 truncate max-w-[60%]">
                  {r.label}
                </span>
                {r.tag && <span className="text-[10px] text-slate-400 truncate">{r.tag}</span>}
                {r.blocked > 0 && (
                  <span className="text-[10px] text-red-600" title={`${r.blocked} blocked`}>
                    ⚠ {r.blocked}
                  </span>
                )}
                {/* Direct label — the total, not a number on every segment. */}
                <span className="ml-auto text-xs font-bold text-slate-700 tabular-nums">
                  {r.total}
                </span>
              </div>

              <div className="flex items-stretch h-3" style={{ width: `${(r.total / max) * 100}%` }}>
                {r.complete > 0 && (
                  <div
                    className="h-full"
                    style={{
                      backgroundColor: SERIES.Complete,
                      width: `${(r.complete / r.total) * 100}%`,
                      borderRadius: r.incomplete === 0 ? "3px" : "3px 0 0 3px",
                      // 2px surface gap between stacked segments
                      marginRight: r.incomplete > 0 ? 2 : 0,
                    }}
                    title={`${r.label}: ${r.complete} complete`}
                  />
                )}
                {r.incomplete > 0 && (
                  <div
                    className="h-full"
                    style={{
                      backgroundColor: SERIES.Incomplete,
                      width: `${(r.incomplete / r.total) * 100}%`,
                      borderRadius: r.complete === 0 ? "3px" : "0 3px 3px 0",
                    }}
                    title={`${r.label}: ${r.incomplete} in progress`}
                  />
                )}
              </div>

              {showSummary && <WeekNarrative row={r} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A one-glance answer to "what actually moved here this week", written at
 * backlog-item level rather than task level — item titles are the feature names
 * management recognises ("Nexora MESIN Phase 1"), where task titles are the
 * granular chores underneath. Clamped to two lines; the task list is one click
 * away.
 */
function WeekNarrative({ row }) {
  const clamp = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };

  // Distinct backlog items this project touched during the week.
  const items = new Map();
  row.tasks.forEach((t) => {
    if (!items.has(t.backlog_item_id)) {
      items.set(t.backlog_item_id, {
        title: (t.item_title || "").trim(),
        status: t.item_status,
        done: 0,
        total: 0,
      });
    }
    const it = items.get(t.backlog_item_id);
    it.total += 1;
    if (taskStatus(t.status) === "Complete") it.done += 1;
  });

  const all = [...items.values()];
  // "Delivered" is the item's own status; an item can be finished even while a
  // late task is still being tidied up.
  const delivered = all.filter((i) => i.status === "Done");
  const inFlight = all.filter((i) => i.status !== "Done");

  const list = (arr, n, withProgress) =>
    arr
      .slice(0, n)
      .map((i) => (withProgress ? `${i.title} (${i.done}/${i.total})` : i.title))
      .join(" · ") + (arr.length > n ? ` +${arr.length - n} more` : "");

  if (all.length === 0) return null;

  return (
    <p className="text-[11px] leading-snug text-slate-500 mt-1.5" style={clamp}>
      {delivered.length > 0 && (
        <>
          <span className="font-semibold text-emerald-700">Delivered:</span>{" "}
          {list(delivered, 2, false)}
        </>
      )}
      {delivered.length > 0 && inFlight.length > 0 && <span className="text-slate-300"> — </span>}
      {inFlight.length > 0 && (
        <>
          <span className="font-semibold text-blue-700">In flight:</span>{" "}
          {list(inFlight, 3, true)}
        </>
      )}
    </p>
  );
}

/**
 * Engagement seen from either side:
 *   · by project — how many people a project is drawing on, split by role
 *   · by member  — how many projects a person is spread across, split by project
 *
 * Same underlying data, two points of view, so "does this project have enough
 * people" and "is this person spread too thin" are both one glance. Every
 * segment is also named in the line below it, because three role hues sit under
 * 3:1 on white and colour must never be the only channel.
 */
function StaffingChart({ byProject, byMember, selected, onSelect }) {
  const [view, setView] = useState("project");
  const rows = view === "project" ? byProject : byMember;
  const max = Math.max(1, ...rows.map((r) => r.total));

  const rolesPresent = [...new Set(byProject.flatMap((r) => r.roles.map((x) => x.role)))].sort(
    (a, b) => roleRank(a) - roleRank(b),
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200/80 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {view === "project" ? "Team Composition by Project" : "Project Load by Member"}
            </h2>
            <p className="text-xs text-slate-500">
              {view === "project"
                ? "people engaged per project · click a bar for the task list"
                : "projects each member handles · click a bar for the task list"}
            </p>
          </div>
          <div className="ml-auto inline-flex rounded-lg border border-slate-200 overflow-hidden">
            {[
              ["project", "By project"],
              ["member", "By member"],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-2.5 h-7 text-[11px] font-semibold ${
                  view === v ? "bg-slate-800 text-white" : "bg-white text-slate-500"
                }`}
                data-testid={`staffing-view-${v}`}
                aria-pressed={view === v}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {view === "project" && (
          <div className="flex items-center gap-2.5 flex-wrap">
            {rolesPresent.map((role) => (
              <span key={role} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: roleColor(role) }} />
                {role}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 space-y-1">
        {rows.map((r) => {
          const dim = view === "project" ? "project" : "member";
          const isSelected =
            selected && selected.dim === dim && String(selected.key) === String(r.key);

          // Project view stacks roles; member view stacks the projects themselves.
          const segments =
            view === "project"
              ? r.roles.map((x) => ({
                  id: x.role,
                  size: x.count,
                  color: roleColor(x.role),
                  title: `${x.count} × ${x.role}`,
                }))
              : r.projects.map((x) => ({
                  id: x.key,
                  size: 1,
                  color: x.color || "#94a3b8",
                  title: `${x.name}: ${x.tasks} tasks`,
                }));

          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onSelect(isSelected ? null : { dim, key: r.key })}
              className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors ${
                isSelected ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
              data-testid={`chart-staffing-${dim}-${r.key}`}
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-800 truncate max-w-[55%]">
                  {r.label}
                </span>
                {r.tag && <span className="text-[10px] text-slate-400">{r.tag}</span>}
                <span className="ml-auto text-xs font-bold text-slate-700 tabular-nums">
                  {view === "project"
                    ? `${r.total} ${r.total === 1 ? "person" : "people"}`
                    : `${r.total} ${r.total === 1 ? "project" : "projects"}`}
                </span>
              </div>

              <div className="flex items-stretch h-3" style={{ width: `${(r.total / max) * 100}%` }}>
                {segments.map((seg, i) => (
                  <div
                    key={seg.id}
                    className="h-full"
                    style={{
                      backgroundColor: seg.color,
                      width: `${(seg.size / r.total) * 100}%`,
                      borderRadius:
                        segments.length === 1
                          ? "3px"
                          : i === 0
                            ? "3px 0 0 3px"
                            : i === segments.length - 1
                              ? "0 3px 3px 0"
                              : 0,
                      marginRight: i < segments.length - 1 ? 2 : 0,
                    }}
                    title={seg.title}
                  />
                ))}
              </div>

              <p
                className="text-[11px] leading-snug text-slate-500 mt-1.5"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {view === "project"
                  ? r.roles.map((x, i) => (
                      <span key={x.role}>
                        {i > 0 && <span className="text-slate-300"> · </span>}
                        <span className="font-semibold text-slate-600">{x.count}</span>{" "}
                        <span style={{ color: roleColor(x.role) }}>{x.role}</span>{" "}
                        <span className="text-slate-400">({x.names.join(", ")})</span>
                      </span>
                    ))
                  : r.projects.map((x, i) => (
                      <span key={x.key}>
                        {i > 0 && <span className="text-slate-300"> · </span>}
                        <span style={{ color: x.color || "#64748B" }} className="font-semibold">
                          {x.name}
                        </span>{" "}
                        <span className="text-slate-400">({x.tasks} tasks)</span>
                      </span>
                    ))}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
