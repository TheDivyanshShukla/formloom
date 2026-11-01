"use server";

/*
 * CONTRACT (owned by agent a1 / task T1). Signatures frozen; the builder UI (lead) calls these.
 */
import { z } from "zod";
import type { SheetLink } from "@/features/forms/schema";
import { requireUser } from "@/server/auth";
import * as svc from "./google/server/service";
import type { SheetsStatus } from "./google/server/service";

// Form ids are short base64url tokens (see createForm), not uuids.
const FormId = z.string().regex(/^[A-Za-z0-9_-]{4,32}$/);
const bad = { error: "Invalid form." } as const;

export async function sheetsStatusAction(formId: string): Promise<SheetsStatus | null> {
  const id = FormId.safeParse(formId);
  if (!id.success) return null;
  const user = await requireUser();
  return svc.sheetsStatus(user.id, id.data);
}
/** Returns the linked sheet, or `needsAuth` with the Google consent URL to open. */
export async function linkSheetAction(formId: string): Promise<{ sheet: SheetLink } | { needsAuth: string } | { error: string }> {
  const id = FormId.safeParse(formId);
  if (!id.success) return bad;
  const user = await requireUser();
  const r = await svc.createLinkedSheet(user.id, id.data);
  return r;
}
export async function resyncSheetAction(formId: string): Promise<{ ok: true } | { error: string }> {
  const id = FormId.safeParse(formId);
  if (!id.success) return bad;
  const user = await requireUser();
  return svc.resyncSheet(user.id, id.data);
}
export async function unlinkSheetAction(formId: string): Promise<boolean> {
  const id = FormId.safeParse(formId);
  if (!id.success) return false;
  const user = await requireUser();
  return svc.unlinkSheet(user.id, id.data);
}
