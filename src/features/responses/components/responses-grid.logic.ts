import type { Answer, Field } from "@/features/forms/schema";
import type { ResponseDTO } from "../server/service";

export type GridRow = { r: ResponseDTO; time: number; texts: string[] };
export type Sort = { col: number; dir: "asc" | "desc" } | null;

const isFile = (a: unknown): a is { key: string; name: string } => typeof a === "object" && a !== null && !Array.isArray(a) && "key" in a;

/** Plain text of one answer; checkboxes joined by ", ", files by name. */
export function cellText(a: Answer | undefined): string {
  if (a === undefined) return "";
  if (isFile(a)) return a.name;
  return Array.isArray(a) ? a.join(", ") : String(a);
}

/** Column 0 is Submitted; columns 1..n follow fields. */
export function buildRows(fields: Pick<Field, "id">[], responses: ResponseDTO[]): GridRow[] {
  return responses.map((r) => ({ r, time: new Date(r.createdAt).getTime(), texts: fields.map((f) => cellText(r.answers[f.id])) }));
}

export function filterRows(rows: GridRow[], q: string): GridRow[] {
  const n = q.trim().toLowerCase();
  if (!n) return rows;
  return rows.filter((row) => row.texts.some((t) => t.toLowerCase().includes(n)));
}

const NUMERIC = new Set(["number", "scale", "rating"]);

/** Empty cells always sort last, whatever the direction. */
export function sortRows(rows: GridRow[], fields: Pick<Field, "type">[], sort: Sort): GridRow[] {
  if (!sort) return rows;
  const { col, dir } = sort;
  const sign = dir === "asc" ? 1 : -1;
  const numeric = col > 0 && NUMERIC.has(fields[col - 1]?.type ?? "");
  return [...rows].sort((a, b) => {
    if (col === 0) return sign * (a.time - b.time);
    const x = a.texts[col - 1] ?? "";
    const y = b.texts[col - 1] ?? "";
    if (!x || !y) return x === y ? 0 : x ? -1 : 1;
    if (numeric) {
      const nx = Number(x);
      const ny = Number(y);
      if (Number.isFinite(nx) && Number.isFinite(ny)) return sign * (nx - ny);
    }
    return sign * x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
  });
}

/** asc -> desc -> off */
export function nextSort(cur: Sort, col: number): Sort {
  if (!cur || cur.col !== col) return { col, dir: "asc" };
  return cur.dir === "asc" ? { col, dir: "desc" } : null;
}

export function defaultWidth(type: Field["type"] | "date"): number {
  switch (type) {
    case "date":
      return 170;
    case "number":
    case "scale":
    case "rating":
      return 120;
    case "paragraph":
      return 280;
    case "short":
    case "email":
      return 200;
    default:
      return 180;
  }
}

export const MIN_WIDTH = 80;
export const clampWidth = (w: number) => Math.max(MIN_WIDTH, Math.round(w));
