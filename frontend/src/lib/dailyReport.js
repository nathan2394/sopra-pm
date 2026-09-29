import { STATUSES } from "@/lib/constants";

/** Local date parts — toISOString() would shift the day at WIB (+07:00). */
export const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

/** The evening report is due from this hour (local time). */
export const EVENING_HOUR = 17;

export const isEvening = () => new Date().getHours() >= EVENING_HOUR;

export const formatDay = (iso) => {
  if (!iso) return "All days";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const emptyCounts = () => Object.fromEntries(STATUSES.map((s) => [s, 0]));

/**
 * One row per team member for the day's tasks: counts per status, blockers,
 * and the tasks themselves. Members with no task created or touched that day
 * are included with `updated: false`, so "who hasn't updated yet" is just a
 * filter on the result.
 */
export function summarizeByMember(tasks, team) {
  const map = new Map(
    team.map((m) => [
      m.id,
      {
        id: m.id,
        name: m.name,
        role: m.role,
        color: m.avatar_color,
        tasks: [],
        counts: emptyCounts(),
        blocked: 0,
      },
    ]),
  );
  tasks.forEach((t) => {
    if (!map.has(t.assignee_id)) {
      // Task owned by someone no longer on the team list; still report it.
      map.set(t.assignee_id, {
        id: t.assignee_id,
        name: t.assignee_name || "—",
        role: t.assignee_role,
        color: t.assignee_color,
        tasks: [],
        counts: emptyCounts(),
        blocked: 0,
      });
    }
    const m = map.get(t.assignee_id);
    m.tasks.push(t);
    m.counts[t.status] = (m.counts[t.status] || 0) + 1;
    if (t.blocker) m.blocked += 1;
  });
  return [...map.values()]
    .map((m) => ({ ...m, total: m.tasks.length, updated: m.tasks.length > 0 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

const STATUS_MARK = {
  Done: "✅",
  "In Review": "🔍",
  "In Progress": "🔄",
  Pending: "⏸️",
  Backlog: "•",
};

/**
 * Plain-text report for the day, ready to paste into WhatsApp / Slack / email.
 */
export function buildDailyReport(date, members) {
  const updated = members.filter((m) => m.updated);
  const missing = members.filter((m) => !m.updated);
  const tasks = updated.flatMap((m) => m.tasks);
  const done = tasks.filter((t) => t.status === "Done").length;
  const blocked = tasks.filter((t) => t.blocker).length;

  const lines = [
    `*Daily Task Report — ${formatDay(date)}*`,
    `${updated.length}/${members.length} members updated · ${plural(tasks.length, "task")} · ${done} done` +
      (blocked ? ` · ${blocked} blocked` : ""),
    "",
  ];

  updated.forEach((m) => {
    lines.push(`*${m.name}*${m.role ? ` (${m.role})` : ""} — ${plural(m.total, "task")}, ${m.counts.Done || 0} done`);
    const ordered = [...m.tasks].sort(
      (a, b) => STATUSES.indexOf(b.status) - STATUSES.indexOf(a.status),
    );
    ordered.forEach((t) => {
      lines.push(
        `  ${STATUS_MARK[t.status] || "•"} [${t.item_wb_ref}] ${t.title} — ${t.status}`,
      );
      if (t.blocker) lines.push(`      ⚠️ Blocker: ${t.blocker}`);
    });
    lines.push("");
  });

  if (missing.length > 0) {
    lines.push(`*Not updated yet (${missing.length}):* ${missing.map((m) => m.name).join(", ")}`);
  } else {
    lines.push("Everyone has updated their tasks today. 🎉");
  }

  return lines.join("\n").trim();
}
