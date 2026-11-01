"use client";

import {
  ArrowUpIcon,
  LightbulbIcon,
  QuestionIcon,
  RetryIcon,
  SparkleIcon,
  SpinnerIcon,
  XIcon,
} from "@/components/shared/icons";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiQuestion, AiSuggestion } from "@/features/ai/server/schema";
import { aiEditAction } from "../../actions";
import type { FormDraft } from "../../schema";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  questions?: AiQuestion[];
  suggestions?: AiSuggestion[];
  failed?: boolean;
};

const STARTERS = ["Make it shorter", "Add a consent checkbox at the end", "Split it into sections", "Suggest better validation"];

export function AiPanel({
  formId,
  draft,
  onApply,
  className,
  onClose,
}: {
  formId: string;
  draft: FormDraft;
  onApply: (next: FormDraft, note: string) => void;
  className?: string;
  onClose?: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  // First reply from the creation prompt, handed over by the composer.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`formloom:seed:${formId}`);
      if (!raw) return;
      sessionStorage.removeItem(`formloom:seed:${formId}`);
      const seed = JSON.parse(raw) as { prompt: string; reply: string; questions: AiQuestion[]; suggestions: AiSuggestion[] };
      setMsgs([
        { role: "user", content: seed.prompt },
        { role: "assistant", content: seed.reply, questions: seed.questions, suggestions: seed.suggestions },
      ]);
    } catch {}
  }, [formId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the conversation grows
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function send(content: string, base: Msg[] = msgs) {
    const c = content.trim();
    if (!c || busy) return;
    const next: Msg[] = [...base, { role: "user", content: c }];
    setMsgs(next);
    setText("");
    setBusy(true);
    // Failed turns are excluded so roles keep alternating for the model.
    const history = next
      .filter((m, i) => !m.failed && !(m.role === "user" && next[i + 1]?.failed))
      .map(({ role, content }) => ({ role, content }))
      .slice(-30);
    const res = await aiEditAction({ formId, draft, history }).catch(() => ({ ok: false as const, error: "Network error. Try again." }));
    setBusy(false);
    if (!res.ok) {
      setMsgs([...next, { role: "assistant", content: res.error, failed: true }]);
      return;
    }
    onApply(res.form, res.reply);
    setMsgs([...next, { role: "assistant", content: res.reply, questions: res.questions, suggestions: res.suggestions }]);
  }

  const lastAssistant = msgs.findLastIndex((m) => m.role === "assistant" && !m.failed);

  return (
    <aside className={cn("flex min-h-0 flex-col bg-card", className)} aria-label="AI assistant">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <SparkleIcon className="size-5 text-support" />
        <div>
          <p className="text-sm font-medium leading-none">Assistant</p>
          <p className="mt-1 text-xs text-muted-foreground">Edits the form as you talk</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon-sm" aria-label="Close assistant" onClick={onClose} className="ml-auto">
            <XIcon />
          </Button>
        )}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {msgs.length === 0 && (
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">Describe a change in plain words, or start with one of these.</p>
            <div className="mt-4 flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 rounded-xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-4 space-y-3">
              <div className={cn("rounded-xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm", m.failed && "bg-destructive/10 text-destructive")}>
                {m.content}
                {m.failed && (
                  <button
                    type="button"
                    onClick={() => {
                      const prev = msgs[i - 1];
                      if (prev) send(prev.content, msgs.slice(0, i - 1));
                    }}
                    className="mt-2 flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                  >
                    <RetryIcon className="size-3" /> Retry
                  </button>
                )}
              </div>

              {i === lastAssistant &&
                m.questions?.map((q) => (
                  <div key={q.question} className="rounded-xl border bg-background p-3">
                    <p className="flex gap-2 text-sm font-medium">
                      <QuestionIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      {q.question}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5 pl-6">
                      {q.options.map((o) => (
                        <button
                          key={o}
                          type="button"
                          disabled={busy}
                          onClick={() => send(`${q.question} ${o}`)}
                          className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

              {i === lastAssistant &&
                m.suggestions
                  ?.filter((s) => !dismissed.has(s.title))
                  .map((s) => (
                    <div key={s.title} className="group/s relative rounded-xl border border-dashed bg-background p-3">
                      <p className="flex gap-2 pr-6 text-sm font-medium">
                        <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                        {s.title}
                      </p>
                      <p className="mt-1 pl-6 text-xs text-muted-foreground">{s.why}</p>
                      <div className="mt-2 pl-6">
                        <Button size="xs" disabled={busy} onClick={() => send(s.prompt)}>
                          Apply
                        </Button>
                      </div>
                      <button
                        type="button"
                        aria-label="Dismiss suggestion"
                        onClick={() => setDismissed(new Set(dismissed).add(s.title))}
                        className="absolute right-2 top-2 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  ))}
            </div>
          ),
        )}

        {busy && (
          <div role="status" className="mr-4 inline-flex items-center gap-2 rounded-xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
            <SpinnerIcon className="size-4 animate-spin" /> Working on your form
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="border-t p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border bg-background p-1.5 focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-primary/10">
          <label htmlFor="ai-input" className="sr-only">
            Message the assistant
          </label>
          <textarea
            id="ai-input"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder="e.g. Make country a searchable dropdown"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none [field-sizing:content] placeholder:text-muted-foreground/70"
          />
          <Button type="submit" size="icon" disabled={!text.trim() || busy} aria-label="Send">
            <ArrowUpIcon />
          </Button>
        </div>
      </form>
    </aside>
  );
}
