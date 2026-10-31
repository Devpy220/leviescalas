// Parses "desbloquear <dias>" (already lowercased and accent-stripped).
// Blocked days are whole dates: "domingo de manhã" / "domingo à noite"
// both target Sunday, and `partOfDay` lets the reply explain that.
export interface UnblockTargets {
  dows: Set<number>;
  dates: Set<string>;
  partOfDay: boolean;
}

const DOWS: Array<[RegExp, number]> = [
  [/domingo/, 0], [/segunda/, 1], [/terca/, 2], [/quarta/, 3],
  [/quinta/, 4], [/sexta/, 5], [/sabado/, 6],
];

export function parseUnblockTargets(cmd: string, now = new Date()): UnblockTargets {
  const dows = new Set(DOWS.filter(([r]) => r.test(cmd)).map(([, d]) => d));
  if (/\b(todos os dias|todos os dias da semana|semana toda|semana inteira)\b/.test(cmd)) {
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
  return { dows, dates, partOfDay: /\b(manha|noite|tarde)\b/.test(cmd) };
}
