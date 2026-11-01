import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { cacheKeys, invalidate } from "@/server/cache";
import { forms, invites, members, type Role, users, workspaces } from "@/server/db/schema";

export type { Role };
export type WorkspaceDTO = { id: string; name: string; personal: boolean; role: Role };
export type MemberDTO = { userId: string; name: string | null; email: string; role: Role };

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };
export const can = (role: Role | null | undefined, min: Role) => Boolean(role && RANK[role] >= RANK[min]);

const COOKIE = "fl_ws";

export async function listWorkspaces(userId: string): Promise<WorkspaceDTO[]> {
  const rows = await db
    .select({ id: workspaces.id, name: workspaces.name, personal: workspaces.personal, role: members.role })
    .from(members)
    .innerJoin(workspaces, eq(workspaces.id, members.workspaceId))
    .where(eq(members.userId, userId))
    .orderBy(sql`${workspaces.personal} desc`, asc(workspaces.name));
  if (rows.length) return rows;
  // First visit: every account starts with a personal workspace. Parallel first renders race here, so
  // serialise per user with a transaction-scoped advisory lock and re-check inside it.
  return [await ensurePersonal(userId)];
}

async function ensurePersonal(userId: string): Promise<WorkspaceDTO> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [hit] = await tx
      .select({ id: workspaces.id, name: workspaces.name, personal: workspaces.personal, role: members.role })
      .from(members)
      .innerJoin(workspaces, eq(workspaces.id, members.workspaceId))
      .where(and(eq(members.userId, userId), eq(workspaces.personal, true)))
      .limit(1);
    if (hit) return hit;
    const [ws] = await tx.insert(workspaces).values({ name: "Personal", personal: true }).returning();
    await tx.insert(members).values({ workspaceId: ws!.id, userId, role: "owner" });
    return { id: ws!.id, name: ws!.name, personal: true, role: "owner" as const };
  });
}

export async function createWorkspace(userId: string, name: string, personal = false): Promise<WorkspaceDTO> {
  return db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspaces).values({ name, personal }).returning();
    await tx.insert(members).values({ workspaceId: ws!.id, userId, role: "owner" });
    return { id: ws!.id, name: ws!.name, personal: ws!.personal, role: "owner" as const };
  });
}

export async function roleIn(userId: string, workspaceId: string): Promise<Role | null> {
  const r = await db.query.members.findFirst({
    where: and(eq(members.userId, userId), eq(members.workspaceId, workspaceId)),
    columns: { role: true },
  });
  return r?.role ?? null;
}

/** The workspace picked in the switcher (cookie), validated against membership. */
export async function currentWorkspace(userId: string): Promise<WorkspaceDTO> {
  const all = await listWorkspaces(userId);
  const picked = (await cookies()).get(COOKIE)?.value;
  return all.find((w) => w.id === picked) ?? all[0]!;
}

export async function selectWorkspace(userId: string, workspaceId: string) {
  if (!(await roleIn(userId, workspaceId))) return false;
  (await cookies()).set(COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return true;
}

export async function renameWorkspace(userId: string, workspaceId: string, name: string) {
  if (!can(await roleIn(userId, workspaceId), "owner")) return false;
  await db.update(workspaces).set({ name }).where(eq(workspaces.id, workspaceId));
  // Public forms show the workspace name; drop their cached copies.
  const ids = await db.select({ id: forms.id }).from(forms).where(eq(forms.workspaceId, workspaceId));
  if (ids.length) await invalidate(...ids.map((f) => cacheKeys.publicForm(f.id)));
  return true;
}

export async function listMembers(userId: string, workspaceId: string): Promise<MemberDTO[] | null> {
  if (!(await roleIn(userId, workspaceId))) return null;
  return db
    .select({ userId: users.id, name: users.name, email: users.email, role: members.role })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.workspaceId, workspaceId))
    .orderBy(asc(users.email));
}

async function ownerCount(workspaceId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(members)
    .where(and(eq(members.workspaceId, workspaceId), eq(members.role, "owner")));
  return r?.n ?? 0;
}

export async function setRole(actorId: string, workspaceId: string, userId: string, role: Role) {
  if (!can(await roleIn(actorId, workspaceId), "owner")) return "forbidden";
  const current = await roleIn(userId, workspaceId);
  if (!current) return "not_found";
  if (current === "owner" && role !== "owner" && (await ownerCount(workspaceId)) <= 1) return "last_owner";
  await db.update(members).set({ role }).where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)));
  return "ok";
}

export async function removeMember(actorId: string, workspaceId: string, userId: string) {
  const self = actorId === userId;
  if (!self && !can(await roleIn(actorId, workspaceId), "owner")) return "forbidden";
  if ((await roleIn(userId, workspaceId)) === "owner" && (await ownerCount(workspaceId)) <= 1) return "last_owner";
  await db.delete(members).where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)));
  return "ok";
}

export async function createInvite(actorId: string, workspaceId: string, role: Exclude<Role, "owner">) {
  if (!can(await roleIn(actorId, workspaceId), "owner")) return null;
  const token = randomBytes(18).toString("base64url");
  await db.insert(invites).values({ token, workspaceId, role, expiresAt: new Date(Date.now() + 7 * 864e5) });
  return token;
}

export async function inviteInfo(token: string) {
  const [r] = await db
    .select({ workspaceId: invites.workspaceId, role: invites.role, name: workspaces.name })
    .from(invites)
    .innerJoin(workspaces, eq(workspaces.id, invites.workspaceId))
    .where(and(eq(invites.token, token), gt(invites.expiresAt, new Date())));
  return r ?? null;
}

/** Join via invite link. Existing members keep their (possibly higher) role. */
export async function acceptInvite(userId: string, token: string) {
  const inv = await inviteInfo(token);
  if (!inv) return null;
  await db.insert(members).values({ workspaceId: inv.workspaceId, userId, role: inv.role }).onConflictDoNothing();
  await selectWorkspace(userId, inv.workspaceId);
  return inv.workspaceId;
}
