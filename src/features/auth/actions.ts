"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/server/auth";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { signInInput, signUpInput } from "./server/schema";
import { createUser } from "./server/service";

export type AuthState = { error?: string; email?: string; name?: string } | undefined;

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/forms";
};

async function limited() {
  return !(await rateLimit(`auth:${await clientIp()}`, 10, 60));
}

export async function signInAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const keep = { email: String(fd.get("email") ?? "") };
  if (await limited()) return { ...keep, error: "Too many attempts. Wait a minute and try again." };
  const parsed = signInInput.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { ...keep, error: parsed.error.issues[0]?.message };
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeNext(fd.get("next")) });
  } catch (e) {
    if (e instanceof AuthError) return { ...keep, error: "Email or password is incorrect." };
    throw e; // redirect
  }
}

export async function signUpAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const keep = { email: String(fd.get("email") ?? ""), name: String(fd.get("name") ?? "") };
  if (await limited()) return { ...keep, error: "Too many attempts. Wait a minute and try again." };
  const parsed = signUpInput.safeParse({
    name: fd.get("name"),
    email: fd.get("email"),
    password: fd.get("password"),
  });
  if (!parsed.success) return { ...keep, error: parsed.error.issues[0]?.message };
  const user = await createUser(parsed.data);
  if (user === "exists") return { ...keep, error: "An account with this email already exists. Sign in instead." };
  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: safeNext(fd.get("next")),
  });
}

export async function googleSignInAction(fd: FormData) {
  await signIn("google", { redirectTo: safeNext(fd.get("next")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
