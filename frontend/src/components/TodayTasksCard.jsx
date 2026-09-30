import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDailyTasks, fetchTeam } from "@/lib/api";
import { EVENING_HOUR, isoToday, isEvening, summarizeByMember } from "@/lib/dailyReport";
import DailyReportDialog from "@/components/DailyReportDialog";
import { Button } from "@/components/ui/button";
import { Moon, CheckCircle, WarningCircle, ArrowRight } from "@phosphor-icons/react";

function MemberChip({ m, missing }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs border ${
        missing
          ? "border-red-200 bg-red-50 text-red-800 font-semibold"
          : "border-slate-200 bg-white text-slate-600"
      }`}
      title={m.role}
      data-testid={`${missing ? "today-missing" : "today-updated"}-${m.id}`}
    >
      <span
        className="w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold text-white font-mono"
        style={{ backgroundColor: m.color || "#64748B" }}
      >
        {m.name.slice(0, 2).toUpperCase()}
      </span>
      {m.name}
    </span>
  );
}

/**
 * Dashboard card with one job: who has not registered a daily task today.
 * The detail lives on the Daily Tasks page; the evening report is one click.
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
  const updated = members.filter((m) => m.updated);
  const evening = isEvening();

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-5" data-testid="card-today-tasks">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Daily Task Update · Today
          </div>
          <h2 className="font-display font-bold text-xl text-slate-900 mt-1">
            {loaded ? `${updated.length}/${members.length} members registered` : "Loading…"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/daily"
            className="text-xs text-slate-500 hover:text-[#0033CC] flex items-center gap-1"
            data-testid="today-open-daily"
          >
            Daily Tasks <ArrowRight size={12} />
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

      {loaded &&
        (missing.length === 0 ? (
          <div
            className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-sm p-3"
            data-testid="today-all-registered"
          >
            <CheckCircle size={16} weight="fill" />
            Everyone has registered today&apos;s tasks.
          </div>
        ) : (
          <div data-testid="today-missing-list">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-2">
              <WarningCircle size={14} weight="fill" />
              Not registered yet · {missing.length}
              {evening && (
                <span className="font-normal text-red-600">— it&apos;s past {EVENING_HOUR}:00</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((m) => (
                <MemberChip key={m.id} m={m} missing />
              ))}
            </div>
          </div>
        ))}

      {loaded && updated.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1.5">
            Registered · {updated.length}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {updated.map((m) => (
              <MemberChip key={m.id} m={m} />
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
