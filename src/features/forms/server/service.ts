import "server-only";
import { randomBytes } from "node:crypto";
import { cached, cacheKeys, invalidate } from "@/server/cache";
import type { forms } from "@/server/db/schema";
import { can, type Role, roleIn } from "@/features/workspaces/server/service";
import type { EditableSettings, FormDraft, Settings, SheetLink } from "../schema";
import * as q from "./queries";

const token = (n: number) => randomBytes(n).toString("base64url");

export type FormSummaryDTO = {
  id: string;
  title: string;
  color: string;
  questions: number;
  responses: number;
  accepting: boolean;
  updatedAt: string;
};

export type FormDTO = {
  id: string;
  draft: FormDraft;
  settings: Settings;
  responses: number;
  updatedAt: string;
  role: Role;
  workspaceId: string;
};

/** What a respondent may see: no webhook, no CSV key. */
export type PublicFormDTO = {
  id: string;
  org: string | null;
  draft: FormDraft;
  accepting: boolean;
  closedMessage: string;
  limitOne: boolean;
  allowEdit: boolean;
  another: boolean;
  shuffleOptions: boolean;
  shuffleQuestions: boolean;
  collectEmail: boolean;
};

type Row = typeof forms.$inferSelect;

/** Viewers see responses, not delivery secrets: webhook URLs often embed a token. */
const visibleSettings = (s: Settings, role: Role): Settings =>
  role === "viewer" ? { ...s, webhook: "", sheet: s.sheet ? { ...s.sheet, connectedBy: "" } : s.sheet } : s;

const toDTO = (r: Row, role: Role): FormDTO => ({
  id: r.id,
  draft: r.draft,
  settings: visibleSettings(r.settings, role),
  responses: r.responseCount,
  updatedAt: r.updatedAt.toISOString(),
  role,
  workspaceId: r.workspaceId,
});

export async function createForm(userId: string, workspaceId: string, draft: FormDraft): Promise<FormDTO | null> {
  const role = await roleIn(userId, workspaceId);
  if (!can(role, "editor")) return null;
  const settings: Settings = { accepting: true, limitOne: false, webhook: "", csvKey: token(18) };
  const [row] = await q.insertForm({ id: token(6), workspaceId, createdBy: userId, draft, settings });
  return toDTO(row!, role!);
}

export async function listForms(userId: string, workspaceId: string): Promise<FormSummaryDTO[]> {
  if (!(await roleIn(userId, workspaceId))) return [];
  const rows = await q.selectFormsByWorkspace(workspaceId);
  return rows.map((r) => ({
    id: r.id,
    title: r.draft.title,
    color: r.draft.color,
    questions: r.draft.fields.filter((f) => f.type !== "section").length,
    responses: r.responseCount,
    accepting: r.settings.accepting,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** A form the user may access with at least `min` role in its workspace. */
export async function getFormForUser(userId: string, id: string, min: Role = "viewer"): Promise<FormDTO | null> {
  const r = await q.selectFormForUser(userId, id);
  return r && can(r.role, min) ? toDTO(r.form, r.role) : null;
}

export async function getPublicForm(id: string): Promise<PublicFormDTO | null> {
  return cached(cacheKeys.publicForm(id), 300, async () => {
    const r = await q.selectPublicForm(id);
    if (!r) return null;
    const { form, org, personal } = r;
    // A personal workspace is named "Personal", which means nothing to a respondent.
    // Quiz answer keys never leave the server: grading happens in submitResponse.
    const draft = { ...form.draft, fields: form.draft.fields.map(({ answerKey: _, ...f }) => f) };
    return {
      id: form.id,
      org: personal ? null : org,
      draft,
      accepting: form.settings.accepting,
      closedMessage: form.settings.closedMessage || "This form is no longer accepting responses.",
      limitOne: form.settings.limitOne,
      allowEdit: Boolean(form.settings.allowEdit),
      another: Boolean(form.settings.another),
      shuffleOptions: Boolean(form.settings.shuffleOptions),
      shuffleQuestions: Boolean(form.settings.shuffleQuestions),
      collectEmail: Boolean(form.settings.collectEmail),
    };
  });
}

/** Full row for server-side submission handling (needs the webhook). Never sent to clients. */
export async function getFormForSubmission(id: string) {
  const r = await q.selectForm(id);
  return r ? { draft: r.draft, settings: r.settings } : null;
}

export async function saveForm(userId: string, id: string, draft: FormDraft, settings: EditableSettings) {
  const existing = await getFormForUser(userId, id, "editor");
  if (!existing) return null;
  const { csvKey, sheet } = existing.settings;
  const [row] = await q.updateForm(id, { draft, settings: { ...settings, csvKey, sheet } });
  await invalidate(cacheKeys.publicForm(id));
  return row ? row.updatedAt.toISOString() : null;
}

export async function rotateCsvKey(userId: string, id: string) {
  if (!(await getFormForUser(userId, id, "editor"))) return null;
  const csvKey = token(18);
  await q.mergeSettings(id, { csvKey });
  return csvKey;
}

export async function duplicateForm(userId: string, id: string) {
  const r = await q.selectFormForUser(userId, id);
  if (!r || !can(r.role, "editor")) return null;
  return createForm(userId, r.form.workspaceId, { ...r.form.draft, title: `${r.form.draft.title} (copy)` });
}

export async function deleteForm(userId: string, id: string) {
  if (!(await getFormForUser(userId, id, "editor"))) return false;
  await q.deleteFormRow(id);
  await invalidate(cacheKeys.publicForm(id));
  return true;
}

/** Link or unlink a Google Sheet. Callers must have checked editor access with getFormForUser first. */
export async function setSheet(id: string, sheet: SheetLink | null) {
  const rows = await q.mergeSettings(id, { sheet });
  return rows.length > 0;
}

export const bumpResponseCount = q.bumpResponseCount;
