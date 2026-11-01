"use client";

import {
  DownloadIcon,
  InboxIcon,
  RefreshIcon,
  TrashIcon,
} from "@/components/shared/icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/brand";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clearResponsesAction } from "@/features/forms/actions";
import { answerText, asList } from "@/features/forms/logic";
import { type Answer, type Field, type FormDraft, isFileAnswer } from "@/features/forms/schema";
import type { ResponseDTO } from "../server/service";
import { scoreResponse } from "@/features/quiz/score";
import { ResponsesGrid } from "./responses-grid";

const COUNTED = new Set<Field["type"]>(["choice", "checkboxes", "dropdown", "scale", "rating"]);

export function ResponsesView({
  formId,
  draft,
  responses,
  csvUrl,
  sheets,
  canEdit = true,
}: { formId: string; draft: FormDraft; responses: ResponseDTO[]; csvUrl: string; sheets?: React.ReactNode; canEdit?: boolean }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const fields = draft.fields.filter((f) => f.type !== "section" && f.type !== "text" && f.type !== "video");

  if (!responses.length)
    return (
      <EmptyState
        icon={<InboxIcon />}
        title="No responses yet"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {sheets}
            <Button variant="outline" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
              <RefreshIcon className={refreshing ? "animate-spin" : ""} /> Check again
            </Button>
          </div>
        }
      >
        Use Send to share the form link. Responses appear here, and in Google Sheets once you link one.
      </EmptyState>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[22px] font-semibold">
          <span className="num">{responses.length}</span> response{responses.length === 1 ? "" : "s"}
        </h2>
        <div className="ml-auto flex flex-wrap gap-2">
          {sheets}
          <Button variant="ghost" size="sm" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
            <RefreshIcon className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button variant="outline" size="sm" render={<a href={csvUrl} download />}>
            <DownloadIcon /> CSV
          </Button>
          {canEdit && <ClearAll formId={formId} count={responses.length} onDone={() => router.refresh()} />}
        </div>
      </div>
      {responses.length >= 10_000 && (
        <p className="rounded-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">
          Showing the latest 10,000 responses. Download the CSV or link a Google Sheet for all of them.
        </p>
      )}
      <Overview responses={responses} draft={draft} />
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="table">Spreadsheet</TabsTrigger>
          <TabsTrigger value="one">Individual</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="space-y-3">
          {fields.map((f) => (
            <Summary key={f.id} f={f} responses={responses} />
          ))}
        </TabsContent>
        <TabsContent value="table">
          <ResponsesGrid fields={fields} responses={responses} />
        </TabsContent>
        <TabsContent value="one">
          <OneResponse fields={fields} responses={responses} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Summary({ f, responses }: { f: Field; responses: ResponseDTO[] }) {
  const answered = responses.filter((r) => r.answers[f.id] !== undefined);
  return (
    <section className="rounded-xl border bg-card p-5">
      <h3 className="font-medium">{f.label}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{answered.length} answered</p>
      <div className="mt-4">
        {COUNTED.has(f.type) ? <Bars f={f} answers={answered.map((r) => r.answers[f.id])} /> : f.type === "number" ? <Stats values={answered.map((r) => Number(r.answers[f.id]))} /> : <Recent f={f} answers={answered.map((r) => r.answers[f.id])} />}
      </div>
    </section>
  );
}

function Bars({ f, answers }: { f: Field; answers: (Answer | undefined)[] }) {
  const counts = new Map<string, number>();
  // Same bounds the respondent sees (field-input.tsx), so a bad max can never build a giant list.
  const lo = f.min ?? 1;
  const hi = Math.max(lo + 1, Math.min(f.max ?? 5, lo + 10));
  const order =
    f.type === "scale"
      ? Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i))
      : f.type === "rating"
        ? Array.from({ length: Math.min(Math.max(f.max ?? 5, 3), 10) }, (_, i) => String(i + 1))
        : (f.options ?? []);
  for (const o of order) counts.set(o, 0);
  for (const a of answers) for (const v of asList(a)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const total = answers.length || 1;
  const max = Math.max(1, ...counts.values());
  return (
    <ul className="space-y-2">
      {[...counts].map(([label, n]) => (
        <li key={label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate" title={label}>
            {label}
          </span>
          <span className="h-5 overflow-hidden rounded-[3px] bg-muted">
            <span className="block h-full rounded-[3px] bg-highlight transition-[width] duration-500" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="w-16 text-right tabular-nums text-muted-foreground">
            {n} · {Math.round((n / total) * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function Stats({ values }: { values: number[] }) {
  const v = values.filter(Number.isFinite);
  if (!v.length) return <p className="text-sm text-muted-foreground">No numbers yet.</p>;
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  return (
    <dl className="grid grid-cols-3 gap-3 text-center">
      {[
        ["Average", avg.toFixed(1)],
        ["Min", Math.min(...v)],
        ["Max", Math.max(...v)],
      ].map(([k, n]) => (
        <div key={k} className="rounded-md bg-muted py-3">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="num text-2xl">{n}</dd>
        </div>
      ))}
    </dl>
  );
}

function OneResponse({ fields, responses }: { fields: Field[]; responses: ResponseDTO[] }) {
  const [i, setI] = useState(0);
  const n = Math.min(i, responses.length - 1);
  const r = responses[n];
  if (!r) return null;
  const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(r.createdAt));
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="outline" size="sm" disabled={n === 0} onClick={() => setI(n - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={n >= responses.length - 1} onClick={() => setI(n + 1)}>
          Next
        </Button>
        <span className="num text-sm text-muted-foreground">
          {n + 1} of {responses.length}
        </span>
        <span className="ml-auto text-sm text-muted-foreground">{when}</span>
        <Button variant="ghost" size="sm" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <dl className="divide-y">
        {fields.map((f) => (
          <div key={f.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-6">
            <dt className="text-sm text-muted-foreground">{f.label || "Untitled"}</dt>
            <dd className="text-sm">
              <Cell f={f} a={r.answers[f.id]} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Recent({ f, answers }: { f: Field; answers: (Answer | undefined)[] }) {
  return (
    <ul className="max-h-64 space-y-1.5 overflow-y-auto">
      {answers.slice(0, 50).map((a, i) => (
        <li key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <Cell f={f} a={a} />
        </li>
      ))}
    </ul>
  );
}

function Cell({ f, a }: { f: Field; a: Answer | undefined }) {
  if (a === undefined) return <span className="text-muted-foreground">No answer</span>;
  if (isFileAnswer(a))
    return (
      <a href={`/api/files/${a.key}`} className="font-medium text-form underline-offset-4 hover:underline">
        {a.name}
      </a>
    );
  return <span className="whitespace-pre-wrap break-words">{answerText(f, a)}</span>;
}

function ClearAll({ formId, count, onDone }: { formId: string; count: number; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />}>
        <TrashIcon /> Clear
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all {count} responses?</AlertDialogTitle>
          <AlertDialogDescription>This permanently removes them from Formloom and from the live CSV feed. Rows already copied into a spreadsheet stay there.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (await clearResponsesAction(formId)) {
                  toast.success("Responses deleted");
                  onDone();
                } else toast.error("Only editors can delete responses.");
              })
            }
          >
            Delete responses
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const DAY = 864e5;
const dayFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });
const rel = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const RANGES = [7, 14, 30] as const;

/** KPI strip plus responses per day: is this form still pulling answers in? */
function Overview({ responses, draft }: { responses: ResponseDTO[]; draft: FormDraft }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(14);
  const quiz = draft.quiz?.enabled ? quizStats(draft, responses) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysFor = (n: number) => {
    const start = today.getTime() - (n - 1) * DAY;
    const days = Array.from({ length: n }, (_, i) => ({ t: start + i * DAY, n: 0 }));
    for (const r of responses) {
      const i = Math.floor((new Date(r.createdAt).getTime() - start) / DAY);
      if (i >= 0 && i < n) days[i]!.n++;
    }
    return days;
  };
  const fortnight = daysFor(14);
  const week = fortnight.slice(7).reduce((a, d) => a + d.n, 0);
  const prevWeek = fortnight.slice(0, 7).reduce((a, d) => a + d.n, 0);
  const days = daysFor(range);
  const latest = responses[0] ? new Date(responses[0].createdAt).getTime() : null;
  const mins = latest ? Math.round((latest - Date.now()) / 6e4) : 0;
  const ago = latest === null ? "None yet" : Math.abs(mins) < 60 ? rel.format(mins, "minute") : Math.abs(mins) < 1440 ? rel.format(Math.round(mins / 60), "hour") : rel.format(Math.round(mins / 1440), "day");
  // A round axis top above the busiest day, so gridlines land on whole numbers.
  const peak = Math.max(...days.map((d) => d.n));
  const top = Math.max(2, peak % 2 ? peak + 1 : peak);
  const delta = week - prevWeek;
  return (
    <section aria-label="Overview" className="rounded-xl border bg-card">
      <dl className={quiz ? "grid grid-cols-2 divide-x border-b sm:grid-cols-4 max-sm:[&>div:nth-child(3)]:border-l-0 max-sm:[&>div:nth-child(n+3)]:border-t" : "grid grid-cols-3 divide-x border-b"}>
        <div className="px-5 py-4">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="num mt-1 text-[28px] leading-none">{responses.length}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-xs text-muted-foreground">Last 7 days</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="num text-[28px] leading-none">{week}</span>
            <span className="num text-xs text-muted-foreground">{delta === 0 ? "same as the week before" : `${delta > 0 ? "+" : ""}${delta} vs week before`}</span>
          </dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-xs text-muted-foreground">Latest</dt>
          <dd className="mt-1 text-lg leading-[28px]">{ago}</dd>
        </div>
        {quiz && (
          <div className="px-5 py-4">
            <dt className="text-xs text-muted-foreground">Average score</dt>
            <dd className="mt-1 flex items-baseline gap-1.5">
              <span className="num text-[28px] leading-none">{quiz.avg.toFixed(1)}</span>
              <span className="num text-xs text-muted-foreground">of {quiz.max}</span>
            </dd>
          </div>
        )}
      </dl>
      <figure className="px-5 pb-4 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <figcaption className="text-sm font-medium">Responses per day</figcaption>
          <div role="radiogroup" aria-label="Range" className="flex rounded-md border p-0.5 text-xs">
            {RANGES.map((r) => (
              // biome-ignore lint/a11y/useSemanticElements: compact segmented control
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={range === r}
                onClick={() => setRange(r)}
                className={range === r ? "rounded-[5px] bg-primary px-2.5 py-1 font-medium text-primary-foreground" : "rounded-[5px] px-2.5 py-1 text-muted-foreground hover:text-foreground"}
              >
                {r} days
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <div className="num flex h-32 flex-col justify-between text-right text-[11px] text-muted-foreground" aria-hidden>
            <span>{top}</span>
            <span>{top / 2}</span>
            <span>0</span>
          </div>
          <div className="relative h-32 [overflow-x:clip] [overflow-y:visible]">
            {[0, 50, 100].map((y) => (
              <div key={y} className="absolute inset-x-0 border-t border-border" style={{ top: `${y}%` }} aria-hidden />
            ))}
            <ol className="relative flex h-full items-end gap-[3px]" aria-label={`Responses per day, last ${range} days`}>
              {days.map((d, i) => {
                const label = `${dayFmt.format(d.t)}: ${d.n} response${d.n === 1 ? "" : "s"}`;
                return (
                  <li key={d.t} className="group/bar relative flex h-full flex-1 flex-col justify-end">
                    <button type="button" aria-label={label} className="peer flex h-full w-full flex-col justify-end rounded-t-[2px] outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span
                        className={i === days.length - 1 ? "block w-full rounded-t-[2px] bg-support" : "block w-full rounded-t-[2px] bg-highlight group-hover/bar:opacity-80"}
                        style={{ height: d.n ? `${(d.n / top) * 100}%` : "1px" }}
                      />
                    </button>
                    <span
                      className={`num pointer-events-none absolute -top-6 z-10 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] text-background opacity-0 transition-opacity group-hover/bar:opacity-100 peer-focus:opacity-100 ${
                        // Keep the label inside the chart: edge bars anchor it inward instead of centring it.
                        i < days.length / 4 ? "left-0" : i > (days.length * 3) / 4 ? "right-0" : "left-1/2 -translate-x-1/2"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <div className="mt-2 flex justify-between pl-6 text-[11px] text-muted-foreground">
          <span>{dayFmt.format(days[0]!.t)}</span>
          <span>Today</span>
        </div>
      </figure>
    </section>
  );
}

function quizStats(draft: FormDraft, responses: ResponseDTO[]) {
  if (!responses.length) return null;
  let total = 0;
  let max = 0;
  for (const r of responses) {
    const s = scoreResponse(draft.fields, r.answers);
    total += s.score;
    max = Math.max(max, s.max);
  }
  return { avg: total / responses.length, max };
}
