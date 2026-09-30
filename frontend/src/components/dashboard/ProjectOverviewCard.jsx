import { useNavigate } from "react-router-dom";
import { Card, CardTitle, HealthBadge, Meter, StatusBar, StatusLegend } from "./parts";

const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** Every live project on one screen: health, delivery, status mix, what is stuck. */
export default function ProjectOverviewCard({ rows }) {
  const navigate = useNavigate();
  const offTrack = rows.filter((r) => r.health === "Off track").length;
  const atRisk = rows.filter((r) => r.health === "At risk").length;

  return (
    <Card className="p-5" data-testid="card-projects-overview">
      <CardTitle eyebrow="Project Overview" title="Health & Delivery per Project">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">{rows.length} projects</span>
          {offTrack > 0 && <HealthBadge health="Off track" label={`${offTrack} off track`} />}
          {atRisk > 0 && <HealthBadge health="At risk" label={`${atRisk} at risk`} />}
        </div>
      </CardTitle>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b border-slate-200 whitespace-nowrap">
              <th className="text-left py-2 font-semibold">Project</th>
              <th className="text-left py-2 font-semibold">Health</th>
              <th className="text-left py-2 font-semibold w-44">Delivered</th>
              <th className="text-left py-2 font-semibold pl-4 w-48">Status mix</th>
              <th className="text-right py-2 font-semibold">Open</th>
              <th className="text-right py-2 font-semibold">On hold</th>
              <th className="text-right py-2 font-semibold">Overdue</th>
              <th className="text-left py-2 font-semibold pl-4">Phase</th>
              <th className="text-left py-2 font-semibold">Next target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                onClick={() => r.id != null && navigate(`/projects/${r.id}`)}
                className={`border-b border-slate-100 ${
                  r.id != null ? "cursor-pointer hover:bg-slate-50" : ""
                }`}
                data-testid={`project-row-${r.code}`}
              >
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-white font-mono shrink-0"
                      style={{ backgroundColor: r.color }}
                    >
                      {r.code || "—"}
                    </span>
                    <div className="min-w-0 leading-tight">
                      <div className="text-sm font-semibold text-slate-900 truncate">{r.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {r.owner ? `Owner: ${r.owner}` : "No owner"}
                        {r.status && r.status !== "Active" ? ` · ${r.status}` : ""}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5">
                  <HealthBadge health={r.health} title={r.reasons.join(" · ") || undefined} />
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Meter
                        value={r.completion}
                        color="#059669"
                        title={`${r.doneSp} of ${r.totalSp} SP done`}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-900 w-9 text-right">
                      {r.completion}%
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {r.doneSp}/{r.totalSp} SP
                  </div>
                </td>
                <td className="py-2.5 pl-4">
                  <StatusBar counts={r.counts} />
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">{r.items} items</div>
                </td>
                <td className="py-2.5 text-right font-mono text-sm">{r.openItems}</td>
                <td
                  className={`py-2.5 text-right font-mono text-sm ${
                    r.onHold ? "font-bold text-slate-900" : "text-slate-400"
                  }`}
                >
                  {r.onHold}
                </td>
                <td
                  className={`py-2.5 text-right font-mono text-sm ${
                    r.overdue ? "font-bold text-red-700" : "text-slate-400"
                  }`}
                >
                  {r.overdue}
                </td>
                <td className="py-2.5 pl-4 text-xs text-slate-700 whitespace-nowrap">
                  {r.currentPhase || "—"}
                </td>
                <td className="py-2.5 text-xs font-mono text-slate-700 whitespace-nowrap">
                  {fmtDate(r.nextTarget)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StatusLegend className="mt-3" />
    </Card>
  );
}
