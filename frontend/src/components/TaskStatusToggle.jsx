import { CheckCircle, Circle } from "@phosphor-icons/react";
import { TASK_STATUS_COLORS, taskStatus } from "@/lib/constants";

/** Complete / Incomplete, flipped with one click. */
export default function TaskStatusToggle({ status, onChange, className = "", testId }) {
  const current = taskStatus(status);
  const complete = current === "Complete";
  const c = TASK_STATUS_COLORS[current];
  return (
    <button
      type="button"
      onClick={() => onChange(complete ? "Incomplete" : "Complete")}
      className={`inline-flex items-center justify-center gap-1 rounded-sm border px-2 h-7 text-[11px] font-mono font-semibold shrink-0 transition-colors ${className}`}
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.dot }}
      title={complete ? "Mark incomplete" : "Mark complete"}
      aria-pressed={complete}
      data-testid={testId}
    >
      {complete ? <CheckCircle size={13} weight="fill" /> : <Circle size={13} weight="bold" />}
      {current}
    </button>
  );
}
