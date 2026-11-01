import "server-only";

/*
 * CONTRACT (owned by agent a2 / task T5). Signatures frozen.
 * Respondent edit links: a random token is returned once (in the confirmation screen and link),
 * only its sha256 is stored. Editing re-validates exactly like a new submission.
 */
import { validate } from "@/features/forms/logic";
import { type Answers, isFileAnswer, isUploadKey } from "@/features/forms/schema";
import { getFormForSubmission } from "@/features/forms/server/service";
import { hashesEqual, hashToken, newToken } from "./edit.logic";
import * as q from "./edit.queries";
import { enqueueDeliveries, type QuizResult, releasedScore } from "./service";

export type EditResult =
  | { ok: true; score?: QuizResult }
  | { ok: false; status: number; error: string; errors?: Record<string, string> };

/** Create and store a token for a response; returns the raw token. */
export async function issueEditToken(responseId: number): Promise<string> {
  const token = newToken();
  await q.setTokenHash(responseId, hashToken(token));
  return token;
}

async function locate(formId: string, token: string) {
  const form = await getFormForSubmission(formId);
  if (!form?.settings.allowEdit || !form.settings.accepting || !token) return null;
  const hash = hashToken(token);
  const [row] = await q.byTokenHash(formId, hash);
  if (!row?.hash || !hashesEqual(row.hash, hash)) return null;
  return { form, row };
}

/** The response a token unlocks, if the form still allows editing and is accepting responses. */
export async function getResponseForEdit(formId: string, token: string): Promise<{ id: number; answers: Answers } | null> {
  const hit = await locate(formId, token);
  return hit ? { id: hit.row.id, answers: hit.row.answers } : null;
}

/** Replace the answers of the response a token unlocks. Re-runs validation; sets editedAt; re-sends to webhook/sheet via the outbox. */
export async function updateResponse(formId: string, token: string, answers: Answers): Promise<EditResult> {
  const hit = await locate(formId, token);
  if (!hit) return { ok: false, status: 404, error: "This edit link is not valid." };

  for (const a of Object.values(answers))
    if (isFileAnswer(a) && !isUploadKey(a.key, formId)) return { ok: false, status: 400, error: "Invalid file reference." };

  const { errors, clean } = validate(hit.form.draft, answers);
  if (Object.keys(errors).length) return { ok: false, status: 422, error: "Some answers need attention.", errors };

  await q.saveEdit(hit.row.id, clean, new Date());
  await enqueueDeliveries(formId, hit.form, hit.row.id, hit.row.createdAt, clean, true);
  return { ok: true, score: releasedScore(hit.form.draft, clean) };
}
