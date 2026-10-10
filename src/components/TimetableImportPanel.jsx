import { useEffect, useRef, useState } from "react";
import { fetchAdminTimetableArchiveApi, importTimetableApi } from "../services/api";
import { parseTimetableWorkbook } from "../utils/timetableImport";

const monthInputValue = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

export default function TimetableImportPanel({ activeScreen, agents = [], currentAgent, showToast = () => {} }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthInputValue(new Date().getFullYear(), new Date().getMonth() + 1));
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [archive, setArchive] = useState([]);

  const loadArchive = async () => {
    const rows = await fetchAdminTimetableArchiveApi();
    if (Array.isArray(rows)) setArchive(rows);
  };

  useEffect(() => {
    if (activeScreen === "admin") loadArchive();
  }, [activeScreen]);

  const processFile = async (nextFile, requestedMonth = "") => {
    if (!nextFile) return;
    setFile(nextFile);
    setParsed(null);
    setError("");
    try {
      const activeAgents = agents.filter((agent) => agent.is_active !== false);
      const firstPass = await parseTimetableWorkbook(nextFile, activeAgents);
      const target = requestedMonth || (firstPass.detectedMonth && firstPass.detectedYear
        ? monthInputValue(firstPass.detectedYear, firstPass.detectedMonth)
        : selectedMonth);
      const result = await parseTimetableWorkbook(nextFile, activeAgents, target);
      setSelectedMonth(target);
      setParsed(result);
      if (!result.schedules.length) setError("No agent schedules were found. Check that the sheet has weekday headers and agent rows.");
    } catch (err) {
      setError(err.message || "Could not read this spreadsheet. Please use an Excel or CSV schedule file.");
    }
  };

  const [chosenYear, chosenMonth] = selectedMonth.split("-").map(Number);
  const canImport = parsed?.schedules?.length && !parsed.unknownNames.length && !parsed.missingAgents.length && !busy;
  const handleImport = async () => {
    if (!canImport) return;
    setBusy(true);
    setError("");
    try {
      const result = await importTimetableApi({
        year: chosenYear,
        month: chosenMonth,
        source_filename: file?.name || parsed.sourceFilename,
        schedules: parsed.schedules,
      });
      await loadArchive();
      setParsed(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      showToast(`Saved the ${new Date(chosenYear, chosenMonth - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })} timetable for ${result.agent_count} agents.`);
    } catch (err) {
      setError(err.message || "The timetable could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  if (activeScreen !== "admin" || !currentAgent?.is_admin) return null;

  return (
    <div className="rounded-3xl border p-5 sm:p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-fuchsia-500/15 p-3 text-2xl">🗓️</div>
        <div><h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>Monthly agent timetables</h3><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Import the month’s Excel schedule. Agents will see only the timetable for their own profile, while past imports remain available in the archive.</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <label className="block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Schedule month
            <input type="month" value={selectedMonth} onChange={(event) => { setSelectedMonth(event.target.value); if (file) processFile(file, event.target.value); }} className="mt-1.5 block w-full max-w-xs rounded-xl border p-3 text-sm" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}/>
          </label>
          <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); processFile(event.dataTransfer.files?.[0]); }} onClick={() => inputRef.current?.click()} className={`cursor-pointer rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${dragging ? "border-fuchsia-400 bg-fuchsia-500/10" : ""}`} style={!dragging ? { borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" } : undefined}>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => processFile(event.target.files?.[0])}/>
            <span className="mx-auto block text-3xl text-fuchsia-400">⇧</span>
            <p className="mt-2 font-bold" style={{ color: "var(--app-text)" }}>{file ? file.name : "Drop the Excel schedule here"}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>or click to browse · Excel (.xlsx, .xls) or CSV</p>
          </div>

          {parsed && <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
            <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--app-text)" }}><span className="text-emerald-400">▦</span>Import preview</div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{parsed.schedules.length} agent schedules · {parsed.schedules.reduce((sum, item) => sum + item.entries.length, 0)} shift entries · saving for {new Date(chosenYear, chosenMonth - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
            {parsed.unknownNames.length > 0 && <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200"><strong>Names not found in the agent roster:</strong> {parsed.unknownNames.join(", ")}. Update the agent names in the spreadsheet or roster before importing.</div>}
            {parsed.missingAgents.length > 0 && <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200"><strong>Agent rows missing:</strong> {parsed.missingAgents.join(", ")}. Add each active agent to the workbook so every profile gets this month’s timetable.</div>}
            <div className="flex flex-wrap gap-2">{parsed.schedules.map((item) => {
              const agent = agents.find((candidate) => candidate.agent_initials.toUpperCase() === item.agent_initials);
              return <span key={item.agent_initials} className="rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: "var(--badge-border)", color: "var(--app-text)" }}>{agent?.agent_name || item.agent_initials} · {item.entries.length} days</span>;
            })}</div>
            <button type="button" disabled={!canImport} onClick={handleImport} className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <span className="animate-spin">◌</span> : <span>✓</span>}Save monthly timetable</button>
          </div>}
          {error && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--field-bg)" }}>
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--app-text)" }}><span className="text-fuchsia-400">◷</span>Import history</div>
          {archive.length ? <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">{archive.map((item) => <div key={item.id} className="rounded-xl border p-3" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}><p className="text-sm font-bold" style={{ color: "var(--app-text)" }}>{new Date(item.year, item.month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p><p className="mt-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>{item.source_filename} · {item.agent_count} agents</p><p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{new Date(item.created_at).toLocaleString()}</p></div>)}</div> : <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>No timetables imported yet.</p>}
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>Each import is saved as a dated version. Reimporting a month updates what agents see while keeping previous versions in history.</p>
        </div>
      </div>
    </div>
  );
}
