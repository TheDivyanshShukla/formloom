import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { googleConnections, responses } from "@/server/db/schema";

export const selectConnection = async (userId: string) =>
  (await db.select().from(googleConnections).where(eq(googleConnections.userId, userId)).limit(1))[0] ?? null;

export const upsertConnection = (userId: string, email: string, refreshToken: string) =>
  db
    .insert(googleConnections)
    .values({ userId, email, refreshToken })
    .onConflictDoUpdate({ target: googleConnections.userId, set: { email, refreshToken } });

export const deleteConnection = (userId: string) => db.delete(googleConnections).where(eq(googleConnections.userId, userId));

export const selectAllResponses = (formId: string) =>
  db.select().from(responses).where(eq(responses.formId, formId)).orderBy(responses.createdAt).limit(50_000);
