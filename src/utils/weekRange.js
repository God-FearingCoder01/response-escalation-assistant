// Works out the real first day (Sunday) of a timetable week from its label, such as
// "Nov 29th - Dec 5th", "6th - 12th" or "27th - Jan 2nd". Weeks can start in the previous
// month (or end in the next one), so the start date is returned as a full date, not just a
// day number.

const MONTH_PREFIXES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const RANGE =
  /(?:([a-z]{3,9})\.?\s*)?\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|—|to)\s*(?:([a-z]{3,9})\.?\s*)?(\d{1,2})(?:st|nd|rd|th)?\b/i;

const monthIndex = (word) => {
  const index = MONTH_PREFIXES.indexOf(String(word || "").slice(0, 3).toLowerCase());
  return index >= 0 ? index : null;
};

// Reads the label text. Returns null when it holds no day range.
export function parseWeekRange(text) {
  const match = RANGE.exec(String(text || ""));
  if (!match) return null;
  const startDay = Number(match[2]);
  const endDay = Number(match[4]);
  if (startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) return null;
  return { startMonth: monthIndex(match[1]), startDay, endMonth: monthIndex(match[3]), endDay };
}

// `year`/`month` (1-12) are the month the timetable is for; `weekIndex` is 0 for the first
// week listed. Returns a Date for the week's first day, or null if it cannot be worked out.
export function resolveWeekStart(range, { year, month, weekIndex }) {
  if (!range) return null;
  const target = month - 1;
  let startMonth;
  if (range.startMonth !== null) startMonth = range.startMonth;
  else if (range.endMonth !== null) startMonth = range.startDay <= range.endDay ? range.endMonth : range.endMonth - 1;
  // No month names: the first week reaching back past the 1st starts in the previous month;
  // a later week that wraps (27th - 2nd) starts in this month and ends in the next.
  else if (weekIndex === 0 && range.startDay > range.endDay) startMonth = target - 1;
  else startMonth = target;

  // Pick the year that puts the date closest to the month being imported (handles Dec/Jan).
  const anchor = new Date(year, target, 15).getTime();
  const candidates = [year - 1, year, year + 1].map((y) => new Date(y, startMonth, range.startDay));
  return candidates.sort((a, b) => Math.abs(a - anchor) - Math.abs(b - anchor))[0];
}
