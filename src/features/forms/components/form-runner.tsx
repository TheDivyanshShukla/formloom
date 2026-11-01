"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, CheckIcon, CopyIcon, LockIcon, OfflineIcon, SpinnerIcon, XIcon } from "@/components/shared/icons";
import { fieldError, jumpTarget, pages as toPages, seededOrder, videoEmbed, visibleIds } from "../logic";
import { flush, queue } from "../outbox";
import type { QuizResult } from "@/features/responses/server/service";
import type { Answer, Answers, Field, FormDraft } from "../schema";
import { FieldInput } from "./field-input";

type Props = {
  formId: string;
  draft: FormDraft;
  /** Who is asking: the workspace name, shown above the sheet. */
  org?: string;
  accepting?: boolean;
  closedMessage?: string;
  limitOne?: boolean;
  another?: boolean;
  shuffleOptions?: boolean;
  shuffleQuestions?: boolean;
  collectEmail?: boolean;
  /** Builder preview: never submits. */
  preview?: boolean;
};

type Status = "idle" | "sending" | "done" | "queued" | "already";

const doneKey = (id: string) => `formloom:done:${id}`;

export function FormRunner({
  formId,
  draft,
  org,
  accepting = true,
  closedMessage,
  limitOne = false,
  another = false,
  shuffleOptions = false,
  shuffleQuestions = false,
  collectEmail = false,
  preview = false,
}: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [banner, setBanner] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLink, setEditLink] = useState<string | null>(null);
  const [score, setScore] = useState<QuizResult | null>(null);
  const [email, setEmail] = useState("");
  const [seed] = useState(() => {
    let s = 1;
    for (const c of formId) s = (Math.imul(s, 33) + c.charCodeAt(0)) >>> 0;
    return s || 1;
  });
  const top = useRef<HTMLDivElement>(null);

  // Opened from a private edit link: load the earlier answers.
  useEffect(() => {
    if (preview) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("edit");
    if (!token) {
      const seeded: Answers = {};
      for (const f of draft.fields) {
        const v = params.get(f.id);
        if (v && f.type !== "file" && f.type !== "section") seeded[f.id] = v;
      }
      if (Object.keys(seeded).length) setAnswers(seeded);
      return;
    }
    fetch(`/api/forms/${formId}/edit?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const j = (await r.json()) as { answers: Answers };
        setAnswers(j.answers);
        setEditing(token);
        setStatus("idle");
      })
      .catch(() => setBanner("This edit link is no longer valid."));
  }, [formId, preview, draft.fields]);

  useEffect(() => {
    if (preview || !limitOne) return;
    try {
      if (localStorage.getItem(doneKey(formId)) && !new URLSearchParams(window.location.search).get("edit")) setStatus("already");
    } catch {}
  }, [formId, limitOne, preview]);

  // Deliver answers queued while offline, now and whenever the connection returns.
  useEffect(() => {
    if (preview) return;
    flush();
    const h = () => flush();
    window.addEventListener("online", h);
    return () => window.removeEventListener("online", h);
  }, [preview]);

  const visible = useMemo(() => visibleIds(draft.fields, answers), [draft.fields, answers]);
  const pgs = useMemo(() => {
    const pages = toPages(draft.fields, visible);
    if (!shuffleOptions && !shuffleQuestions) return pages;
    return pages.map((page) => {
      const head = page[0]?.type === "section" ? page.slice(0, 1) : [];
      let rest = page.slice(head.length);
      if (shuffleQuestions) rest = seededOrder(rest, seed);
      if (shuffleOptions)
        rest = rest.map((f) => (f.options?.length ? { ...f, options: seededOrder(f.options, seed + f.id.length) } : f));
      return [...head, ...rest];
    });
  }, [draft.fields, visible, shuffleOptions, shuffleQuestions, seed]);
  const cur = Math.min(page, pgs.length - 1);
  const fields = pgs[cur] ?? [];
  const last = cur === pgs.length - 1;
  const asked = draft.fields.filter((f) => f.type !== "section" && visible.has(f.id)).length;

  const set = (id: string, v: Answer | undefined) => {
    setAnswers((a) => {
      const next = { ...a };
      if (v === undefined) delete next[id];
      else next[id] = v;
      return next;
    });
    if (errors[id]) setErrors(({ [id]: _, ...rest }) => rest);
  };

  const check = (list: typeof fields) => {
    const errs: Record<string, string> = {};
    for (const f of list) {
      const e = fieldError(f, answers[f.id]);
      if (e) errs[f.id] = e;
    }
    setErrors(errs);
    const first = list.find((f) => errs[f.id]);
    if (first) {
      const el = document.querySelector<HTMLElement>(`[data-field="${first.id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input,textarea,select,button")?.focus({ preventScroll: true });
    }
    return !first;
  };

  const go = (to: number) => {
    setPage(to);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  async function submit() {
    if (collectEmail && cur === 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors((e) => ({ ...e, _email: "Enter a valid email" }));
      return;
    }
    if (!check(fields)) return;
    if (!last) {
      const jump = jumpTarget(fields, answers);
      if (jump === "submit") {
        /* fall through and submit now */
      } else {
        const idx = jump ? pgs.findIndex((p) => p.some((f) => f.id === jump)) : -1;
        return go(idx >= 0 ? idx : cur + 1);
      }
    }
    if (preview) {
      setStatus("done");
      return;
    }
    setStatus("sending");
    setBanner(null);
    try {
      const res = editing
        ? await fetch(`/api/forms/${formId}/edit`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: editing, answers: collectEmail ? { ...answers, _email: email } : answers }),
          })
        : await fetch(`/api/forms/${formId}/responses`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ answers: collectEmail ? { ...answers, _email: email } : answers }),
          });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        try {
          if (limitOne) localStorage.setItem(doneKey(formId), "1");
        } catch {}
        const token = editing ?? json.editToken;
        if (token) setEditLink(`${window.location.origin}/f/${formId}?edit=${encodeURIComponent(token)}`);
        if (json.score) setScore(json.score);
        setStatus("done");
        return;
      }
      setStatus("idle");
      setBanner(json.error ?? "Something went wrong. Please try again.");
      if (json.errors) {
        setErrors(json.errors);
        const idx = pgs.findIndex((p) => p.some((f) => json.errors[f.id]));
        if (idx >= 0) go(idx);
      }
    } catch {
      if (editing) {
        setStatus("idle");
        setBanner("You seem to be offline. Your changes are still here; try again when you reconnect.");
        return;
      }
      // Offline: keep the answers on this device and send them when the connection returns.
      queue(formId, collectEmail ? { ...answers, _email: email } : answers);
      try {
        if (limitOne) localStorage.setItem(doneKey(formId), "1");
      } catch {}
      setStatus("queued");
    }
  }

  const finished = !accepting || status === "already" || status === "done" || status === "queued";
  const progress = pgs.length > 1 ? (cur + 1) / pgs.length : 0;

  return (
    <div ref={top} style={{ "--form": draft.color } as React.CSSProperties} className={`mx-auto w-full max-w-[720px] scroll-mt-4 ${draft.font === "serif" ? "font-serif" : ""}`}>
      <div className="mb-3 flex items-center gap-2 px-1 text-sm text-muted-foreground">
        <span className="size-2.5 rounded-[3px] bg-form" aria-hidden />
        <span className="truncate font-medium text-foreground">{org ?? (preview ? "Preview" : "Form")}</span>
        {!finished && (
          <span className="num ml-auto shrink-0">
            {pgs.length > 1 ? `Page ${cur + 1} of ${pgs.length}` : `${asked} question${asked === 1 ? "" : "s"}`}
          </span>
        )}
      </div>

      <div className="sheet relative overflow-hidden">
        {progress > 0 && !finished && (
          <div className="absolute inset-x-0 top-0 h-[3px] bg-muted" aria-hidden>
            <div className="h-full bg-form transition-[width] duration-300 ease-out" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        <header className="px-6 pb-6 pt-8 sm:px-10 sm:pt-10">
          {draft.headerImage && cur === 0 && !finished && (
            <img src={draft.headerImage} alt="" className="mb-6 max-h-48 w-full rounded-md object-cover" />
          )}
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.015em] sm:text-[28px]">{draft.title}</h1>
          {editing && !finished && <p className="mt-2 text-sm font-medium text-muted-foreground">Editing your earlier response</p>}
          {draft.description && cur === 0 && !finished && (
            <p className="mt-3 max-w-[60ch] whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{draft.description}</p>
          )}
        </header>

        {finished ? (
          <>
            <Finished
              status={status}
              accepting={accepting}
              closedMessage={closedMessage}
              another={another && !editing}
              confirmation={editing ? "Your changes were saved." : draft.confirmation}
              preview={preview}
              onReset={() => {
                setStatus("idle");
                setAnswers({});
                setPage(0);
                try {
                  localStorage.removeItem(doneKey(formId));
                } catch {}
              }}
            />
            {status === "done" && score && <ScoreCard score={score} />}
            {status === "done" && editLink && <EditLinkRow link={editLink} />}
          </>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="divide-y border-t">
              {collectEmail && cur === 0 && (
                <div className="px-6 py-7 sm:px-10">
                  <label htmlFor="respondent-email" className="text-base font-medium">
                    Email
                  </label>
                  <input
                    id="respondent-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    aria-invalid={Boolean(errors._email) || undefined}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-3 h-11 w-full rounded-md border border-input bg-card px-3.5 text-[15px] outline-none focus:border-foreground/60"
                  />
                  {errors._email && <p className="mt-2 text-sm font-medium text-destructive">{errors._email}</p>}
                </div>
              )}
              {fields.map((f) =>
                f.type === "video" ? (
                  <VideoBlock key={f.id} field={f} />
                ) : f.type === "text" ? (
                  <div key={f.id} className="px-6 py-7 sm:px-10">
                    {f.image && <img src={f.image} alt="" className="mb-4 max-h-64 w-full rounded-md object-cover" />}
                    <h2 className="text-lg font-semibold">{f.label}</h2>
                    {f.description && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{f.description}</p>}
                  </div>
                ) :
                f.type === "section" ? (
                  <section key={f.id} className="bg-muted px-6 py-5 sm:px-10">
                    <h2 className="text-lg font-semibold">{f.label}</h2>
                    {f.description && <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>}
                  </section>
                ) : (
                  <div key={f.id} className="px-6 py-7 sm:px-10">
                    <FieldInput field={f} value={answers[f.id]} onChange={(v) => set(f.id, v)} error={errors[f.id]} formId={formId} preview={preview} />
                  </div>
                ),
              )}
            </div>

            {banner && (
              <p role="alert" className="mx-6 mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive sm:mx-10">
                {banner}
              </p>
            )}

            <div className="flex items-center gap-3 border-t bg-muted/60 px-6 py-4 sm:px-10">
              {cur > 0 && (
                <button
                  type="button"
                  onClick={() => go(cur - 1)}
                  className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ArrowLeftIcon className="size-4" /> Back
                </button>
              )}
              <button
                type="submit"
                disabled={status === "sending"}
                className="ml-auto inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-md bg-primary px-6 text-[15px] font-medium text-primary-foreground outline-none transition-[transform,opacity] duration-150 hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/40 active:translate-y-px disabled:opacity-60"
              >
                {status === "sending" && <SpinnerIcon className="size-4 animate-spin" />}
                {last ? (preview ? "Submit preview" : editing ? "Save changes" : "Submit") : "Next"}
                {!last && <ArrowRightIcon className="size-4" />}
              </button>
            </div>
          </form>
        )}
      </div>

      {!preview && (
        <p className="mt-5 px-1 text-xs text-muted-foreground">
          Never submit passwords through forms. Built with{" "}
          <a href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
            Formloom
          </a>
          .
        </p>
      )}
    </div>
  );
}

function VideoBlock({ field: f }: { field: Field }) {
  const media = videoEmbed(f.placeholder ?? "");
  return (
    <div className="px-6 py-7 sm:px-10">
      {f.label && <h2 className="text-lg font-semibold">{f.label}</h2>}
      {f.description && <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>}
      {media?.kind === "iframe" && (
        <iframe title={f.label || "Video"} src={media.src} className="mt-4 aspect-video w-full rounded-md border" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      )}
      {media?.kind === "file" && <video src={media.src} controls className="mt-4 aspect-video w-full rounded-md bg-black" />}
      {!media && f.placeholder && <p className="mt-3 text-sm text-destructive">This video link is not a YouTube, Vimeo, or https mp4/webm address.</p>}
    </div>
  );
}

function Finished({
  status,
  accepting,
  closedMessage,
  another,
  confirmation,
  preview,
  onReset,
}: {
  status: Status;
  accepting: boolean;
  closedMessage?: string;
  another?: boolean;
  confirmation: string;
  preview: boolean;
  onReset: () => void;
}) {
  const [Icon, text] =
    status === "queued"
      ? [OfflineIcon, "You are offline. Your response is saved on this device and will be sent automatically when you reconnect."]
      : status === "done"
        ? [CheckCircleIcon, confirmation]
        : status === "already"
          ? [LockIcon, "You have already responded to this form."]
          : [LockIcon, accepting ? "" : closedMessage || "This form is no longer accepting responses."];
  return (
    <div className="flex items-start gap-4 border-t px-6 py-8 sm:px-10" role="status">
      <Icon className={status === "done" ? "size-6 shrink-0 text-success" : "size-6 shrink-0 text-muted-foreground"} />
      <div>
        <p className="text-base font-medium leading-relaxed">{text}</p>
        {status === "done" && (preview || another) && (
          <button type="button" onClick={onReset} className="mt-3 text-sm font-medium underline-offset-4 hover:underline">
            Submit another response
          </button>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ score }: { score: QuizResult }) {
  return (
    <div className="border-t px-6 py-6 sm:px-10">
      <p className="text-sm text-muted-foreground">Your score</p>
      <p className="num mt-1 text-[28px] font-semibold leading-none">
        {score.score} <span className="text-lg font-normal text-muted-foreground">/ {score.max}</span>
      </p>
      {score.feedback.length > 0 && (
        <ul className="mt-5 divide-y rounded-md border">
          {score.feedback.map((f, i) => (
            <li key={i} className="flex gap-3 px-4 py-3 text-sm">
              {f.correct ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-label="Correct" /> : <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Incorrect" />}
              <div>
                <p className="font-medium">{f.label}</p>
                {f.text && <p className="mt-0.5 text-muted-foreground">{f.text}</p>}
                {f.expected && <p className="mt-0.5 text-muted-foreground">Correct answer: {f.expected}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditLinkRow({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-t px-6 py-5 sm:px-10">
      <p className="text-sm font-medium">Need to change something later?</p>
      <p className="mt-0.5 text-sm text-muted-foreground">Keep this private link. Anyone with it can edit your response.</p>
      <div className="mt-3 flex gap-2">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Edit link" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-muted px-3 font-mono text-[12px] outline-none" />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(link).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"
        >
          {copied ? <CheckIcon className="size-4 text-success" /> : <CopyIcon className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
