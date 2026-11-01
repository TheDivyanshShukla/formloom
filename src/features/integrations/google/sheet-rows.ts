// Pure helpers (no server-only, no env) so node --test can import them.

/** Cells starting with these run as formulas in Sheets; prefix with ' (same rule as the CSV export). */
export const guardCell = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export const SUBMITTED = "Submitted at";

export const buildHeader = (labels: string[]) => [SUBMITTED, ...labels];

/** Labels in `row` that the header does not have yet, in row order. */
export const missingLabels = (header: string[], row: Record<string, string>) =>
  Object.keys(row).filter((k) => !header.includes(k));

/** Cells for `row` laid out under `header`; unknown columns are left blank. */
export const rowToCells = (header: string[], row: Record<string, string>) =>
  header.map((h) => guardCell(row[h] ?? ""));

/** 0-based column index -> A1 letters (0 -> A, 26 -> AA). */
export function colLetter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
