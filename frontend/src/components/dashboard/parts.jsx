import { STATUSES, STATUS_COLORS } from "@/lib/constants";
import {
  CheckCircle,
  WarningCircle,
  XCircle,
  MinusCircle,
  Circle,
} from "@phosphor-icons/react";

export function Card({ children, className = "", ...rest }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ eyebrow, title, children }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {eyebrow}
        </div>
        <h2 className="font-display font-bold text-xl text-slate-900 mt-1">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/**
 * Part-to-whole bar of counts per status. Segments are separated by a 2px
 * surface gap; each carries its own hover title, and the numbers are always
 * shown next to it somewhere (legend or table), never only on hover.
 */
export function StatusBar({ counts, height = "h-2", unit = "items", className = "" }) {
  const total = STATUSES.reduce((a, s) => a + (counts[s] || 0), 0);
  if (total === 0) return <div className={`${height} rounded-sm bg-slate-100 ${className}`} />;
  return (
    <div
      className={`flex gap-[2px] ${height} ${className}`}
      role="img"
      aria-label={STATUSES.filter((s) => counts[s])
        .map((s) => `${s} ${counts[s]}`)
        .join(", ")}
    >
      {STATUSES.map((s) =>
        counts[s] ? (
          <div
            key={s}
            className="first:rounded-l-sm last:rounded-r-sm hover:opacity-80"
            style={{
              flexGrow: counts[s],
              flexBasis: 0,
              minWidth: 3,
              backgroundColor: STATUS_COLORS[s].dot,
            }}
            title={`${s}: ${counts[s]} ${unit} (${Math.round((counts[s] / total) * 100)}%)`}
          />
        ) : null,
      )}
    </div>
  );
}

export function StatusLegend({ counts, className = "" }) {
  return (
    <div className={`flex items-center gap-x-4 gap-y-1 flex-wrap ${className}`}>
      {STATUSES.map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_COLORS[s].dot }} />
          {s}
          {counts && <span className="font-mono font-semibold text-slate-900">{counts[s] || 0}</span>}
        </span>
      ))}
    </div>
  );
}

const HEALTH = {
  "Off track": { bg: "#FEE2E2", text: "#991B1B", icon: XCircle },
  "At risk": { bg: "#FEF3C7", text: "#92400E", icon: WarningCircle },
  "On track": { bg: "#D1FAE5", text: "#065F46", icon: CheckCircle },
  Complete: { bg: "#D1FAE5", text: "#065F46", icon: CheckCircle },
  "Not started": { bg: "#F1F5F9", text: "#475569", icon: Circle },
  "No items": { bg: "#F1F5F9", text: "#475569", icon: MinusCircle },
};

/** Health is always icon + label, never colour alone. */
export function HealthBadge({ health, title, label }) {
  const h = HEALTH[health] || HEALTH["No items"];
  const Icon = h.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: h.bg, color: h.text }}
      title={title}
      data-testid={`health-${health.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <Icon size={12} weight="bold" />
      {label ?? health}
    </span>
  );
}

export function Avatar({ name, color, size = "w-7 h-7 text-xs" }) {
  return (
    <div
      className={`${size} rounded-sm shrink-0 flex items-center justify-center font-bold text-white font-mono`}
      style={{ backgroundColor: color || "#64748B" }}
    >
      {(name || "—").slice(0, 2).toUpperCase()}
    </div>
  );
}

/** A value against a limit: the bar fills to the value, a tick marks the reference. */
export function Meter({ value, marker, color = "#0033CC", over = false, title }) {
  return (
    <div className="relative h-2 bg-slate-100 rounded-sm" title={title}>
      <div
        className="h-full rounded-sm"
        style={{
          width: `${Math.min(value, 100)}%`,
          backgroundColor: over ? "#DC2626" : color,
        }}
      />
      {marker != null && (
        <div
          className="absolute -top-1 -bottom-1 w-0.5 bg-slate-900"
          style={{ left: `calc(${Math.min(marker, 100)}% - 1px)` }}
        />
      )}
    </div>
  );
}
