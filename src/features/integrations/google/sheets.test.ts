import assert from "node:assert/strict";
import { test } from "node:test";
import { decrypt, encrypt, signState, verifyState } from "../../../server/crypto.ts";
import { buildHeader, colLetter, guardCell, missingLabels, rowToCells } from "./sheet-rows.ts";

const S = "x".repeat(32);

test("encrypt round-trips, differs per call, rejects wrong key and tampering", () => {
  const a = encrypt(S, "refresh-token");
  assert.equal(decrypt(S, a), "refresh-token");
  assert.notEqual(a, encrypt(S, "refresh-token"));
  assert.throws(() => decrypt("y".repeat(32), a));
  const b = Buffer.from(a, "base64");
  b[b.length - 1] = (b[b.length - 1] ?? 0) ^ 1;
  assert.throws(() => decrypt(S, b.toString("base64")));
});

test("state verifies, expires, and rejects forgery", () => {
  const st = signState(S, { userId: "u", formId: "f" }, 1000, 0);
  assert.deepEqual(verifyState(S, st, 500), { userId: "u", formId: "f" });
  assert.equal(verifyState(S, st, 1001), null);
  assert.equal(verifyState("z".repeat(32), st, 500), null);
  const [body, sig] = st.split(".");
  const forged = Buffer.from(JSON.stringify({ userId: "evil", formId: "f", exp: 9e15 })).toString("base64url");
  assert.equal(verifyState(S, `${forged}.${sig}`, 0), null);
  assert.equal(verifyState(S, `${body}`, 0), null);
});

test("formula injection guard", () => {
  for (const v of ["=1+1", "+1", "-1", "@x", "\tx"]) assert.equal(guardCell(v), `'${v}`);
  assert.equal(guardCell("hello"), "hello");
});

test("header and rows", () => {
  const h = buildHeader(["Name", "Age"]);
  assert.deepEqual(h, ["Submitted at", "Name", "Age"]);
  const row = { "Submitted at": "t", Name: "=x", City: "Pune" };
  assert.deepEqual(missingLabels(h, row), ["City"]);
  assert.deepEqual(rowToCells([...h, "City"], row), ["t", "'=x", "", "Pune"]);
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(colLetter), ["A", "Z", "AA", "AB", "ZZ", "AAA"]);
});
