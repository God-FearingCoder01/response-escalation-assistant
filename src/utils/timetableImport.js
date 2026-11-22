import * as XLSX from "xlsx";
import { parseWeekRange, resolveWeekStart } from "./weekRange";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const key = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");

function findMonthYear(workbook) {
  const content = workbook.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: "" });
    return rows.slice(0, 12).flat().map(clean).join(" ");
  }).join(" ").toLowerCase();
  const year = Number(content.match(/\b(20\d{2})\b/)?.[1]);
  // The title ("WinBucks December 2026 ...") comes first. Take the month named earliest in the
  // text, not the first in calendar order, so a week label such as "November 29th - December
  // 5th" cannot make a December timetable look like November.
  let month = null;
  let earliest = Infinity;
  MONTHS.forEach((name, index) => {
    const at = content.search(new RegExp(`\\b${name}\\b`));
    if (at >= 0 && at < earliest) {
      earliest = at;
      month = index + 1;
    }
  });
  return { year: year || null, month };
}

// Looks for the week's date label (for example "Nov 29th - Dec 5th") around the header row and
// returns the real first date (Sunday) of that week, which may fall in the previous month.
// Returns `fallback` when no usable label is found.
function findWeekStart(rows, headerRow, context, fallback) {
  for (let r = Math.max(0, headerRow - 2); r < Math.min(rows.length, headerRow + 4); r += 1) {
    const start = resolveWeekStart(parseWeekRange(rows[r].map(clean).join(" ")), context);
    if (start) return start;
  }
  return fallback;
}

export async function parseTimetableWorkbook(file, agents, targetMonth = "", excludedInitials = []) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const detected = findMonthYear(workbook);
  const agentLookup = new Map();
  const excluded = new Set(excludedInitials.map((value) => value.toUpperCase()));
  (agents || []).forEach((agent) => {
    [agent.agent_name, agent.agent, agent.agent_initials].filter(Boolean).forEach((name) => {
      agentLookup.set(key(name), { ...agent, ignoredFromRoster: excluded.has(agent.agent_initials.toUpperCase()) });
    });
  });

  const schedules = new Map();
  const unknownNames = new Set();
  const [targetYear, requestedMonth] = (targetMonth || "").split("-").map(Number);
  const month = requestedMonth || detected.month || new Date().getMonth() + 1;
  const year = targetYear || detected.year || new Date().getFullYear();
  const first = new Date(year, month - 1, 1);
  const firstSunday = 1 + ((7 - first.getDay()) % 7);

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
    let weekIndex = -1;
    let activeWeekStart = new Date(year, month - 1, firstSunday);
    for (let r = 0; r < rows.length; r += 1) {
      const dayStart = rows[r].findIndex((cell) => key(cell) === DAYS[0]);
      if (dayStart < 0 || DAYS.some((day, index) => key(rows[r][dayStart + index]) !== day)) continue;
      weekIndex += 1;
      activeWeekStart = findWeekStart(rows, r, { year, month, weekIndex }, new Date(year, month - 1, firstSunday + weekIndex * 7));
      for (let dataRow = r + 1; dataRow < rows.length; dataRow += 1) {
        const values = rows[dataRow];
        const nextWeekDayStart = values.findIndex((cell) => key(cell) === DAYS[0]);
        if (nextWeekDayStart >= 0 && DAYS.every((day, index) => key(values[nextWeekDayStart + index]) === day)) break;
        const name = clean(values[dayStart - 1]);
        const shiftValues = DAYS.map((_, index) => clean(values[dayStart + index]));
        if (!name && shiftValues.every((value) => !value)) break;
        if (!name || shiftValues.every((value) => !value)) continue;
        const matched = agentLookup.get(key(name));
        if (!matched) {
          unknownNames.add(name);
          continue;
        }
        if (matched.ignoredFromRoster) continue;
        const initials = matched.agent_initials.toUpperCase();
        if (!schedules.has(initials)) schedules.set(initials, { agent_initials: initials, entries: [] });
        shiftValues.forEach((shift, dayIndex) => {
          if (!shift) return;
          // Weeks often straddle two months (Nov 29 - Dec 5): only the days that fall inside the
          // month being imported are kept.
          const date = new Date(activeWeekStart.getFullYear(), activeWeekStart.getMonth(), activeWeekStart.getDate() + dayIndex);
          if (date.getMonth() !== month - 1 || date.getFullYear() !== year) return;
          const dateString = `${year}-${String(month).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          schedules.get(initials).entries.push({ date: dateString, shift });
        });
      }
    }
  }

  return {
    year,
    month,
    detectedMonth: detected.month,
    detectedYear: detected.year,
    schedules: [...schedules.values()].filter((schedule) => schedule.entries.length),
    unknownNames: [...unknownNames],
    missingAgents: (agents || []).filter((agent) => !excluded.has(agent.agent_initials.toUpperCase()) && !schedules.has(agent.agent_initials.toUpperCase())).map((agent) => agent.agent_name || agent.agent_initials),
    sourceFilename: file.name,
  };
}
