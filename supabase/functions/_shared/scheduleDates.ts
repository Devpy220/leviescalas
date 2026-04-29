// Shared helpers to compute candidate dates of a target month for a volunteer,
// based on FIXED_SLOTS pattern and the user's weekly availability.

export interface SlotDef {
  dayOfWeek: number; // 0=Sun..6=Sat
  timeStart: string; // HH:mm
  timeEnd: string;   // HH:mm
  label: string;     // Human label, e.g. "Domingo de Manhã"
  shortLabel: string; // e.g. "manhã" / "noite"
  weekdayLabel: string; // "Dom" "Seg" ...
}

export const FIXED_SLOTS_DEF: SlotDef[] = [
  { dayOfWeek: 0, timeStart: "08:00", timeEnd: "12:00", label: "Domingo de Manhã", shortLabel: "manhã", weekdayLabel: "Dom" },
  { dayOfWeek: 0, timeStart: "18:00", timeEnd: "22:00", label: "Domingo de Noite", shortLabel: "noite", weekdayLabel: "Dom" },
  { dayOfWeek: 1, timeStart: "19:00", timeEnd: "22:00", label: "Segunda à noite", shortLabel: "noite", weekdayLabel: "Seg" },
  { dayOfWeek: 2, timeStart: "19:00", timeEnd: "22:00", label: "Terça à noite", shortLabel: "noite", weekdayLabel: "Ter" },
  { dayOfWeek: 3, timeStart: "19:00", timeEnd: "22:00", label: "Quarta à noite", shortLabel: "noite", weekdayLabel: "Qua" },
  { dayOfWeek: 4, timeStart: "19:00", timeEnd: "22:00", label: "Quinta à noite", shortLabel: "noite", weekdayLabel: "Qui" },
  { dayOfWeek: 5, timeStart: "19:00", timeEnd: "22:00", label: "Sexta à noite", shortLabel: "noite", weekdayLabel: "Sex" },
  { dayOfWeek: 6, timeStart: "19:00", timeEnd: "22:00", label: "Sábado à noite", shortLabel: "noite", weekdayLabel: "Sáb" },
];

const norm = (t?: string) => (t ?? "").slice(0, 5);

export interface AvailabilityRow {
  day_of_week: number;
  time_start: string;
  time_end: string;
  is_available: boolean;
}

// Returns the slots the user is actually a candidate for (default available unless explicitly false).
export function getActiveSlotsForUser(rows: AvailabilityRow[]): SlotDef[] {
  return FIXED_SLOTS_DEF.filter((slot) => {
    const blocked = rows.find(
      (r) =>
        r.day_of_week === slot.dayOfWeek &&
        norm(r.time_start) === slot.timeStart &&
        norm(r.time_end) === slot.timeEnd &&
        r.is_available === false,
    );
    return !blocked;
  });
}

export interface CandidateDay {
  iso: string; // YYYY-MM-DD
  day: number;
  month: number; // 1-12
  weekdayLabel: string;
  shifts: string[]; // e.g. ["manhã", "noite"]
}

// Build all candidate dates of the given month (year/monthIndex) for active slots.
export function buildCandidateDays(year: number, monthIndex: number, slots: SlotDef[]): CandidateDay[] {
  const map = new Map<string, CandidateDay>();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, monthIndex, d);
    const dow = date.getDay();
    const matched = slots.filter((s) => s.dayOfWeek === dow);
    if (matched.length === 0) continue;
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const shifts: string[] = [];
    for (const s of matched) {
      if (!shifts.includes(s.shortLabel)) shifts.push(s.shortLabel);
    }
    map.set(iso, {
      iso,
      day: d,
      month: monthIndex + 1,
      weekdayLabel: matched[0].weekdayLabel,
      shifts,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.iso.localeCompare(b.iso));
}

export function formatCandidateLine(cd: CandidateDay): string {
  const dd = String(cd.day).padStart(2, "0");
  const mm = String(cd.month).padStart(2, "0");
  const shiftsStr = cd.shifts.length > 1 ? `${cd.shifts.join(" e/ou ")}` : cd.shifts[0];
  return `• ${cd.weekdayLabel} ${dd}/${mm} — ${shiftsStr}`;
}
