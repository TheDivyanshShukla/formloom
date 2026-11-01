import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { answerText, validate } from "@/features/forms/logic";
import { type Answers, type Field, type FileAnswer, type FormDraft, isFileAnswer, isUploadKey } from "@/features/forms/schema";
import { bumpResponseCount, getFormForSubmission, getFormForUser } from "@/features/forms/server/service";
import { env } from "@/server/env";
import { storage } from "@/server/storage";
import { enqueue, type Job, runDue } from "@/features/deliveries/server/service";
import { scoreResponse } from "@/features/quiz/score";
import { issueEditToken } from "./edit";
import { sendMail } from "./mail";
import * as q from "./queries";

export type ResponseDTO = { id: number; createdAt: string; answers: Answers };

type SubmitResult =
  | { ok: true; editToken?: string; score?: QuizResult }
  | { ok: false; status: number; error: string; errors?: Record<string, string> };

export async function submitResponse(formId: string, answers: Answers): Promise<SubmitResult> {
  const form = await getFormForSubmission(formId);
  if (!form) return { ok: false, status: 404, error: "This form does not exist." };
  if (!form.settings.accepting) return { ok: false, status: 403, error: "This form is no longer accepting responses." };

  // File answers must reference an upload made for this form, never another form's object.
  for (const a of Object.values(answers))
    if (isFileAnswer(a) && !isUploadKey(a.key, formId))
      return { ok: false, status: 400, error: "Invalid file reference." };

  const { errors, clean } = validate(form.draft, answers);
  if (Object.keys(errors).length) return { ok: false, status: 422, error: "Some answers need attention.", errors };

  const email = typeof answers._email === "string" ? answers._email.trim() : "";
  if (form.settings.collectEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, status: 422, error: "Enter the email address this form asks for.", errors: { _email: "Enter a valid email" } };
  if (email) clean._email = email;

  const [row] = await q.insertResponse(formId, clean);
  await bumpResponseCount(formId, 1);

  if (row) await enqueueDeliveries(formId, form, row.id, row.createdAt, clean);
  if (row) {
    const to: string[] = [];
    if (form.settings.notifyEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.settings.notifyEmail)) to.push(form.settings.notifyEmail);
    if (form.settings.sendCopy && email) to.push(email);
    if (to.length) {
      const lines = Object.entries(clean)
        .filter(([k]) => k !== "_email")
        .map(([k, v]) => `${k}: ${isFileAnswer(v) ? v.name : Array.isArray(v) ? v.join(", ") : v}`);
      after(() => sendMail(to, `New response: ${form.draft.title}`, [`Form: ${form.draft.title}`, email && `From: ${email}`, "", ...lines].filter(Boolean).join("\n")));
    }
  }
  const editToken = row && form.settings.allowEdit ? await issueEditToken(row.id) : undefined;
  return { ok: true, editToken, score: releasedScore(form.draft, clean) };
}

export type QuizResult = { score: number; max: number; feedback: { label: string; correct: boolean; text?: string; expected?: string }[] };

/** Score to show the respondent right away, only for quizzes that release scores immediately. */
export function releasedScore(draft: FormDraft, answers: Answers): QuizResult | undefined {
  if (!draft.quiz?.enabled || draft.quiz.releaseScore !== "immediately") return undefined;
  const r = scoreResponse(draft.fields, answers);
  const feedback = draft.fields
    .filter((f) => r.perField[f.id])
    .map((f) => {
      const correct = r.perField[f.id]!.correct;
      return {
        label: f.label,
        correct,
        text: f.answerKey?.feedback,
        expected: correct ? undefined : f.answerKey?.correct.join(", "),
      };
    });
  return { score: r.score, max: r.max, feedback };
}

/** Queue the webhook post and Sheets row for a stored response, then try them right after the reply. */
export async function enqueueDeliveries(
  formId: string,
  form: { draft: FormDraft; settings: { webhook: string; sheet?: unknown } },
  responseId: number,
  at: Date,
  answers: Answers,
  edited = false,
) {
  const { webhook, sheet } = form.settings;
  if (!webhook && !sheet) return;
  const byLabel: Record<string, string> = {};
  for (const f of answerFields(form.draft)) byLabel[f.label] = cellValue(f, answers[f.id]);
  const submittedAt = at.toISOString();
  const jobs: Job[] = [];
  if (webhook)
    jobs.push({
      formId,
      kind: "webhook",
      target: webhook,
      payload: { form: { id: formId, title: form.draft.title }, response: { id: responseId, submittedAt, edited, answers: byLabel } },
    });
  if (sheet) jobs.push({ formId, kind: "sheet", payload: { "Submitted at": submittedAt, ...byLabel } });
  await enqueue(jobs);
  after(() => runDue(jobs.length).then(() => undefined));
}

const answerFields = (draft: FormDraft) => draft.fields.filter((f) => f.type !== "section" && f.type !== "text" && f.type !== "video");

function cellValue(f: Field, a: Answers[string] | undefined) {
  if (isFileAnswer(a)) return `${env.NEXT_PUBLIC_APP_URL}/api/files/${a.key}`;
  return answerText(f, a, "; ");
}

export async function listResponses(userId: string, formId: string): Promise<ResponseDTO[] | null> {
  if (!(await getFormForUser(userId, formId))) return null;
  const rows = await q.selectResponses(formId);
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), answers: r.answers }));
}

export async function deleteAllResponses(userId: string, formId: string) {
  if (!(await getFormForUser(userId, formId, "editor"))) return false;
  await q.deleteResponsesOf(formId);
  await bumpResponseCount(formId, "reset");
  return true;
}

/** Spreadsheet cells starting with these run as formulas in Sheets/Excel; neutralise them. */
const csvCell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

const keyMatches = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Live CSV for Google Sheets IMPORTDATA / Excel "From Web". Authorised by the per-form secret key. */
export async function responsesCsv(formId: string, key: string): Promise<string | null> {
  const form = await getFormForSubmission(formId);
  if (!form || !keyMatches(form.settings.csvKey, key)) return null;
  const fields = answerFields(form.draft);
  const rows = await q.selectResponses(formId);
  const lines = [
    ["Submitted at", ...fields.map((f) => f.label)],
    ...rows
      .reverse()
      .map((r) => [r.createdAt.toISOString(), ...fields.map((f) => cellValue(f, r.answers[f.id]))]),
  ];
  return lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
}

const MAX_UPLOAD_MB = 25;

export async function uploadFile(formId: string, fieldId: string, file: File): Promise<FileAnswer | { error: string }> {
  const form = await getFormForSubmission(formId);
  if (!form?.settings.accepting) return { error: "This form is not accepting responses." };
  const field = form.draft.fields.find((f) => f.id === fieldId && f.type === "file");
  if (!field) return { error: "Unknown upload field." };
  const limitMb = Math.min(field.max ?? 10, MAX_UPLOAD_MB);
  if (file.size > limitMb * 1024 * 1024) return { error: `File must be under ${limitMb} MB` };
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (field.options?.length && !field.options.some((o) => o.toLowerCase() === ext))
    return { error: `Allowed: ${field.options.join(", ")}` };
  const key = `${formId}/${randomUUID()}${/^\.[a-z0-9]{1,8}$/.test(ext) ? ext : ""}`;
  const type = file.type || "application/octet-stream";
  await storage.put(key, new Uint8Array(await file.arrayBuffer()), type);
  return { key, name: file.name.slice(0, 200), size: file.size, type };
}

/** Only members of the form's workspace may download uploaded files. */
export async function readFile(userId: string, key: string) {
  if (!isUploadKey(key)) return null;
  const formId = key.split("/")[0] ?? "";
  if (!(await getFormForUser(userId, formId))) return null;
  return storage.get(key);
}
