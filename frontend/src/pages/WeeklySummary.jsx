import { useEffect, useMemo, useState } from "react";
import { fetchWeeklyInsight } from "@/lib/api";
import WeeklyReportView from "@/components/WeeklyReportView";

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const mondayOf = (d) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * The signed-in view of the weekly report. It renders the very same component
 * the public link does, so what management sees and what the team sees can
 * never drift apart — only the way the data is fetched differs.
 */
export default function WeeklySummary() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const from = iso(weekStart);
  const to = useMemo(() => iso(addDays(weekStart, 6)), [weekStart]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetchWeeklyInsight(from, to)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError("Could not load this week's report"));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return (
    <div data-testid="weekly-page">
      <WeeklyReportView
        from={from}
        to={to}
        data={data}
        error={error}
        onPrev={() => setWeekStart(addDays(weekStart, -7))}
        onNext={() => setWeekStart(addDays(weekStart, 7))}
      />
    </div>
  );
}
