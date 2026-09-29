import { STATUSES } from "@/lib/constants";

/**
 * Management roll-ups for the dashboard, computed from the plain backlog,
 * project, sprint and team lists so every backend serves them unchanged.
 * Dates are "yyyy-MM-dd" strings, which compare correctly as strings.
 */

const ASSIGNEE_FIELDS = [
  "dev_assignee_id",
  "qa_assignee_id",
  "uiux_assignee_id",
  "data_eng_assignee_id",
];

export const emptyStatusCounts = () => Object.fromEntries(STATUSES.map((s) => [s, 0]));

export const isOverdue = (item, today) =>
  item.status !== "Done" && !!item.target_date && item.target_date < today;

export const daysBetween = (from, to) => {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const assigneesOf = (item) =>
  [...new Set(ASSIGNEE_FIELDS.map((f) => item[f]).filter((v) => v != null))];

/** The sprint marked Active, else the one whose dates cover today. */
export function findActiveSprint(sprints, today) {
  return (
    sprints.find((s) => s.status === "Active") ||
    sprints.find((s) => s.start_date <= today && today <= s.end_date) ||
    null
  );
}

/** Delivered vs planned for the sprint, set against how much of it has elapsed. */
export function sprintProgress(sprint, items, today) {
  if (!sprint) return null;
  const inSprint = items.filter((i) => i.sprint_id === sprint.id);
  const plannedSp = inSprint.reduce((a, i) => a + (i.story_points || 0), 0);
  const doneSp = inSprint
    .filter((i) => i.status === "Done")
    .reduce((a, i) => a + (i.story_points || 0), 0);
  const totalDays = Math.max(daysBetween(sprint.start_date, sprint.end_date) + 1, 1);
  const elapsed = Math.min(Math.max(daysBetween(sprint.start_date, today) + 1, 0), totalDays);
  const donePct = pct(doneSp, plannedSp);
  const timePct = pct(elapsed, totalDays);
  return {
    sprint,
    items: inSprint.length,
    plannedSp,
    doneSp,
    donePct,
    day: elapsed,
    totalDays,
    daysLeft: totalDays - elapsed,
    timePct,
    // Behind when delivery trails the calendar by more than 15 points.
    behind: plannedSp > 0 && timePct - donePct > 15,
  };
}

/**
 * One row per project: delivery, status mix, what is late or on hold, the
 * phase currently being worked, and a health call with its reasons.
 */
export function projectOverview(projects, items, team, today) {
  const teamById = new Map(team.map((m) => [m.id, m]));
  const buckets = new Map();
  const bucketFor = (key, project) => {
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        project,
        items: [],
      });
    }
    return buckets.get(key);
  };

  projects
    .filter((p) => p.status !== "Archived")
    .forEach((p) => bucketFor(p.id, p));
  items.forEach((i) => {
    if (i.project_id != null && !buckets.has(i.project_id)) return; // archived project
    bucketFor(i.project_id ?? "none", i.project_id == null ? null : undefined).items.push(i);
  });

  const rows = [...buckets.values()]
    .filter((b) => b.project || b.items.length > 0)
    .map((b) => {
      const p = b.project;
      const counts = emptyStatusCounts();
      let totalSp = 0;
      let doneSp = 0;
      b.items.forEach((i) => {
        counts[i.status] = (counts[i.status] || 0) + 1;
        totalSp += i.story_points || 0;
        if (i.status === "Done") doneSp += i.story_points || 0;
      });
      const open = b.items.filter((i) => i.status !== "Done");
      const overdue = open.filter((i) => isOverdue(i, today));
      const onHold = counts.Pending || 0;
      const phases = [...new Set(open.map((i) => i.phase).filter(Boolean))].sort((a, c) =>
        a.localeCompare(c, undefined, { numeric: true }),
      );
      const nextTarget = open
        .map((i) => i.target_date)
        .filter((d) => d && d >= today)
        .sort()[0];
      const started = b.items.length - (counts.Backlog || 0);
      const completion = pct(doneSp, totalSp);

      const reasons = [];
      if (overdue.length) reasons.push(`${overdue.length} overdue`);
      if (onHold) reasons.push(`${onHold} on hold`);

      let health;
      if (b.items.length === 0) health = "No items";
      else if (open.length === 0) health = "Complete";
      else if (overdue.length >= 2 || (overdue.length && overdue.length / open.length > 0.2))
        health = "Off track";
      else if (overdue.length || onHold) health = "At risk";
      else if (started === 0) health = "Not started";
      else health = "On track";

      return {
        key: b.key,
        id: p?.id ?? null,
        name: p?.name ?? "No project",
        code: p?.code ?? "—",
        color: p?.color ?? "#64748B",
        status: p?.status ?? null,
        owner: p?.owner_id != null ? teamById.get(p.owner_id)?.name : null,
        items: b.items.length,
        openItems: open.length,
        totalSp,
        doneSp,
        completion,
        counts,
        overdue: overdue.length,
        onHold,
        currentPhase: phases[0] || null,
        nextTarget: nextTarget || null,
        health,
        reasons,
      };
    });

  const rank = { "Off track": 0, "At risk": 1, "On track": 2, "Not started": 3, Complete: 4, "No items": 5 };
  return rows.sort(
    (a, b) => rank[a.health] - rank[b.health] || b.openItems - a.openItems || a.name.localeCompare(b.name),
  );
}

/**
 * Per member: what they carry across every assignee role, how much of the
 * active sprint sits on them against their capacity, and what is stuck.
 */
export function memberLoad(team, items, sprint, today) {
  const rows = new Map(
    team.map((m) => [
      m.id,
      {
        id: m.id,
        name: m.name,
        role: m.role,
        color: m.avatar_color,
        capacity: m.capacity_sp || 0,
        counts: emptyStatusCounts(),
        items: 0,
        open: 0,
        active: 0,
        onHold: 0,
        overdue: 0,
        doneSp: 0,
        sprintSp: 0,
        sprintDoneSp: 0,
        projects: new Set(),
      },
    ]),
  );
  items.forEach((i) => {
    assigneesOf(i).forEach((id) => {
      const r = rows.get(id);
      if (!r) return;
      const sp = i.story_points || 0;
      r.items += 1;
      r.counts[i.status] = (r.counts[i.status] || 0) + 1;
      if (i.status !== "Done") {
        r.open += 1;
        if (i.project_id != null) r.projects.add(i.project_id);
      } else r.doneSp += sp;
      if (i.status === "In Progress" || i.status === "In Review") r.active += 1;
      if (i.status === "Pending") r.onHold += 1;
      if (isOverdue(i, today)) r.overdue += 1;
      if (sprint && i.sprint_id === sprint.id) {
        r.sprintSp += sp;
        if (i.status === "Done") r.sprintDoneSp += sp;
      }
    });
  });
  return [...rows.values()]
    .map((r) => {
      const loadPct = pct(r.sprintSp, r.capacity);
      let flag = null;
      if (r.capacity && r.sprintSp > r.capacity) flag = "Overloaded";
      else if (r.open === 0) flag = "No open work";
      else if (r.active === 0) flag = "Nothing active";
      return { ...r, projects: r.projects.size, loadPct, flag };
    })
    .sort((a, b) => b.loadPct - a.loadPct || b.open - a.open || a.name.localeCompare(b.name));
}

/**
 * Items management should look at now, most urgent first: overdue, on hold,
 * P1 not started, and active-sprint work with nobody on it.
 */
export function attentionItems(items, sprint, today) {
  const out = [];
  items.forEach((i) => {
    if (i.status === "Done") return;
    const reasons = [];
    let score = 0;
    if (isOverdue(i, today)) {
      const late = daysBetween(i.target_date, today);
      reasons.push({ kind: "overdue", label: `${late}d overdue` });
      score += 1000 + late;
    }
    if (i.status === "Pending") {
      reasons.push({ kind: "hold", label: "On hold" });
      score += 500;
    }
    const inSprint = sprint && i.sprint_id === sprint.id;
    if (i.priority === "P1" && i.status === "Backlog" && inSprint) {
      reasons.push({ kind: "p1", label: "P1 not started" });
      score += 300;
    }
    if (inSprint && assigneesOf(i).length === 0) {
      reasons.push({ kind: "unassigned", label: "Unassigned" });
      score += 200;
    }
    if (reasons.length) {
      score += { P1: 40, P2: 30, P3: 20, P4: 10 }[i.priority] || 0;
      out.push({ item: i, reasons, score });
    }
  });
  return out.sort((a, b) => b.score - a.score);
}
