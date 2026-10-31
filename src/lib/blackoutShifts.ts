// Shift-level blocks. Whole days live in blackout_dates (YYYY-MM-DD);
// a single shift lives in blackout_shifts as "YYYY-MM-DD|M" (before 14:00)
// or "YYYY-MM-DD|N" (from 14:00). Keep in sync with supabase/functions/_shared/blackoutShifts.ts.
export type Shift = "M" | "N";

export const shiftOfTime = (time: string): Shift => (String(time).slice(0, 5) < "14:00" ? "M" : "N");
export const shiftKey = (date: string, shift: Shift) => `${date}|${shift}`;
export const otherShift = (s: Shift): Shift => (s === "M" ? "N" : "M");

export function parseShiftKey(key: string): { date: string; shift: Shift } | null {
  const m = /^(\d{4}-\d{2}-\d{2})\|([MN])$/.exec(key);
  return m ? { date: m[1], shift: m[2] as Shift } : null;
}

/** Blocked for a slot: whole day, or the shift matching its start time. */
export function isBlockedAt(dates: readonly string[], shifts: readonly string[], date: string, timeStart?: string): boolean {
  if (dates.includes(date)) return true;
  if (!timeStart) return false;
  return shifts.includes(shiftKey(date, shiftOfTime(timeStart)));
}

export interface Blocks { dates: string[]; shifts: string[] }

/** Block a whole day (no shift) or one shift. Both shifts collapse into a whole day. */
export function applyBlock(b: Blocks, date: string, shift?: Shift): Blocks {
  const dates = new Set(b.dates);
  const shifts = new Set(b.shifts);
  if (!shift || dates.has(date) || shifts.has(shiftKey(date, otherShift(shift)))) {
    dates.add(date);
    shifts.delete(shiftKey(date, "M"));
    shifts.delete(shiftKey(date, "N"));
  } else {
    shifts.add(shiftKey(date, shift));
  }
  return { dates: [...dates].sort(), shifts: [...shifts].sort() };
}

/** Free a whole day (no shift) or one shift. Freeing one shift of a fully blocked day keeps the other. */
export function applyUnblock(b: Blocks, date: string, shift?: Shift): Blocks {
  const dates = new Set(b.dates);
  const shifts = new Set(b.shifts);
  if (!shift) {
    dates.delete(date);
    shifts.delete(shiftKey(date, "M"));
    shifts.delete(shiftKey(date, "N"));
  } else if (dates.has(date)) {
    dates.delete(date);
    shifts.add(shiftKey(date, otherShift(shift)));
  } else {
    shifts.delete(shiftKey(date, shift));
  }
  return { dates: [...dates].sort(), shifts: [...shifts].sort() };
}

/** Readable list items: dates as-is, shifts as [date, "manhã"|"noite"]. */
export function blockItems(b: Blocks, fromIso = ""): Array<{ date: string; shift?: Shift }> {
  const items: Array<{ date: string; shift?: Shift }> = [];
  for (const d of b.dates) if (d >= fromIso) items.push({ date: d });
  for (const k of b.shifts) {
    const p = parseShiftKey(k);
    if (p && p.date >= fromIso) items.push(p);
  }
  return items.sort((a, c) => (a.date + (a.shift ?? "")).localeCompare(c.date + (c.shift ?? "")));
}
