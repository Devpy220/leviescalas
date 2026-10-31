// Parses "desbloquear <dias> [de manhã|à noite]" (already lowercased and
// accent-stripped). `shift` is set only when exactly one shift is named;
// the caller applies it to Sundays, the only day with two shifts.
export interface UnblockTargets {
  dows: Set<number>;
  dates: Set<string>;
  shift?: "M" | "N";
}

const DOWS: Array<[RegExp, number]> = [
  [/domingo/, 0], [/segunda/, 1], [/terca/, 2], [/quarta/, 3],
  [/quinta/, 4], [/sexta/, 5], [/sabado/, 6],
];

export function parseUnblockTargets(cmd: string, now = new Date()): UnblockTargets {
  const dows = new Set(DOWS.filter(([r]) => r.test(cmd)).map(([, d]) => d));
  if (/\b(todos os dias|semana toda|semana inteira)\b/.test(cmd)) {
    for (let d = 0; d < 7; d++) dows.add(d);
  }
  const dates = new Set<string>();
  const re = /(\b\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(cmd)) !== null) {
    const day = +mm[1], mon = +mm[2] - 1;
    let yr = mm[3] ? +mm[3] : now.getFullYear();
    if (yr < 100) yr += 2000;
    const d = new Date(Date.UTC(yr, mon, day));
    if (d.getUTCDate() !== day || d.getUTCMonth() !== mon) continue;
    dates.add(d.toISOString().slice(0, 10));
    if (!mm[3]) { d.setUTCFullYear(yr + 1); dates.add(d.toISOString().slice(0, 10)); }
  }
  const m = /\b(manha|cedo)\b/.test(cmd), n = /\b(noite|tarde)\b/.test(cmd);
  return { dows, dates, shift: m && !n ? "M" : n && !m ? "N" : undefined };
}
