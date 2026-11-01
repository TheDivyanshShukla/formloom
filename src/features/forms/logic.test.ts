// Run: node --test lib/logic.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, visibleIds, pages } from "./logic.ts";
import type { Field } from "./schema.ts";
import { fieldError } from "./logic.ts";

const fields: Field[] = [
  { id: "email", type: "email", label: "Email", required: true },
  { id: "attending", type: "choice", label: "Attending?", required: true, options: ["Yes", "No"] },
  { id: "s2", type: "section", label: "Details", required: false, showIf: { field: "attending", op: "equals", value: "yes" } },
  { id: "guests", type: "number", label: "Guests", required: true, min: 0, max: 3 },
  { id: "why", type: "paragraph", label: "Why not?", required: false, showIf: { field: "attending", op: "equals", value: "No" } },
];

test("hidden section hides its fields and skips their required check", () => {
  const { errors, clean } = validate({ fields }, { email: "a@b.co", attending: "No", guests: "9" });
  assert.deepEqual(errors, {});
  assert.deepEqual(clean, { email: "a@b.co", attending: "No" });
});

test("visible section enforces required and range", () => {
  assert.equal(validate({ fields }, { email: "a@b.co", attending: "Yes" }).errors.guests, "This question is required");
  assert.equal(validate({ fields }, { email: "a@b.co", attending: "Yes", guests: "5" }).errors.guests, "Must be at most 3");
  assert.equal(validate({ fields }, { email: "nope", attending: "Yes", guests: "1" }).errors.email, "Enter a valid email");
});

test("section break starts a new page", () => {
  const ans = { attending: "Yes" };
  assert.equal(pages(fields, visibleIds(fields, ans)).length, 2);
  assert.equal(pages(fields, visibleIds(fields, { attending: "No" })).length, 1);
});

test("pattern, choice and file rules", () => {
  const roll: Field = { id: "r", type: "short", label: "Roll", required: true, pattern: "[0-9]{2}[A-Z]{2}[0-9]{3}" };
  assert.equal(fieldError(roll, "21CS042"), null);
  assert.ok(fieldError(roll, "21cs42"));
  const pick: Field = { id: "p", type: "dropdown", label: "Branch", required: true, options: ["CSE", "ECE"] };
  assert.ok(fieldError(pick, "Hacker"));
  const file: Field = { id: "f", type: "file", label: "CV", required: true, max: 1, options: [".pdf"] };
  assert.equal(fieldError(file, { key: "k", name: "cv.PDF", size: 1000, type: "application/pdf" }), null);
  assert.ok(fieldError(file, { key: "k", name: "cv.exe", size: 1000, type: "x" }));
  assert.ok(fieldError(file, { key: "k", name: "cv.pdf", size: 5e6, type: "x" }));
});

test("unsafe regex patterns are refused, normal ones allowed", async () => {
  const { unsafePattern } = await import("./logic.ts");
  for (const p of ["(a+)+$", "(a|aa)*", "(x*)*y", "(\\d+)+", "(.*a){20}", "(a)\\1", "a".repeat(201)]) assert.equal(unsafePattern(p), true, p);
  for (const p of ["[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]", "ORD-[0-9]{5}", "[A-Z]{4}0[A-Z0-9]{6}", "(Mr|Ms|Dr)\\.? [A-Za-z ]+"])
    assert.equal(unsafePattern(p), false, p);
});

test("go to section follows the chosen option, last rule on the page wins", async () => {
  const { jumpTarget, gridCell } = await import("./logic.ts");
  const page: Field[] = [
    { id: "a", type: "choice", label: "Track", required: true, options: ["Design", "Ops"], goTo: { Design: "sec-d", Ops: "submit" } },
    { id: "b", type: "dropdown", label: "Pace", required: false, options: ["Now"], goTo: { Now: "sec-now" } },
  ];
  assert.equal(jumpTarget(page, { a: "Design" }), "sec-d");
  assert.equal(jumpTarget(page, { a: "Ops" }), "submit");
  assert.equal(jumpTarget(page, { a: "Design", b: "Now" }), "sec-now");
  assert.equal(jumpTarget(page, {}), null);
  const grid: Field = { id: "g", type: "choice_grid", label: "Days", required: true, options: ["Mon", "Tue"], columns: ["Yes", "No"] };
  assert.equal(fieldError(grid, [gridCell("Mon", "Yes")]), "Answer every row");
  assert.equal(fieldError(grid, [gridCell("Mon", "Yes"), gridCell("Tue", "No")]), null);
  assert.ok(fieldError(grid, [gridCell("Mon", "Maybe")]));
});

test("video links: youtube, vimeo and files only, https only", async () => {
  const { videoEmbed } = await import("./logic.ts");
  assert.equal(videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(videoEmbed("https://youtu.be/dQw4w9WgXcQ")?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(videoEmbed("https://vimeo.com/123456")?.src, "https://player.vimeo.com/video/123456");
  assert.equal(videoEmbed("https://cdn.example.com/clip.mp4")?.kind, "file");
  assert.equal(videoEmbed("http://youtu.be/dQw4w9WgXcQ"), null);
  assert.equal(videoEmbed("https://evil.example/embed"), null);
});

test("seeded order is stable and keeps every item", async () => {
  const { seededOrder } = await import("./logic.ts");
  const items = ["a", "b", "c", "d", "e"];
  assert.deepEqual(seededOrder(items, 7), seededOrder(items, 7));
  assert.deepEqual(seededOrder(items, 7).slice().sort(), items);
  assert.notDeepEqual(seededOrder(items, 7), seededOrder(items, 8));
});

test("upload keys: only server-issued shapes, bound to their form", async () => {
  const { isUploadKey } = await import("./schema.ts");
  const k = "143FxiiI/0b6f7a3e-2c1d-4e5f-8a9b-0c1d2e3f4a5b.pdf";
  assert.equal(isUploadKey(k), true);
  assert.equal(isUploadKey(k, "143FxiiI"), true);
  assert.equal(isUploadKey(k, "otherForm"), false);
  for (const bad of ["143FxiiI/../../.env", "143FxiiI/..%2f..%2f.env", "143FxiiI/0b6f7a3e-2c1d-4e5f-8a9b-0c1d2e3f4a5b/../x", "A/../B/0b6f7a3e-2c1d-4e5f-8a9b-0c1d2e3f4a5b"])
    assert.equal(isUploadKey(bad), false, bad);
});
