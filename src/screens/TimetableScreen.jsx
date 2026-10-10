import { useEffect, useMemo, useState } from "react";
import { fetchMyTimetableApi, fetchTimetableArchiveApi } from "../services/api";

const monthLabel = (year, month) => new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shiftClass = (shift) => {
  const value = (shift || "").toLowerCase();
  if (value === "off") return "bg-slate-300 text-slate-900";
  if (/leave|holiday/.test(value)) return "bg-cyan-300 text-slate-950";
  if (/^(7|8)\s*(a\.?m?\.?|am)/.test(value)) return "bg-lime-400 text-slate-950";
  if (/^3\s*(p\.?m?\.?|pm)/.test(value)) return "bg-rose-500 text-slate-950";
  if (/^(12\s*a|2\s*p|3\s*p)/.test(value)) return "bg-fuchsia-500 text-slate-950";
  return "bg-violet-400 text-slate-950";
};

export default function TimetableScreen({ activeScreen, currentAgent }) {
  const [archive, setArchive] = useState([]);
  const [selected, setSelected] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadedArchive, setLoadedArchive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (activeScreen !== "timetable" || !currentAgent?.agent_initials) return;
    let cancelled = false;
    fetchTimetableArchiveApi(currentAgent.agent_initials).then((items) => {
      if (cancelled) return;
      const list = Array.isArray(items) ? items : [];
      setArchive(list);
      setSelected((existing) => existing || (list[0] ? `${list[0].year}-${list[0].month}` : `${new Date().getFullYear()}-${new Date().getMonth() + 1}`));
      setLoadedArchive(true);
    });
    return () => { cancelled = true; };
  }, [activeScreen, currentAgent?.agent_initials]);

  const [year, month] = (selected || `${new Date().getFullYear()}-${new Date().getMonth() + 1}`).split("-").map(Number);
  useEffect(() => {
    if (activeScreen !== "timetable" || !currentAgent?.agent_initials || !selected) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setSchedule(null);
    fetchMyTimetableApi(currentAgent.agent_initials, year, month)
      .then((data) => {
        if (cancelled) return;
        if (data?.entries) setSchedule(data);
      })
      .catch((err) => { if (!cancelled) setError(err.message || "Could not load this timetable."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeScreen, currentAgent?.agent_initials, selected, year, month]);

  const dayMap = useMemo(() => new Map((schedule?.entries || []).map((entry) => [entry.date, entry.shift])), [schedule]);
  const weeks = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const start = new Date(year, month - 1, 1 - first.getDay());
    const count = Math.ceil((first.getDay() + new Date(year, month, 0).getDate()) / 7);
    return Array.from({ length: count }, (_, weekIndex) => Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start);
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      return date;
    }));
  }, [year, month]);
  const totals = useMemo(() => {
    const counts = new Map();
    (schedule?.entries || []).forEach(({ shift }) => {
      const label = shift.trim();
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [schedule]);

  if (activeScreen !== "timetable" || !currentAgent) return null;

  return (
    <section className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.25em] text-fuchsia-400 font-bold">Your work schedule</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-black" style={{ color: "var(--app-text)" }}>{currentAgent.agent_name}'s timetable</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Monthly shifts and days off, in one place.</p>
        </div>
        <label className="relative flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}>
          <span className="text-fuchsia-400">🗓️</span>
          {selected && monthLabel(year, month)}
          <span>⌄</span>
          <select aria-label="Choose timetable month" value={selected || ""} onChange={(event) => setSelected(event.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" disabled={!archive.length}>
            {archive.map((item) => <option key={`${item.year}-${item.month}-${item.id}`} value={`${item.year}-${item.month}`}>{monthLabel(item.year, item.month)}</option>)}
          </select>
        </label>
      </header>

      {!loadedArchive && <div className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: "var(--panel-border)", color: "var(--text-muted)" }}>Loading your available timetables…</div>}
      {loadedArchive && !archive.length && <div className="rounded-2xl border p-10 text-center" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}><span className="mx-auto block text-4xl text-fuchsia-400">🗓️</span><h2 className="mt-3 text-lg font-bold" style={{ color: "var(--app-text)" }}>No timetable uploaded yet</h2><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Your monthly schedule will appear here when your admin imports it.</p></div>}
      {error && <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}

      {archive.length > 0 && <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Scheduled shifts</p><p className="mt-1 text-3xl font-black text-fuchsia-400">{schedule?.entries?.filter((entry) => entry.shift.toLowerCase() !== "off").length ?? "—"}</p></div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Days off</p><p className="mt-1 text-3xl font-black text-slate-300">{schedule?.entries?.filter((entry) => entry.shift.toLowerCase() === "off").length ?? "—"}</p></div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Shift patterns</p><p className="mt-2 text-sm font-semibold" style={{ color: "var(--app-text)" }}>{schedule ? `${totals.length} different entries` : "—"}</p></div>
        </div>

        {loading ? <div className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: "var(--panel-border)", color: "var(--text-muted)" }}>Loading timetable…</div> : schedule && <>
          <div className="overflow-x-auto rounded-2xl border p-3 sm:p-4 shadow-xl" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 gap-2 mb-2">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => <div key={day} className="rounded-lg border px-1 py-3 text-center text-xs font-bold uppercase tracking-wide" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}>{day}</div>)}</div>
              <div className="space-y-2">{weeks.map((week, weekIndex) => <div className="grid grid-cols-7 gap-2" key={weekIndex}>{week.map((date) => {
                const inMonth = date.getMonth() === month - 1;
                const shift = inMonth ? dayMap.get(isoDate(date)) : null;
                return <div key={isoDate(date)} className={`min-h-24 rounded-xl border p-2 flex flex-col justify-between ${inMonth ? "" : "opacity-35"}`} style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}><span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{date.getDate()}</span>{shift ? <span className={`mt-3 rounded-md px-1 py-2 text-center text-xs font-extrabold leading-tight ${shiftClass(shift)}`}>{shift}</span> : inMonth ? <span className="mt-3 rounded-md border border-dashed px-1 py-2 text-center text-[10px]" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>No entry</span> : null}</div>;
              })}</div>)}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="font-bold mr-1">Legend</span><span className="rounded-md bg-lime-400 px-2 py-1 font-bold text-slate-950">☀ Morning shift</span><span className="rounded-md bg-fuchsia-500 px-2 py-1 font-bold text-slate-950">☾ Afternoon / evening</span><span className="rounded-md bg-slate-300 px-2 py-1 font-bold text-slate-950">◷ Off</span><span className="rounded-md bg-cyan-300 px-2 py-1 font-bold text-slate-950">Leave</span>
          </div>
        </>}
      </>}
    </section>
  );
}
