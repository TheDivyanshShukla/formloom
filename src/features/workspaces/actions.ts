"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import * as ws from "./server/service";

const id = z.uuid();
const name = z.string().trim().min(1, "Give it a name").max(60);
const role = z.enum(["owner", "editor", "viewer"]);

export async function switchWorkspaceAction(workspaceId: string) {
  const user = await requireUser();
  await ws.selectWorkspace(user.id, id.parse(workspaceId));
  redirect("/forms");
}

/** Make the switcher follow the workspace of the form being opened (no redirect). */
export async function focusWorkspaceAction(workspaceId: string) {
  const user = await requireUser();
  return ws.selectWorkspace(user.id, id.parse(workspaceId));
}

export async function createWorkspaceAction(raw: string): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const parsed = name.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const created = await ws.createWorkspace(user.id, parsed.data);
  await ws.selectWorkspace(user.id, created.id);
  redirect("/team");
}

export async function renameWorkspaceAction(workspaceId: string, raw: string) {
  const user = await requireUser();
  const ok = await ws.renameWorkspace(user.id, id.parse(workspaceId), name.parse(raw));
  revalidatePath("/", "layout");
  return ok;
}

export async function createInviteAction(workspaceId: string, r: "editor" | "viewer") {
  const user = await requireUser();
  return ws.createInvite(user.id, id.parse(workspaceId), z.enum(["editor", "viewer"]).parse(r));
}

const MESSAGES = {
  forbidden: "Only owners can do that.",
  last_owner: "A workspace needs at least one owner. Make someone else owner first.",
  not_found: "That person is no longer a member.",
} as const;

export async function setRoleAction(workspaceId: string, userId: string, r: string) {
  const user = await requireUser();
  const res = await ws.setRole(user.id, id.parse(workspaceId), id.parse(userId), role.parse(r));
  revalidatePath("/team");
  return res === "ok" ? null : MESSAGES[res];
}

export async function removeMemberAction(workspaceId: string, userId: string) {
  const user = await requireUser();
  const res = await ws.removeMember(user.id, id.parse(workspaceId), id.parse(userId));
  if (res !== "ok") return MESSAGES[res];
  if (userId === user.id) redirect("/forms");
  revalidatePath("/team");
  return null;
}

export async function acceptInviteAction(token: string) {
  const user = await requireUser();
  const joined = await ws.acceptInvite(user.id, z.string().max(100).parse(token));
  redirect(joined ? "/forms" : "/forms?invite=expired");
}
