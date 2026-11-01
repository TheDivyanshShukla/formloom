import assert from "node:assert/strict";
import { test } from "node:test";
import type { Field } from "../forms/schema.ts";
import { scoreResponse } from "./score.ts";

const f = (id: string, type: Field["type"], correct: string[], points = 1, extra: Partial<Field> = {}): Field => ({
  id,
  type,
  label: id,
  required: false,
  answerKey: { correct, points },
  ...extra,
});

test("choice and dropdown: trimmed, case-insensitive, any accepted", () => {
  const fields = [f("c", "choice", ["Paris"], 2), f("d", "dropdown", ["Red", "Crimson"])];
  const r = scoreResponse(fields, { c: "  paris ", d: "CRIMSON" });
  assert.deepEqual(r, {
    score: 3,
    max: 3,
    perField: { c: { earned: 2, max: 2, correct: true }, d: { earned: 1, max: 1, correct: true } },
  });
  assert.equal(scoreResponse(fields, { c: "Rome", d: "Blue" }).score, 0);
});

test("checkboxes: exact set, order-free; subset, superset, Other do not count", () => {
  const fields = [f("k", "checkboxes", ["A", "B"], 3)];
  assert.equal(scoreResponse(fields, { k: [" b", "A"] }).score, 3);
  assert.equal(scoreResponse(fields, { k: ["A"] }).score, 0);
  assert.equal(scoreResponse(fields, { k: ["A", "B", "C"] }).score, 0);
  assert.equal(scoreResponse(fields, { k: ["A", "B", "Other: x"] }).score, 0);
});

test("short: whitespace-collapsed, case-insensitive", () => {
  const fields = [f("s", "short", ["New York", "NYC"])];
  assert.equal(scoreResponse(fields, { s: "  new   york " }).score, 1);
  assert.equal(scoreResponse(fields, { s: "nyc" }).score, 1);
  assert.equal(scoreResponse(fields, { s: "boston" }).score, 0);
});

test("number: numeric equality", () => {
  const fields = [f("n", "number", ["0.5", "2"])];
  assert.equal(scoreResponse(fields, { n: ".50" }).score, 1);
  assert.equal(scoreResponse(fields, { n: "2.0" }).score, 1);
  assert.equal(scoreResponse(fields, { n: "3" }).score, 0);
  assert.equal(scoreResponse(fields, { n: "abc" }).score, 0);
});

test("hidden fields are excluded from score and max", () => {
  const fields = [
    f("gate", "choice", ["yes"]),
    f("h", "short", ["x"], 5, { showIf: { field: "gate", op: "equals", value: "no" } }),
  ];
  const r = scoreResponse(fields, { gate: "yes", h: "x" });
  assert.equal(r.max, 1);
  assert.equal(r.score, 1);
  assert.equal("h" in r.perField, false);
});

test("default points is 1; unanswered counts toward max; ungraded absent", () => {
  const fields = [
    f("a", "short", ["x"], 0),
    f("b", "short", ["y"], Number.NaN),
    f("p", "paragraph", ["z"]),
    { id: "nokey", type: "short", label: "n", required: false } as Field,
  ];
  const r = scoreResponse(fields, { a: "x" });
  assert.equal(r.max, 2);
  assert.equal(r.score, 1);
  assert.deepEqual(r.perField.b, { earned: 0, max: 1, correct: false });
  assert.deepEqual(Object.keys(r.perField), ["a", "b"]);
});
