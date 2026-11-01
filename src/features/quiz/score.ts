/*
 * CONTRACT (owned by agent a3 / task T6). Signatures frozen. Pure: no React, no server-only, no env.
 * Imported by the runner (client), the responses view (client) and the server (CSV, submit result).
 */
import { visibleIds } from "../forms/logic.ts";
import { GRADABLE } from "../forms/schema.ts";
import type { Answers, Field } from "../forms/schema.ts";

export type FieldScore = { earned: number; max: number; correct: boolean };
export type QuizScore = { score: number; max: number; perField: Record<string, FieldScore> };

const norm = (s: string) => s.trim().toLowerCase();
const normText = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function isCorrect(f: Field, a: unknown, accepted: string[]): boolean {
  if (f.type === "checkboxes") {
    if (!Array.isArray(a)) return false;
    const want = new Set(accepted.map(norm));
    const got = new Set(a.map((v) => norm(String(v))));
    return want.size === got.size && [...want].every((v) => got.has(v));
  }
  if (typeof a !== "string" || a.trim() === "") return false;
  if (f.type === "number") {
    const n = Number(a);
    return Number.isFinite(n) && accepted.some((c) => c.trim() !== "" && Number(c) === n);
  }
  if (f.type === "short") return accepted.some((c) => normText(c) === normText(a));
  return accepted.some((c) => norm(c) === norm(a));
}

/** Grade every field that has an answerKey and is gradable; ungraded fields are absent from perField. */
export function scoreResponse(fields: Field[], answers: Answers): QuizScore {
  const visible = visibleIds(fields, answers);
  const perField: Record<string, FieldScore> = {};
  let score = 0;
  let max = 0;
  for (const f of fields) {
    if (!f.answerKey || !GRADABLE.has(f.type) || !visible.has(f.id)) continue;
    const p = f.answerKey.points;
    const points = typeof p === "number" && p > 0 ? p : 1;
    const correct = isCorrect(f, answers[f.id], f.answerKey.correct);
    const earned = correct ? points : 0;
    perField[f.id] = { earned, max: points, correct };
    score += earned;
    max += points;
  }
  return { score, max, perField };
}
