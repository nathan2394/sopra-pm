import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDailyTasks, fetchTeam } from "@/lib/api";
import { STATUSES, STATUS_COLORS } from "@/lib/constants";
import {
  EVENING_HOUR,
  isoToday,
  isEvening,
  plural,
  summarizeByMember,
} from "@/lib/dailyReport";
import DailyReportDialog from "@/components/DailyReportDialog";
import { Button } from "@/components/ui/button";
import { Moon, Warning, ArrowRight } from "@phosphor-icons/react";

/** Latest "HH:mm" a member touched a task today (server-local time). */
const lastUpdate = (tasks) =>
  tasks
    .map((t) => t.updated_at || t.created_at || "")
    .sort()
    .pop()
    ?.slice(11, 16);

/**
 * Dashboard card: today's tasks per member, who hasn't updated yet, and the
 * evening report.
 */
export default function TodayTasksCard() {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const today = isoToday();

  useEffect(() => {
    Promise.all([fetchDailyTasks({ date: today }), fetchTeam()])
      .then(([t, m]) => {
        setTasks(t);
        setTeam(m);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [today]);

  const members = useMemo(() => summarizeByMember(tasks, team), [tasks, team]);
  const missing = members.filter((m) => !m.updated);
  const updatedCount = members.length - missing.length;
  const evening = isEvening();

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-5" data-testid="card-today-tasks">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Daily Tasks · Today
          </div>
          <h2 className="font-display font-black text-xl tracking-tight text-slate-900 mt-1">
            {updatedCount}/{members.length} members updated · {plural(tasks.length, "task")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/daily"
            className="text-xs text-slate-500 hover:text-[#0033CC] flex items-center gap-1"
            data-testid="today-open-daily"
          >
            Open Daily Tasks <ArrowRight size={12} />
          </Link>
          <Button
            variant={evening ? "default" : "outline"}
            className={`rounded-sm h-9 text-xs ${evening ? "bg-[#0033CC] hover:bg-[#0028A3]" : ""}`}
            onClick={() => setReportOpen(true)}
            disabled={!loaded}
            data-testid="today-report-open"
          >
            <Moon size={14} className="mr-1.5" />
            Evening report
          </Button>
        </div>
      </div>

      {evening && missing.length > 0 && (
        <div
          className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-sm p-2.5 mb-4"
          data-testid="today-missing-alert"
        >
          <Warning size={14} className="mt-0.5 shrink-0" />
          <span>
            It&apos;s past {EVENING_HOUR}:00 and {missing.length}{" "}
            {missing.length === 1 ? "member hasn't" : "members haven't"} updated their daily
            tasks: <b>{missing.map((m) => m.name).join(", ")}</b>
          </span>
        </div>
      )}

      {!loaded ? (
        <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b border-slate-200">
                <th className="text-left py-2 font-semibold">Member</th>
                <th className="text-left py-2 font-semibold">Status</th>
                <th className="text-right py-2 font-semibold">Tasks</th>
                <th className="text-right py-2 font-semibold">Done</th>
                <th className="text-right py-2 font-semibold">Blocked</th>
                <th className="text-left py-2 font-semibold pl-4 w-2/5">Today&apos;s mix</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  className={`border-b border-slate-100 ${m.updated ? "" : "bg-red-50/40"}`}
                  data-testid={`today-row-${m.id}`}
                >
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold text-white font-mono"
                        style={{ backgroundColor: m.color || "#64748B" }}
                      >
                        {m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="leading-tight">
                        <div className="text-sm font-semibold text-slate-900">{m.name}</div>
                        <div className="text-[11px] text-slate-500">{m.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5">
                    {m.updated ? (
                      <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-sm px-1.5 py-0.5">
                        Updated · {lastUpdate(m.tasks)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-widest text-red-700 bg-red-50 border border-red-200 rounded-sm px-1.5 py-0.5">
                        Not updated
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right font-mono text-sm">{m.total}</td>
                  <td className="py-2.5 text-right font-mono text-sm">{m.counts.Done || 0}</td>
                  <td
                    className={`py-2.5 text-right font-mono text-sm ${
                      m.blocked ? "text-amber-700 font-bold" : ""
                    }`}
                  >
                    {m.blocked}
                  </td>
                  <td className="py-2.5 pl-4">
                    {m.total > 0 ? (
                      <div
                        className="flex h-2 rounded-sm overflow-hidden bg-slate-100"
                        title={STATUSES.filter((s) => m.counts[s])
                          .map((s) => `${s}: ${m.counts[s]}`)
                          .join(" · ")}
                      >
                        {STATUSES.map((s) =>
                          m.counts[s] ? (
                            <div
                              key={s}
                              style={{
                                width: `${(m.counts[s] / m.total) * 100}%`,
                                backgroundColor: STATUS_COLORS[s].dot,
                              }}
                            />
                          ) : null,
                        )}
                      </div>
                    ) : (
                      <div className="h-2 rounded-sm bg-slate-100" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 flex-wrap mt-3">
            {STATUSES.map((s) => (
              <span key={s} className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: STATUS_COLORS[s].dot }}
                />
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <DailyReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        date={today}
        members={members}
      />
    </div>
  );
}
