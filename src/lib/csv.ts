// Safe CSV building: cells that start with a formula character are prefixed
// with an apostrophe so spreadsheets never execute user-typed text.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (FORMULA_START.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return [cols.map(csvCell).join(",")]
    .concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(",")))
    .join("\n");
}
