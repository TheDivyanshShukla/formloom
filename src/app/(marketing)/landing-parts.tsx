"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, SheetIcon, SparkleIcon, XIcon } from "@/components/shared/icons";
import { fieldError } from "@/features/forms/logic";
import type { Field } from "@/features/forms/schema";
import { cn } from "@/lib/utils";

/** Index of the [data-stage] element nearest the viewport's middle; drives the photo stage and the steps. */
function useActive(selector: string) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>(selector)];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index ?? 0));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [selector]);
  return active;
}

export type StagePhoto = { src: string; alt: string; caption: string };

/** The fixed half: one photograph per section of the reading column, crossfading as each section reaches the middle. */
export function PhotoStage({ photos }: { photos: StagePhoto[] }) {
  const active = useActive("[data-stage]");
  return (
    <figure className="relative h-full overflow-hidden rounded-lg bg-[#2a2016]">
      {photos.map((p, i) => (
        // biome-ignore lint/performance/noImgElement: static files in /public, sized by the stage.
        <img
          key={p.src}
          src={p.src}
          alt={p.alt}
          width={1050}
          height={1400}
          loading={i === 0 ? "eager" : "lazy"}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-[1600ms] ease-in-out motion-reduce:duration-0",
            i === active ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <figcaption className="absolute bottom-12 left-3 right-3 w-fit lg:bottom-3 rounded-md bg-black/70 px-3 py-2 text-sm text-white">
        {photos[active]?.caption}
      </figcaption>
    </figure>
  );
}

type Rule = { name: string; field: Field; sample: string };
const RULES: Rule[] = [
  {
    name: "GSTIN",
    sample: "27aapfu0939f",
    field: {
      id: "gstin",
      type: "short",
      label: "GSTIN",
      required: true,
      pattern: "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]",
      patternMessage: "15 characters, like 27AAPFU0939F1ZV",
    },
  },
  {
    name: "Work email",
    sample: "ada@gmail.com",
    field: {
      id: "work",
      type: "email",
      label: "Work email",
      required: true,
      pattern: "(?!.*@(gmail|yahoo|hotmail|outlook)\\.)[^\\s@]+@[^\\s@]+\\.[^\\s@]+",
      patternMessage: "A work address, not Gmail, Yahoo, Hotmail or Outlook",
    },
  },
  {
    name: "Order ID",
    sample: "ORD-10423",
    field: { id: "order", type: "short", label: "Order ID", required: true, pattern: "ORD-[0-9]{6}", patternMessage: "ORD- and six digits, like ORD-104233" },
  },
];

/** The live thing: the builder's own validator, run on whatever the visitor types. */
export function RuleTester() {
  const [i, setI] = useState(0);
  const [value, setValue] = useState(RULES[0]?.sample ?? "");
  const rule = RULES[i] as Rule;
  const error = fieldError(rule.field, value);
  return (
    <div data-ui className="rounded-lg border bg-card p-5">
      <div role="tablist" aria-label="Rule" className="flex gap-6 text-base">
        {RULES.map((r, n) => (
          <button
            key={r.name}
            type="button"
            role="tab"
            aria-selected={n === i}
            onClick={() => {
              setI(n);
              setValue(r.sample);
            }}
            className={cn(
              "border-b-2 pb-1 transition-colors duration-150",
              n === i ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {r.name}
          </button>
        ))}
      </div>
      <label htmlFor="rule-try" className="mt-6 block text-base font-semibold">
        {rule.field.label}
      </label>
      <input
        id="rule-try"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        autoCapitalize="characters"
        autoComplete="off"
        aria-describedby="rule-verdict"
        aria-invalid={!!error}
        className={cn(
          "mt-2 h-12 w-full rounded-lg border bg-background px-3.5 text-base tabular-nums outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/40",
          error ? "border-destructive" : "border-success",
        )}
      />
      <p id="rule-verdict" aria-live="polite" className={cn("mt-2 flex items-center gap-1.5 text-sm font-medium", error ? "text-destructive" : "text-success")}>
        {error ? <XIcon className="size-4" /> : <CheckIcon className="size-4" />}
        {error ?? "Accepted"}
      </p>
      <dl className="mt-5 grid grid-cols-[5rem_minmax(0,1fr)] gap-y-2 rounded-lg bg-muted px-4 py-3 text-sm">
        <dt className="text-muted-foreground">Pattern</dt>
        <dd className="truncate" title={rule.field.pattern}>
          <code>{rule.field.pattern}</code>
        </dd>
        <dt className="text-muted-foreground">Required</dt>
        <dd>Yes</dd>
      </dl>
    </div>
  );
}

const STEPS = [
  ["First, say what you need.", "One sentence is enough. Paste the brief your manager sent if you have it."],
  ["Then it asks back.", "Where it had to guess, it says so and offers one-click answers. Every rule comes with answers that pass and fail."],
  ["Share it and watch it fill.", "A public link, a QR code or an embed. Answers arrive in a spreadsheet you can sort, filter and send to Google Sheets."],
] as const;

/** How it works: three statements on the left; the pinned fragment on the right changes to match the one in view. */
export function Steps() {
  const active = useActive("[data-step]");
  return (
    <div className="grid gap-x-16 lg:grid-cols-[5fr_7fr]">
      <div className="sticky top-[14vh] order-2 hidden self-start lg:block">
        <StepFragment step={active} />
      </div>
      <ol className="lg:order-1">
        {STEPS.map(([t, d], n) => (
          <li key={t} data-step data-index={n} className="flex flex-col justify-center py-12 lg:min-h-[56vh] lg:py-0 lg:last:min-h-[44vh]">
            <p className={cn("text-[26px] font-semibold leading-tight tracking-[-0.02em] transition-colors duration-300", n === active ? "text-foreground" : "text-foreground lg:text-muted-foreground")}>
              {t}
            </p>
            <p className="mt-3 max-w-[40ch] text-base leading-relaxed text-muted-foreground">{d}</p>
            <div className="mt-6 lg:hidden">
              <StepFragment step={n} flow />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const ROWS = [
  ["10:42", "Kavya Traders", "27AAPFU0939F1ZV", "Packaging"],
  ["10:17", "Ostrava Metal s.r.o.", "N/A, outside India", "Fasteners"],
  ["09:58", "Brightline Print Co.", "29ABCDE1234F1Z5", "Print"],
  ["09:31", "Mehta & Sons", "24AAACM4521K1Z2", "Logistics"],
];

function StepFragment({ step, flow }: { step: number; flow?: boolean }) {
  return (
    <div data-ui className={cn("relative mx-auto w-full max-w-[520px] overflow-hidden rounded-lg border bg-card", flow ? "" : "h-full lg:h-[520px]")}>
      <Pane on={step === 0} flow={flow}>
        <p className="text-sm text-muted-foreground">New form</p>
        <div className="mt-3 rounded-lg border bg-background p-4 text-base leading-relaxed">
          Vendor onboarding: company name, GSTIN, contact person, bank details, services offered, and a cancelled cheque upload.
          <span className="ml-0.5 inline-block h-5 w-px translate-y-1 bg-foreground" />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Enter to build</span>
          <span className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Build form</span>
        </div>
      </Pane>
      <Pane on={step === 1} flow={flow}>
        <p className="flex items-center gap-2 text-sm font-medium">
          <SparkleIcon className="size-4 text-support" /> Two questions before you share
        </p>
        <div className="mt-3 rounded-lg bg-muted p-4">
          <p className="text-sm">Do some vendors sit outside India? I can make GSTIN optional for them.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg border-2 border-foreground bg-card px-3 py-1.5 font-medium">Yes, add a country question</span>
            <span className="rounded-lg border bg-card px-3 py-1.5">No, India only</span>
          </div>
        </div>
        <ul className="mt-4 divide-y rounded-lg border text-sm">
          {["Company name", "Country", "GSTIN, only if India", "Bank account and IFSC", "Cancelled cheque (PDF or JPG)"].map((q, n) => (
            <li key={q} className={cn("flex h-11 items-center justify-between px-4", n === 1 || n === 2 ? "bg-pop/40 font-medium" : "")}>
              {q}
              {(n === 1 || n === 2) && <span className="text-sm text-muted-foreground">new</span>}
            </li>
          ))}
        </ul>
      </Pane>
      <Pane on={step === 2} flow={flow}>
        <div className="flex items-baseline justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <SheetIcon className="size-4 text-highlight" /> Vendor onboarding
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="num text-base text-foreground">126</span> responses
          </p>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border text-sm">
          <div className="grid grid-cols-[3rem_1.2fr_1.3fr_0.8fr] bg-muted px-3 py-2 font-medium text-muted-foreground">
            <span>Time</span>
            <span>Company</span>
            <span>GSTIN</span>
            <span>Services</span>
          </div>
          {ROWS.map((r, n) => (
            <div key={r[1]} className={cn("grid grid-cols-[3rem_1.2fr_1.3fr_0.8fr] border-t px-3 py-2.5", n === 0 && "bg-pop/40")}>
              <span className="num text-muted-foreground">{r[0]}</span>
              <span className="truncate pr-2">{r[1]}</span>
              <span className="truncate pr-2 tabular-nums">{r[2]}</span>
              <span className="truncate">{r[3]}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Synced to Google Sheets 40 seconds ago</p>
      </Pane>
    </div>
  );
}

function Pane({ on, flow, children }: { on: boolean; flow?: boolean; children: React.ReactNode }) {
  if (flow) return on ? <div className="p-5 sm:p-6">{children}</div> : null;
  return (
    <div
      aria-hidden={!on}
      className={cn(
        "absolute inset-0 p-5 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-opacity sm:p-6",
        on ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      {children}
    </div>
  );
}

const STARTS = {
  "Vendor onboarding": "Vendor onboarding: company name, GSTIN, contact person, bank details, services offered, and a cancelled cheque upload.",
  "Customer survey": "Quarterly customer survey: 0 to 10 likelihood to recommend, and ask what we could improve only if the score is 6 or below.",
} as const;

/** The product's create dialog, already open. The button opens the composer with this sentence; sign-in keeps the query. */
export function StartDialog() {
  const [kind, setKind] = useState<keyof typeof STARTS>("Vendor onboarding");
  const [text, setText] = useState<string>(STARTS[kind]);
  const ref = useRef<HTMLTextAreaElement>(null);
  const next = `/forms?prompt=${encodeURIComponent(text.trim().slice(0, 1000))}`;
  return (
    <div data-ui className="w-full max-w-[440px] rounded-lg bg-popover p-6 text-popover-foreground shadow-2xl shadow-black/30">
      <p className="text-base font-semibold">New form</p>
      <fieldset className="mt-4 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
        <legend className="sr-only">Start from</legend>
        {(Object.keys(STARTS) as (keyof typeof STARTS)[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === kind}
            onClick={() => {
              setKind(k);
              setText(STARTS[k]);
              ref.current?.focus();
            }}
            className={cn("h-10 rounded-md transition-colors duration-150", k === kind ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {k}
          </button>
        ))}
      </fieldset>
      <label htmlFor="start-text" className="mt-5 block text-sm font-medium">
        Describe the form
      </label>
      <textarea
        id="start-text"
        ref={ref}
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-2 w-full resize-none rounded-lg border bg-background px-3.5 py-3 text-base leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      />
      <Link
        href={next}
        className="mt-4 flex h-13 items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground transition-transform duration-100 active:scale-[0.97]"
      >
        Build this form
      </Link>
    </div>
  );
}

/** The 1804 loom's clip: plays muted while on screen, shows its poster under reduced motion. */
export function LoomClip() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? v.play().catch(() => {}) : v.pause()));
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="metadata"
      poster="/loom/metier-a-tisser-jacquard-01-poster.jpg"
      width={854}
      height={480}
      aria-label="A Jacquard loom at work, its chain of punched cards turning over the top"
      className="aspect-video w-full rounded-lg bg-muted object-cover"
    >
      <source src="/loom/metier-a-tisser-jacquard-01.webm" type="video/webm" />
    </video>
  );
}
