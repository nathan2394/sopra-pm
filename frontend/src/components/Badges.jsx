import { PRIORITY_COLORS, SYSTEM_COLORS, STATUS_COLORS } from "@/lib/constants";

export function PriorityBadge({ priority }) {
  const c = PRIORITY_COLORS[priority] || PRIORITY_COLORS.P4;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-semibold font-mono"
      style={{ backgroundColor: c.bg, color: c.text }}
      data-testid={`priority-badge-${priority}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: c.dot }}
      />
      {priority}
    </span>
  );
}

export function SystemBadge({ system }) {
  const c = SYSTEM_COLORS[system] || { bg: "#F3F4F6", text: "#374151" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}
      data-testid={`system-badge-${system}`}
    >
      {system}
    </span>
  );
}

export function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Backlog;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}
      data-testid={`status-badge-${status.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: c.dot }}
      />
      {status}
    </span>
  );
}
