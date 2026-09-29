import { Avatar, Card, CardTitle, Meter, StatusBar, StatusLegend } from "./parts";

const FLAG_STYLE = {
  Overloaded: { bg: "#FEE2E2", text: "#991B1B" },
  "Nothing active": { bg: "#FEF3C7", text: "#92400E" },
  "No open work": { bg: "#F1F5F9", text: "#475569" },
};

/**
 * Per member: active-sprint load against capacity, what they are carrying
 * across all roles, and what is stuck on them.
 */
export default function TeamLoadCard({ rows, sprint }) {
  const totalSprintSp = rows.reduce((a, r) => a + r.sprintSp, 0);
  const totalCapacity = rows.reduce((a, r) => a + r.capacity, 0);
  const teamLoad = totalCapacity ? Math.round((totalSprintSp / totalCapacity) * 100) : 0;
  const overloaded = rows.filter((r) => r.flag === "Overloaded").length;
  const idle = rows.filter((r) => r.flag === "Nothing active" || r.flag === "No open work").length;

  return (
    <Card className="p-5" data-testid="card-team-load">
      <CardTitle eyebrow="Team" title="Workload & Focus per Member">
        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
          {sprint && (
            <span>
              {sprint.name} load{" "}
              <b className="font-mono text-slate-900">
                {totalSprintSp}/{totalCapacity} SP ({teamLoad}%)
              </b>
            </span>
          )}
          {overloaded > 0 && (
            <span className="text-red-700 font-semibold">{overloaded} overloaded</span>
          )}
          {idle > 0 && <span className="text-amber-700 font-semibold">{idle} with nothing active</span>}
        </div>
      </CardTitle>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b border-slate-200 whitespace-nowrap">
              <th className="text-left py-2 font-semibold">Member</th>
              <th className="text-left py-2 font-semibold w-48">
                {sprint ? "Sprint load vs capacity" : "Sprint load"}
              </th>
              <th className="text-right py-2 font-semibold">Open</th>
              <th className="text-right py-2 font-semibold">Active</th>
              <th className="text-right py-2 font-semibold">On hold</th>
              <th className="text-right py-2 font-semibold">Overdue</th>
              <th className="text-right py-2 font-semibold">Projects</th>
              <th className="text-left py-2 font-semibold pl-4 w-44">All items</th>
              <th className="text-right py-2 font-semibold">Done SP</th>
              <th className="text-left py-2 font-semibold pl-4">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100" data-testid={`team-row-${r.id}`}>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.name} color={r.color} />
                    <div className="leading-tight">
                      <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                      <div className="text-[11px] text-slate-500">{r.role}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Meter
                        value={r.loadPct}
                        over={r.flag === "Overloaded"}
                        title={`${r.sprintSp} SP in sprint · capacity ${r.capacity} SP`}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-900 w-10 text-right">
                      {r.loadPct}%
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {r.sprintDoneSp}/{r.sprintSp} SP done · cap {r.capacity}
                  </div>
                </td>
                <td className="py-2.5 text-right font-mono text-sm">{r.open}</td>
                <td className="py-2.5 text-right font-mono text-sm">{r.active}</td>
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
                <td className="py-2.5 text-right font-mono text-sm">{r.projects}</td>
                <td className="py-2.5 pl-4">
                  <StatusBar counts={r.counts} />
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">{r.items} items</div>
                </td>
                <td className="py-2.5 text-right font-mono text-sm font-semibold">{r.doneSp}</td>
                <td className="py-2.5 pl-4">
                  {r.flag ? (
                    <span
                      className="text-[11px] font-semibold rounded-sm px-1.5 py-0.5 whitespace-nowrap"
                      style={{
                        backgroundColor: FLAG_STYLE[r.flag].bg,
                        color: FLAG_STYLE[r.flag].text,
                      }}
                    >
                      {r.flag}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">—</span>
                  )}
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
