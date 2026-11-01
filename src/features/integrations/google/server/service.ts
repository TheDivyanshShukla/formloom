import "server-only";
import { eq } from "drizzle-orm";
import { answerText } from "@/features/forms/logic";
import { type Answer, type Field, isFileAnswer, type SheetLink } from "@/features/forms/schema";
import { getFormForUser, setSheet } from "@/features/forms/server/service";
import { db } from "@/server/db";
import { forms } from "@/server/db/schema";
import { decrypt, encrypt, signState, verifyState } from "@/server/crypto";
import { env } from "@/server/env";
import { buildHeader, colLetter, guardCell, missingLabels, rowToCells, SUBMITTED } from "../sheet-rows";
import * as q from "./queries";

/*
 * CONTRACT (owned by agent a1 / task T1). Signatures are frozen; bodies are a1's.
 * Google Sheets via OAuth with scope https://www.googleapis.com/auth/drive.file only
 * (the app can touch just the spreadsheets it creates; no Google security review needed).
 * Reuses AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET. Redirect URI: `${NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`.
 */

export type SheetsStatus = { configured: boolean; connectedEmail: string | null; sheet: SheetLink | null };

const NOT_CONFIGURED = "Google Sheets is not configured on this server.";
const configured = () => Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
const redirectUri = () => `${env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Unknown error");

// ---- tokens -------------------------------------------------------------------------------

class NeedsAuth extends Error {}

// ponytail: per-process cache; each instance refreshes once an hour per user, fine until many instances.
const tokenCache = new Map<string, { token: string; exp: number }>();
const cacheToken = (userId: string, j: Record<string, unknown>) =>
  tokenCache.set(userId, { token: String(j.access_token), exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60_000 });

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: env.AUTH_GOOGLE_ID ?? "", client_secret: env.AUTH_GOOGLE_SECRET ?? "", ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw Object.assign(new Error(String(json.error_description ?? json.error ?? res.status)), { code: json.error });
  return json;
}

async function accessToken(userId: string): Promise<string> {
  const hit = tokenCache.get(userId);
  if (hit && hit.exp > Date.now()) return hit.token;
  const conn = await q.selectConnection(userId);
  if (!conn) throw new NeedsAuth("Google account not connected.");
  try {
    const j = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(env.AUTH_SECRET, conn.refreshToken) });
    cacheToken(userId, j);
    return String(j.access_token);
  } catch (e) {
    if ((e as { code?: string }).code === "invalid_grant") {
      await q.deleteConnection(userId); // revoked: force re-consent
      tokenCache.delete(userId);
      throw new NeedsAuth("Google access was revoked.");
    }
    throw e;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Google JSON is untyped and only read defensively
async function api(userId: string, url: string, init: RequestInit = {}): Promise<Record<string, any>> {
  const res = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${await accessToken(userId)}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  // biome-ignore lint/suspicious/noExplicitAny: see above
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    if (res.status === 401) tokenCache.delete(userId);
    throw new Error(json.error?.message ?? `Google API ${res.status}`);
  }
  return json;
}

const put = (userId: string, id: string, range: string, values: string[][]) =>
  api(userId, `${SHEETS}/${id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });

// ---- status / auth ------------------------------------------------------------------------

/** Is Google configured, is this user connected, and which sheet is linked to the form. Requires viewer access. */
export async function sheetsStatus(userId: string, formId: string): Promise<SheetsStatus | null> {
  const form = await getFormForUser(userId, formId);
  if (!form) return null;
  const conn = configured() ? await q.selectConnection(userId) : null;
  return { configured: configured(), connectedEmail: conn?.email ?? null, sheet: form.settings.sheet ?? null };
}

/** Consent URL with a signed, expiring `state` binding userId + formId. */
export async function googleAuthUrl(userId: string, formId: string): Promise<string> {
  const p = new URLSearchParams({
    client_id: env.AUTH_GOOGLE_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file openid email",
    access_type: "offline",
    prompt: "consent",
    state: signState(env.AUTH_SECRET, { userId, formId }),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** OAuth callback: verify state, exchange code, store the encrypted refresh token, then link a new sheet. */
export async function handleCallback(userId: string, code: string, state: string): Promise<{ formId: string } | { error: string }> {
  if (!configured()) return { error: NOT_CONFIGURED };
  const st = verifyState(env.AUTH_SECRET, state);
  if (!st || st.userId !== userId) return { error: "Invalid or expired link. Try again." };
  try {
    const j = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
    if (!j.refresh_token) return { error: "Google did not return a refresh token." };
    // id_token came straight from Google's token endpoint over TLS, so reading its payload is safe.
    const email = String(JSON.parse(Buffer.from(String(j.id_token).split(".")[1] ?? "", "base64url").toString("utf8")).email ?? "");
    await q.upsertConnection(userId, email, encrypt(env.AUTH_SECRET, String(j.refresh_token)));
    cacheToken(userId, j);
    const r = await createLinkedSheet(userId, st.formId);
    return "sheet" in r ? { formId: st.formId } : { error: "error" in r ? r.error : "Could not create the sheet." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ---- rows ---------------------------------------------------------------------------------

const fieldsOf = (draft: { fields: Field[] }) => draft.fields.filter((f) => f.type !== "section" && f.type !== "text" && f.type !== "video");

// Mirrors cellValue in responses/server/service.ts.
function cell(f: Field, a: Answer | undefined) {
  if (isFileAnswer(a)) return `${env.NEXT_PUBLIC_APP_URL}/api/files/${a.key}`;
  return answerText(f, a, "; ");
}

/** Header + every response, oldest first (guard applied to data cells). */
async function fullGrid(formId: string, fields: Field[]) {
  const header = buildHeader(fields.map((f) => f.label));
  const rows = await q.selectAllResponses(formId);
  const data = rows.map((r) => {
    const byLabel: Record<string, string> = { [SUBMITTED]: r.createdAt.toISOString() };
    for (const f of fields) byLabel[f.label] = cell(f, r.answers[f.id]);
    return rowToCells(header, byLabel);
  });
  return [header.map(guardCell), ...data];
}

/** Create a spreadsheet named after the form, write the header and every existing response, link it. Editor access. */
export async function createLinkedSheet(userId: string, formId: string): Promise<{ sheet: SheetLink } | { needsAuth: string } | { error: string }> {
  if (!configured()) return { error: NOT_CONFIGURED };
  const form = await getFormForUser(userId, formId, "editor");
  if (!form) return { error: "Form not found." };
  try {
    const title = `${form.draft.title} (Responses)`;
    const created = await api(userId, SHEETS, { method: "POST", body: JSON.stringify({ properties: { title } }) });
    const grid = await fullGrid(formId, fieldsOf(form.draft));
    await put(userId, created.spreadsheetId, "A1", grid);
    const sheet: SheetLink = { spreadsheetId: created.spreadsheetId, url: created.spreadsheetUrl, connectedBy: userId, title };
    await setSheet(formId, sheet);
    return { sheet };
  } catch (e) {
    if (e instanceof NeedsAuth) return { needsAuth: await googleAuthUrl(userId, formId) };
    return { error: errMsg(e) };
  }
}

/** Rewrite the linked sheet from the database (repairs gaps and new columns). Editor access. */
export async function resyncSheet(userId: string, formId: string): Promise<{ ok: true } | { error: string }> {
  if (!configured()) return { error: NOT_CONFIGURED };
  const form = await getFormForUser(userId, formId, "editor");
  const sheet = form?.settings.sheet;
  if (!form || !sheet) return { error: "No sheet is linked." };
  try {
    // The sheet lives in the linker's Drive (drive.file scope), so only their token can reach it.
    const owner = sheet.connectedBy;
    const grid = await fullGrid(formId, fieldsOf(form.draft));
    await put(owner, sheet.spreadsheetId, "A1", grid);
    // Clear only what is below and right of the fresh grid, so a failed write never leaves an empty sheet.
    const width = Math.max(...grid.map((r) => r.length), 1);
    await api(owner, `${SHEETS}/${sheet.spreadsheetId}/values/${encodeURIComponent(`A${grid.length + 1}:ZZ`)}:clear`, { method: "POST", body: "{}" });
    await api(owner, `${SHEETS}/${sheet.spreadsheetId}/values/${encodeURIComponent(`${colLetter(width)}1:ZZ${grid.length}`)}:clear`, { method: "POST", body: "{}" });
    return { ok: true };
  } catch (e) {
    if (e instanceof NeedsAuth) return { error: "Google access was lost. Link the sheet again to reconnect." };
    return { error: errMsg(e) };
  }
}

/** Unlink (the spreadsheet itself is left in the user's Drive). Editor access. */
export async function unlinkSheet(userId: string, formId: string): Promise<boolean> {
  if (!(await getFormForUser(userId, formId, "editor"))) return false;
  return setSheet(formId, null);
}

/**
 * Append one response. Called from submitResponse inside `after()`. Never throws: logs and returns.
 * `row` maps column label -> cell value and starts with "Submitted at". New labels add columns.
 */
export type AppendResult = { ok: true } | { ok: false; permanent: boolean; reason: string };

/** Like appendToSheet but reports failure. Permanent = no sheet linked or Google access lost. Never throws. */
export async function appendToSheetResult(formId: string, row: Record<string, string>): Promise<AppendResult> {
  try {
    const [f] = await db.select({ settings: forms.settings }).from(forms).where(eq(forms.id, formId)).limit(1);
    const sheet = f?.settings.sheet;
    if (!sheet) return { ok: false, permanent: true, reason: "sheet not linked" };
    const userId = sheet.connectedBy;
    const id = sheet.spreadsheetId;
    const got = await api(userId, `${SHEETS}/${id}/values/${encodeURIComponent("1:1")}`);
    let header: string[] = got.values?.[0] ?? [SUBMITTED];
    const extra = missingLabels(header, row);
    if (extra.length > 0) {
      header = [...header, ...extra];
      await put(userId, id, `A1:${colLetter(header.length - 1)}1`, [header.map(guardCell)]);
    }
    await api(userId, `${SHEETS}/${id}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: [rowToCells(header, row)] }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, permanent: e instanceof NeedsAuth, reason: errMsg(e) };
  }
}

export async function appendToSheet(formId: string, row: Record<string, string>): Promise<void> {
  const r = await appendToSheetResult(formId, row);
  if (!r.ok) console.error("[sheets] append failed:", r.reason);
}
