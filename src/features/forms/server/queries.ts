import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { forms, members, workspaces } from "@/server/db/schema";
import type { FormDraft, Settings } from "../schema";

export const insertForm = (v: { id: string; workspaceId: string; createdBy: string; draft: FormDraft; settings: Settings }) =>
  db.insert(forms).values(v).returning();

export const selectFormsByWorkspace = (workspaceId: string) =>
  db.select().from(forms).where(eq(forms.workspaceId, workspaceId)).orderBy(desc(forms.updatedAt));

export const selectForm = (id: string) => db.query.forms.findFirst({ where: eq(forms.id, id) });

export async function selectPublicForm(id: string) {
  const [r] = await db
    .select({ form: forms, org: workspaces.name, personal: workspaces.personal })
    .from(forms)
    .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
    .where(eq(forms.id, id));
  return r ?? null;
}

/** The form plus the caller's role in its workspace; null when they are not a member. */
export async function selectFormForUser(userId: string, id: string) {
  const [r] = await db
    .select({ form: forms, role: members.role })
    .from(forms)
    .innerJoin(members, and(eq(members.workspaceId, forms.workspaceId), eq(members.userId, userId)))
    .where(eq(forms.id, id));
  return r ?? null;
}

export const updateForm = (id: string, v: { draft: FormDraft; settings: Settings }) =>
  db
    .update(forms)
    .set({ ...v, updatedAt: sql`now()` })
    .where(eq(forms.id, id))
    .returning({ updatedAt: forms.updatedAt });

/** Patch only keys of settings (jsonb merge), leaving the draft untouched so a concurrent autosave is not reverted. */
export const mergeSettings = (id: string, patch: Partial<Settings>) =>
  db
    .update(forms)
    .set({ settings: sql`${forms.settings} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(forms.id, id))
    .returning({ id: forms.id });

export const deleteFormRow = (id: string) => db.delete(forms).where(eq(forms.id, id)).returning({ id: forms.id });

export const bumpResponseCount = (id: string, by: number | "reset") =>
  db
    .update(forms)
    .set({ responseCount: by === "reset" ? 0 : sql`${forms.responseCount} + ${by}` })
    .where(eq(forms.id, id));
