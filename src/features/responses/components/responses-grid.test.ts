import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRows, cellText, clampWidth, filterRows, nextSort, sortRows } from "./responses-grid.logic.ts";

const fields = [{ id: "n", type: "number" as const }, { id: "t", type: "short" as const }];
const mk = (id: number, d: string, n?: string, t?: string) => ({ id, createdAt: d, answers: { ...(n ? { n } : {}), ...(t ? { t } : {}) } });
const rows = buildRows(fields, [mk(1, "2026-01-02T00:00:00Z", "10", "b"), mk(2, "2026-01-01T00:00:00Z", "9", "A"), mk(3, "2026-01-03T00:00:00Z")]);
const ids = (r: typeof rows) => r.map((x) => x.r.id);

test("cellText", () => {
  assert.equal(cellText(["a", "b"]), "a, b");
  assert.equal(cellText({ key: "k", name: "f.pdf" } as never), "f.pdf");
  assert.equal(cellText(undefined), "");
});
test("filter is case-insensitive", () => {
  assert.deepEqual(ids(filterRows(rows, " A ")), [2]);
  assert.equal(filterRows(rows, "zzz").length, 0);
  assert.equal(filterRows(rows, "").length, 3);
});
test("numeric sort beats text, empties last", () => {
  assert.deepEqual(ids(sortRows(rows, fields, { col: 1, dir: "asc" })), [2, 1, 3]);
  assert.deepEqual(ids(sortRows(rows, fields, { col: 1, dir: "desc" })), [1, 2, 3]);
});
test("date and text sort", () => {
  assert.deepEqual(ids(sortRows(rows, fields, { col: 0, dir: "asc" })), [2, 1, 3]);
  assert.deepEqual(ids(sortRows(rows, fields, { col: 2, dir: "asc" })), [2, 1, 3]);
});
test("nextSort cycles and clamp", () => {
  const a = nextSort(null, 1);
  assert.equal(nextSort(nextSort(a, 1), 1), null);
  assert.equal(clampWidth(10), 80);
});
