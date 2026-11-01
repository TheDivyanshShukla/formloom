import "server-only";
import { and, eq } from "drizzle-orm";
import type { Answers } from "@/features/forms/schema";
import { db } from "@/server/db";
import { responses } from "@/server/db/schema";

export const setTokenHash = (id: number, editTokenHash: string) =>
  db.update(responses).set({ editTokenHash }).where(eq(responses.id, id));

export const byTokenHash = (formId: string, hash: string) =>
  db
    .select({ id: responses.id, answers: responses.answers, createdAt: responses.createdAt, hash: responses.editTokenHash })
    .from(responses)
    .where(and(eq(responses.formId, formId), eq(responses.editTokenHash, hash)))
    .limit(1);

export const saveEdit = (id: number, answers: Answers, editedAt: Date) =>
  db.update(responses).set({ answers, editedAt }).where(eq(responses.id, id));
