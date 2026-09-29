import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardTitle } from "./parts";
import { CheckCircle } from "@phosphor-icons/react";

const REASON_STYLE = {
  overdue: { bg: "#FEE2E2", text: "#991B1B" },
  hold: { bg: "#FFEDD5", text: "#9A3412" },
  p1: { bg: "#FEF3C7", text: "#92400E" },
  unassigned: { bg: "#F1F5F9", text: "#475569" },
};

const KIND_LABEL = {
  overdue: "Overdue",
  hold: "On hold",
  p1: "P1 not started",
  unassigned: "Unassigned",
};

const LIMIT = 8;

/** The short list a manager should chase today, worst first. */
export default function AttentionCard({ rows, projectMap, teamMap }) {
  const [showAll, setShowAll] = useState(false);
  const counts = {};
  rows.forEach((r) => r.reasons.forEach((x) => (counts[x.kind] = (counts[x.kind] || 0) + 1)));
  const shown = showAll ? rows : rows.slice(0, LIMIT);

  return (
    <Card className="p-5 flex flex-col" data-testid="card-attention">
      <CardTitle eyebrow="Needs Attention" title={`${rows.length} items to chase`} />

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-sm text-slate-500 gap-2 py-8">
          <CheckCircle size={28} className="text-emerald-600" />
          Nothing overdue, on hold or unassigned.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.keys(KIND_LABEL)
              .filter((k) => counts[k])
              .map((k) => (
                <span
                  key={k}
                  className="text-[11px] font-semibold rounded-sm px-1.5 py-0.5"
                  style={{ backgroundColor: REASON_STYLE[k].bg, color: REASON_STYLE[k].text }}
                >
                  {KIND_LABEL[k]} · {counts[k]}
                </span>
              ))}
          </div>

          <ul className="divide-y divide-slate-100 -mx-1 flex-1 overflow-y-auto max-h-[420px] scrollbar-thin">
            {shown.map(({ item, reasons }) => {
              const p = projectMap[item.project_id];
              const owner = teamMap[item.dev_assignee_id] || teamMap[item.qa_assignee_id];
              return (
                <li key={item.id} className="px-1 py-2" data-testid={`attention-${item.wb_ref}`}>
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    {reasons.map((x) => (
                      <span
                        key={x.kind}
                        className="text-[10px] font-semibold rounded-sm px-1 py-px"
                        style={{
                          backgroundColor: REASON_STYLE[x.kind].bg,
                          color: REASON_STYLE[x.kind].text,
                        }}
                      >
                        {x.label}
                      </span>
                    ))}
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      {item.wb_ref} · {item.priority}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 truncate" title={item.title}>
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {p ? `${p.code || p.name}` : "No project"}
                    {" · "}
                    {owner ? owner.name : "nobody assigned"}
                    {item.target_date ? ` · target ${item.target_date}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between pt-3 text-xs">
            {rows.length > LIMIT ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-[#0033CC] hover:underline"
                data-testid="attention-toggle"
              >
                {showAll ? "Show top 8" : `Show all ${rows.length}`}
              </button>
            ) : (
              <span />
            )}
            <Link to="/backlog" className="text-slate-500 hover:text-[#0033CC]">
              Open backlog →
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}
