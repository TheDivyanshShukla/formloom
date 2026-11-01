"use client";

import {
  ArrowUpIcon,
  FilePlusIcon,
  SpinnerIcon,
} from "@/components/shared/icons";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createFormAction } from "../actions";

const TEMPLATES = [
  { label: "Lead capture", prompt: "Demo request form for our B2B software: work email, company, team size, budget range, use case. Ask about integrations only for teams over 50 people." },
  { label: "Customer NPS", prompt: "Quarterly NPS survey: 0-10 likelihood to recommend, then ask what we could improve only if the score is 6 or below, and what they love if 9 or 10." },
  { label: "Job application", prompt: "Job application for a product designer: contact details, portfolio link, years of experience, notice period, expected salary, CV upload as PDF." },
  { label: "Event registration", prompt: "Registration for a 300-person conference: ticket type, company, job title, dietary needs, t-shirt size, and workshop choices." },
  { label: "Employee onboarding", prompt: "New employee onboarding: personal details, PAN, bank account and IFSC, emergency contact, ID proof upload, laptop preference." },
  { label: "Support request", prompt: "IT support request: name, department, issue category, urgency, description, screenshot upload, best time to reach them." },
  { label: "Vendor onboarding", prompt: "Vendor onboarding: company name, GSTIN, contact person, bank details, services offered, upload of cancelled cheque." },
  { label: "Class feedback", prompt: "End-of-course feedback: rate the instructor, pace and material on 1-5, what to keep, what to change. Anonymous." },
];

const STEPS = ["Reading your request", "Choosing question types", "Writing validation rules", "Adding conditional logic", "Testing example answers"];

export function Composer() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Prefill from the landing page's create dialog (carried through sign-up as ?prompt=).
  useEffect(() => {
    const p = new URLSearchParams(location.search).get("prompt");
    if (p) setPrompt(p.slice(0, 4000));
  }, []);

  useEffect(() => {
    if (!pending) return setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2600);
    return () => clearInterval(t);
  }, [pending]);

  const create = (text: string) =>
    start(async () => {
      const res = await createFormAction(text);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.seed) {
        try {
          sessionStorage.setItem(`formloom:seed:${res.id}`, JSON.stringify(res.seed));
        } catch {}
      }
      router.push(`/forms/${res.id}`);
    });

  return (
    <div className="mt-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (prompt.trim()) create(prompt);
        }}
        className={cn(
          "relative overflow-hidden rounded-xl border border-input bg-card transition-[border-color,box-shadow] duration-150 focus-within:border-foreground/50",
          pending && "pointer-events-none",
        )}
      >
        <label htmlFor="prompt" className="sr-only">
          Describe your form
        </label>
        <textarea
          ref={ref}
          id="prompt"
          rows={3}
          value={prompt}
          disabled={pending}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim()) create(prompt);
          }}
          placeholder="e.g. Client intake form for my design studio: budget, timeline, project type, and a file upload for references"
          className="block w-full resize-none bg-transparent px-5 pt-4 pb-14 text-base outline-none placeholder:text-muted-foreground/70"
        />
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => create("")} className="text-muted-foreground">
            <FilePlusIcon /> Blank form
          </Button>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">⌘ Enter to generate</span>
          <Button type="submit" size="icon-lg" disabled={!prompt.trim() || pending} aria-label="Generate form" className="rounded-xl">
            {pending ? <SpinnerIcon className="animate-spin" /> : <ArrowUpIcon />}
          </Button>
        </div>
      </form>

      <div className="mt-3 flex min-h-8 flex-wrap items-center gap-1.5" aria-live="polite">
        {pending ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <SpinnerIcon className="size-4 animate-spin" />
            {STEPS[step]}…
          </p>
        ) : (
          <>
          <span className="mr-1 text-sm text-muted-foreground">Try:</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                setPrompt(t.prompt);
                ref.current?.focus();
              }}
              className="h-8 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t.label}
            </button>
          ))}
          </>
        )}
      </div>
    </div>
  );
}
