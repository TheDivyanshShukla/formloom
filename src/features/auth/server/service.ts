import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import type { SignUpInput } from "./schema";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

async function checkPassword(pw: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const key = await scrypt(pw, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}

export type UserDTO = { id: string; email: string; name: string | null; image: string | null };
const toDTO = (u: typeof users.$inferSelect): UserDTO => ({ id: u.id, email: u.email, name: u.name, image: u.image });

export async function createUser(input: SignUpInput): Promise<UserDTO | "exists"> {
  const email = input.email.toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(users)
    .values({ email, name: input.name, passwordHash })
    .onConflictDoNothing({ target: users.email })
    .returning();
  return row ? toDTO(row) : "exists";
}

export async function verifyCredentials(email: string, password: string): Promise<UserDTO | null> {
  const row = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (!row?.passwordHash) return null;
  return (await checkPassword(password, row.passwordHash)) ? toDTO(row) : null;
}

/**
 * OAuth sign-in: find-or-create by Google-verified email. Password accounts are not email-verified, so
 * on a match the password is cleared: someone who pre-registered this address cannot keep a way in.
 */
export async function upsertOAuthUser(email: string, name?: string | null, image?: string | null) {
  const [row] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), name, image })
    .onConflictDoUpdate({ target: users.email, set: { image, passwordHash: null } })
    .returning();
  return toDTO(row!);
}
