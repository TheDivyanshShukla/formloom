"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { designForm } from "@/features/ai/server/service";
import { type AiResult, aiEditInput } from "@/features/ai/server/schema";
import { unsafePattern } from "./logic";
import { FormDraft, Settings, blankDraft } from "./schema";
import * as forms from "./server/service";
import { deleteAllResponses } from "@/features/responses/server/service";
import { currentWorkspace } from "@/features/workspaces/server/service";

type Fail = { ok: false; error: string };

/** AI output is untrusted too: drop any pattern that could backtrack catastrophically. */
const stripUnsafePatterns = (d: FormDraft): FormDraft => ({
  ...d,
  fields: d.fields.map((f) => (f.pattern && unsafePattern(f.pattern) ? { ...f, pattern: undefined, examples: undefined } : f)),
});

const aiLimited = async (uid: string) => !(await rateLimit(`ai:${uid}`, 20, 60));

const aiError = (e: unknown): Fail => ({
  ok: false,
  error: e instanceof Error && e.message ? e.message : "The assistant is unavailable right now. Try again.",
});

/** Create a form from a prompt (or blank). Returns the AI's first reply so the builder chat can show it. */
export async function createFormAction(
  prompt: string,
): Promise<{ ok: true; id: string; seed: (Omit<AiResult, "form"> & { prompt: string }) | null } | Fail> {
  const user = await requireUser();
  const text = z.string().trim().max(4000).parse(prompt);
  let draft = blankDraft();
  let seed: AiResult | null = null;
  if (text) {
    if (await aiLimited(user.id)) return { ok: false, error: "Too many requests. Wait a minute." };
    try {
      seed = await designForm([{ role: "user", content: text }], null);
      draft = stripUnsafePatterns(seed.form);
    } catch (e) {
      return aiError(e);
    }
  }
  const ws = await currentWorkspace(user.id);
  const form = await forms.createForm(user.id, ws.id, draft);
  if (!form) return { ok: false, error: "You have view-only access to this workspace." };
  if (!seed) return { ok: true, id: form.id, seed: null };
  const { form: _, ...rest } = seed;
  return { ok: true, id: form.id, seed: { prompt: text, ...rest } };
}

export async function aiEditAction(raw: unknown): Promise<({ ok: true } & AiResult) | Fail> {
  const user = await requireUser();
  const input = aiEditInput.parse(raw);
  if (await aiLimited(user.id)) return { ok: false, error: "Too many requests. Wait a minute." };
  if (!(await forms.getFormForUser(user.id, input.formId, "editor"))) return { ok: false, error: "Form not found." };
  try {
    const r = await designForm(input.history, input.draft);
    return { ok: true, ...r, form: stripUnsafePatterns(r.form) };
  } catch (e) {
    return aiError(e);
  }
}

const saveInput = z.object({
  id: z.string().min(1),
  draft: FormDraft,
  settings: Settings.omit({ csvKey: true, sheet: true }),
});

export async function saveFormAction(raw: unknown): Promise<{ ok: true; updatedAt: string } | Fail> {
  const user = await requireUser();
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const ids = parsed.data.draft.fields.map((f) => f.id);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Two questions share the same id." };
  const slow = parsed.data.draft.fields.find((f) => f.pattern && unsafePattern(f.pattern));
  if (slow) return { ok: false, error: `The pattern on “${slow.label}” is too complex. Simplify it (no nested repeats).` };
  const updatedAt = await forms.saveForm(user.id, parsed.data.id, parsed.data.draft, parsed.data.settings);
  return updatedAt ? { ok: true, updatedAt } : { ok: false, error: "Form not found." };
}

export async function deleteFormAction(id: string) {
  const user = await requireUser();
  await forms.deleteForm(user.id, z.string().parse(id));
  redirect("/forms");
}

export async function duplicateFormAction(id: string) {
  const user = await requireUser();
  const copy = await forms.duplicateForm(user.id, z.string().parse(id));
  if (copy) redirect(`/forms/${copy.id}`);
}

export async function rotateCsvKeyAction(id: string) {
  const user = await requireUser();
  return forms.rotateCsvKey(user.id, z.string().parse(id));
}

export async function clearResponsesAction(id: string) {
  const user = await requireUser();
  return deleteAllResponses(user.id, z.string().parse(id));
}
