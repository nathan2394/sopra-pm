import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import WeeklyReportView from "@/components/WeeklyReportView";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
 * The shareable report: no sign-in, no navigation chrome, same view as /weekly.
 * Uses a bare fetch rather than the app's API client so the 401 interceptor can
 * never bounce a reader to the login page.
 */
export default function PublicWeeklyReport() {
  const [params, setParams] = useSearchParams();
  const key = params.get("k") || "";

  const weekStart = useMemo(() => {
    const w = params.get("week");
    return w ? mondayOf(new Date(`${w}T00:00:00`)) : mondayOf(new Date());
  }, [params]);

  const from = iso(weekStart);
  const to = iso(addDays(weekStart, 6));

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const qs = new URLSearchParams({ from, to, ...(key ? { k: key } : {}) });
    fetch(`${API}/public/weekly?${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Report unavailable");
        return r.json();
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [from, to, key]);

  const goWeek = (delta) => {
    const p = new URLSearchParams(params);
    p.set("week", iso(addDays(weekStart, delta * 7)));
    setParams(p);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WeeklyReportView
          from={from}
          to={to}
          data={data}
          error={error}
          onPrev={() => goWeek(-1)}
          onNext={() => goWeek(1)}
        />
      </div>
    </div>
  );
}
