import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { responses } from "@/server/db/schema";
import type { Answers } from "@/features/forms/schema";

export const insertResponse = (formId: string, answers: Answers) =>
  db.insert(responses).values({ formId, answers }).returning();

export const selectResponses = (formId: string, limit = 10_000) =>
  db.select().from(responses).where(eq(responses.formId, formId)).orderBy(desc(responses.createdAt)).limit(limit);

export const deleteResponsesOf = (formId: string) => db.delete(responses).where(eq(responses.formId, formId));
