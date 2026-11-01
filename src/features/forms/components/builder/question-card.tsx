"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckIcon,
  CopyIcon,
  GripIcon,
  LogicIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
  WarningIcon,
  XIcon,
  TYPE_ICONS,
} from "@/components/shared/icons";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fieldError } from "../../logic";
import { CONDITION_OPS, type Field, FIELD_TYPES, GRADABLE, HAS_OPTIONS, IS_GRID, TEXTUAL, TYPE_LABELS } from "../../schema";
import { FieldInput } from "../field-input";

const TYPE_ITEMS = FIELD_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }));
const OP_LABELS: Record<(typeof CONDITION_OPS)[number], string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  answered: "is answered",
  gt: "is greater than",
  lt: "is less than",
};
const OP_ITEMS = CONDITION_OPS.map((o) => ({ value: o, label: OP_LABELS[o] }));

type Props = {
  field: Field;
  index: number;
  earlier: Field[];
  /** Every section in the form, so a choice can jump to one. */
  sections: { id: string; label: string }[];
  active: boolean;
  onActivate: (id: string) => void;
  onChange: (id: string, patch: Partial<Field>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Form is a quiz: gradable questions get an answer key editor. */
  quiz?: boolean;
};

/** Strip undefined so cleared settings disappear from the JSON instead of lingering as null-ish keys. */
const clean = (f: Field): Field => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as Field;

export const QuestionCard = memo(function QuestionCard(p: Props) {
  const { field: f } = p;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const set = (patch: Partial<Field>) => p.onChange(f.id, patch);
  const section = f.type === "section";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/card relative rounded-xl border bg-card transition-[border-color,box-shadow] duration-150",
        p.active ? "border-foreground/70" : "hover:border-input",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder question ${p.index + 1}`}
        className="absolute left-1/2 top-0 flex h-5 w-12 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-b-md text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/card:opacity-100 active:cursor-grabbing"
      >
        <GripIcon className="size-4 rotate-90" />
      </button>

      {p.active ? (
        <Editor {...p} set={set} />
      ) : (
        // biome-ignore lint/a11y/useSemanticElements: card contains inputs, so it cannot be a <button>
        <div
          role="button"
          tabIndex={0}
          onClick={() => p.onActivate(f.id)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
              e.preventDefault();
              p.onActivate(f.id);
            }
          }}
          aria-label={`Edit: ${f.label}`}
          className="cursor-pointer rounded-xl px-5 pb-4 pt-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="mb-4 flex items-center gap-3">
            <TypeTile type={f.type} />
            <h3 className={cn("min-w-0 flex-1 truncate font-semibold", section ? "text-lg" : "text-base")}>{f.label || "Untitled"}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">{section ? "Section" : f.required ? "Required" : "Optional"}</span>
          </div>
          {section ? (
            f.description && <p className="text-sm text-muted-foreground">{f.description}</p>
          ) : (
            <div className="pointer-events-none [&_[data-field]>div:first-child]:hidden" inert>
              <FieldInput field={f} value={undefined} onChange={() => {}} preview />
            </div>
          )}
          <RuleWell f={f} earlier={p.earlier} quiz={p.quiz} />
        </div>
      )}
    </div>
  );
});

function TypeTile({ type }: { type: Field["type"] }) {
  const I = TYPE_ICONS[type];
  return (
    <span className="shrink-0 text-muted-foreground" title={TYPE_LABELS[type]}>
      <I className="size-[18px]" />
      <span className="sr-only">{TYPE_LABELS[type]}</span>
    </span>
  );
}

/** Key-value well of everything that governs the answer: the product's rules, readable at a glance. */
function RuleWell({ f, earlier, quiz }: { f: Field; earlier: Field[]; quiz?: boolean }) {
  const src = f.showIf && earlier.find((e) => e.id === f.showIf?.field);
  const g = { ...f, required: false };
  const rows: [string, React.ReactNode, "ok" | "bad" | "warn" | null][] = [];
  if (src && f.showIf)
    rows.push(["Shown when", `${src.label} ${OP_LABELS[f.showIf.op]}${f.showIf.op === "answered" ? "" : ` ${f.showIf.value}`}`, null]);
  if (f.pattern) rows.push(["Pattern", <code key="p">{f.pattern}</code>, null]);
  if (TEXTUAL.has(f.type) && (f.min !== undefined || f.max !== undefined)) {
    const unit = f.type === "number" ? "" : " characters";
    const text = f.min === undefined ? `up to ${f.max}${unit}` : f.max === undefined ? `at least ${f.min}${unit}` : `${f.min} to ${f.max}${unit}`;
    rows.push([f.type === "number" ? "Range" : "Length", <span key="r" className="num">{text}</span>, null]);
  }
  if (f.type === "checkboxes" && (f.min !== undefined || f.max !== undefined))
    rows.push(["Picks", <span key="k" className="num">{f.max === undefined ? `at least ${f.min}` : `${f.min ?? 0} to ${f.max}`}</span>, null]);
  if (f.searchable) rows.push(["Search", "Type to filter the list", null]);
  if (quiz && GRADABLE.has(f.type))
    rows.push([
      "Answer key",
      f.answerKey?.correct.length ? `${f.answerKey.correct.join(", ")} · ${f.answerKey.points || 1} pt${(f.answerKey.points || 1) === 1 ? "" : "s"}` : "Not set",
      f.answerKey?.correct.length ? null : "warn",
    ]);
  for (const v of f.examples?.valid ?? []) rows.push(["Accepts", <code key={`a${v}`}>{v}</code>, fieldError(g, v) === null ? "ok" : "warn"]);
  for (const v of f.examples?.invalid ?? []) rows.push(["Rejects", <code key={`r${v}`}>{v}</code>, fieldError(g, v) !== null ? "bad" : "warn"]);
  if (!rows.length) return null;
  return (
    <dl className="mt-4 divide-y divide-border rounded-md bg-muted px-3 text-[13px]">
      {rows.map(([k, v, mark], i) => (
        <div key={i} className="flex h-8 items-center gap-3">
          <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
          <dd className="min-w-0 flex-1 truncate [&_code]:font-mono">{v}</dd>
          {mark === "ok" && <CheckIcon className="size-3.5 shrink-0 text-success" aria-label="passes" />}
          {mark === "bad" && <XIcon className="size-3.5 shrink-0 text-destructive" aria-label="fails as expected" />}
          {mark === "warn" && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-warning">
              <WarningIcon className="size-3.5" /> {k === "Answer key" ? "Needs an answer" : "Rule disagrees"}
            </span>
          )}
        </div>
      ))}
    </dl>
  );
}

function Editor(p: Props & { set: (patch: Partial<Field>) => void }) {
  const { field: f, set } = p;
  const section = f.type === "section";
  return (
    <div className="space-y-5 px-6 pb-4 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          autoFocus
          aria-label="Question"
          value={f.label}
          onChange={(e) => set({ label: e.target.value })}
          placeholder={section ? "Section title" : "Question"}
          className={cn("h-12 flex-1 bg-muted/50 text-base", section && "text-lg font-semibold")}
        />
        <Select
          items={TYPE_ITEMS}
          value={f.type}
          onValueChange={(t) => {
            if (!t) return;
            const type = t as Field["type"];
            const grid = IS_GRID.has(type);
            set({
              type,
              options: HAS_OPTIONS.has(type) ? (f.options?.length ? f.options : ["Option 1"]) : grid ? (f.options?.length ? f.options : ["Row 1", "Row 2"]) : undefined,
              columns: grid ? (f.columns?.length ? f.columns : ["Column 1", "Column 2"]) : undefined,
              goTo: type === "choice" || type === "dropdown" ? f.goTo : undefined,
              ...(TEXTUAL.has(type) ? {} : { pattern: undefined, patternMessage: undefined, examples: undefined }),
              searchable: type === "dropdown" ? f.searchable : undefined,
            });
          }}
        >
          <SelectTrigger aria-label="Question type" className="h-12 w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_ITEMS.map((t) => {
              const I = TYPE_ICONS[t.value];
              return (
                <SelectItem key={t.value} value={t.value}>
                  <I className="text-muted-foreground" /> {t.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      {f.type === "video" && (
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Video URL</span>
          <Input
            value={f.placeholder ?? ""}
            placeholder="https://www.youtube.com/watch?v=…"
            onChange={(e) => set({ placeholder: e.target.value.trim() || undefined })}
          />
        </label>
      )}
      {(f.type === "text" || (!section && f.type !== "video")) && (
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Image URL</span>
          <Input
            value={f.image ?? ""}
            placeholder="https://"
            onChange={(e) => set({ image: e.target.value.trim() || undefined })}
          />
        </label>
      )}
      <Input
        aria-label="Description"
        value={f.description ?? ""}
        onChange={(e) => set({ description: e.target.value || undefined })}
        placeholder="Description (optional)"
        className="border-transparent bg-transparent px-0 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0"
      />

      {HAS_OPTIONS.has(f.type) && <OptionsEditor f={f} set={set} sections={p.sections} />}
      {IS_GRID.has(f.type) && <GridEditor f={f} set={set} />}
      {f.type === "scale" && <ScaleEditor f={f} set={set} />}
      {f.type === "rating" && (
        <NumberRow label="Stars" value={f.max ?? 5} min={3} max={10} onChange={(v) => set({ max: v })} />
      )}
      {f.type === "file" && <FileEditor f={f} set={set} />}
      {p.quiz && GRADABLE.has(f.type) && <AnswerKeyEditor f={f} set={set} />}
      {(TEXTUAL.has(f.type) || f.type === "checkboxes") && <ValidationEditor f={f} set={set} />}
      <LogicEditor f={f} earlier={p.earlier} set={set} />

      <div className="-mx-6 flex flex-wrap items-center gap-1 border-t px-4 pt-3">
        {f.type === "dropdown" && (
          <label className="mr-3 flex items-center gap-2 text-sm">
            <Switch size="sm" checked={Boolean(f.searchable)} onCheckedChange={(c) => set({ searchable: c || undefined })} />
            Searchable
          </label>
        )}
        <span className="flex-1" />
        <IconAction label="Duplicate" onClick={() => p.onDuplicate(f.id)}>
          <CopyIcon />
        </IconAction>
        <IconAction label="Delete" onClick={() => p.onDelete(f.id)}>
          <TrashIcon />
        </IconAction>
        {!section && f.type !== "text" && f.type !== "video" && (
          <label className="ml-2 flex items-center gap-2 border-l pl-4 text-sm">
            Required
            <Switch checked={f.required} onCheckedChange={(c) => set({ required: c })} />
          </label>
        )}
      </div>
    </div>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function OptionsEditor({ f, set, sections }: { f: Field; set: (p: Partial<Field>) => void; sections: { id: string; label: string }[] }) {
  const opts = f.options ?? [];
  const jumps = sections.length > 0 && (f.type === "choice" || f.type === "dropdown");
  const update = (next: string[]) => {
    if (!f.goTo) return set({ options: next });
    const goTo = { ...f.goTo };
    opts.forEach((old, i) => {
      const neu = next[i];
      if (old !== neu && goTo[old] && neu) {
        goTo[neu] = goTo[old];
        delete goTo[old];
      }
    });
    set({ options: next, goTo });
  };
  const marker = f.type === "checkboxes" ? "rounded-[4px]" : "rounded-full";
  return (
    <div data-options className="space-y-1">
      {opts.map((o, i) => (
        <div key={i} className="group/opt flex items-center gap-3">
          {f.type === "dropdown" ? (
            <span className="w-5 text-right text-sm tabular-nums text-muted-foreground">{i + 1}.</span>
          ) : (
            <span className={cn("size-[18px] shrink-0 border-2 border-muted-foreground/40", marker)} />
          )}
          <input
            aria-label={`Option ${i + 1}`}
            value={o}
            onChange={(e) => update(opts.map((x, j) => (j === i ? e.target.value : x)))}
            onPaste={(e) => {
              // Paste a list (one per line) to fill many options at once.
              const lines = e.clipboardData.getData("text").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              if (lines.length < 2) return;
              e.preventDefault();
              update([...opts.slice(0, i), ...lines, ...opts.slice(i + 1)].filter((x, j, a) => x && a.indexOf(x) === j));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const list = e.currentTarget.closest("[data-options]");
                update([...opts.slice(0, i + 1), "", ...opts.slice(i + 1)]);
                requestAnimationFrame(() => {
                  const inputs = list?.querySelectorAll("input");
                  (inputs?.[i + 1] as HTMLInputElement | undefined)?.focus();
                });
              }
              if (e.key === "Backspace" && o === "" && opts.length > 1) {
                e.preventDefault();
                update(opts.filter((_, j) => j !== i));
              }
            }}
            className={cn(
              "h-10 flex-1 border-b border-transparent bg-transparent text-[15px] outline-none hover:border-border focus:border-foreground/60",
              opts.indexOf(o) !== i && "text-destructive",
            )}
          />
          {jumps && (
            <select
              aria-label={`After “${o || `option ${i + 1}`}”, go to`}
              value={f.goTo?.[o] ?? ""}
              onChange={(e) => {
                const goTo = { ...f.goTo };
                if (e.target.value) goTo[o] = e.target.value;
                else delete goTo[o];
                set({ goTo: Object.keys(goTo).length ? goTo : undefined });
              }}
              className="h-8 max-w-36 shrink-0 rounded-md border bg-card px-2 text-xs text-muted-foreground"
            >
              <option value="">Continue</option>
              <option value="submit">Submit form</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove option ${i + 1}`}
            disabled={opts.length <= 1}
            onClick={() => update(opts.filter((_, j) => j !== i))}
            className="opacity-0 group-hover/opt:opacity-100 focus-visible:opacity-100"
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-8 pt-1 text-sm">
        <button type="button" onClick={() => update([...opts, `Option ${opts.length + 1}`])} className="inline-flex h-9 items-center gap-1.5 font-medium hover:underline">
          <PlusIcon className="size-4" /> Add option
        </button>
        {f.type !== "dropdown" && !f.other && (
          <>
            <span className="text-muted-foreground">or</span>
            <button type="button" onClick={() => set({ other: true })} className="h-9 font-medium hover:underline">
              add “Other”
            </button>
          </>
        )}
        {f.other && (
          <button type="button" onClick={() => set({ other: undefined })} className="h-9 text-muted-foreground hover:text-foreground">
            Remove “Other”
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">Tip: paste a list to add many</span>
      </div>
    </div>
  );
}

function GridEditor({ f, set }: { f: Field; set: (p: Partial<Field>) => void }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium">Rows</p>
        <OptionsEditor f={{ ...f, type: "dropdown", options: f.options }} set={(p) => set({ options: p.options })} sections={[]} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Columns</p>
        <OptionsEditor f={{ ...f, type: "dropdown", options: f.columns ?? [] }} set={(p) => set({ columns: p.options })} sections={[]} />
      </div>
    </div>
  );
}

function NumberRow({ label, value, min, max, onChange }: { label: string; value: number | undefined; min?: number; max?: number; onChange: (v: number | undefined) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 text-muted-foreground">{label}</span>
      <Input
        type="number"
        className="h-9 w-24"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </label>
  );
}

function ScaleEditor({ f, set }: { f: Field; set: (p: Partial<Field>) => void }) {
  const [low = "", high = ""] = f.options ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberRow label="From" value={f.min ?? 1} min={0} max={1} onChange={(v) => set({ min: v })} />
      <NumberRow label="To" value={f.max ?? 5} min={2} max={10} onChange={(v) => set({ max: v })} />
      <Input value={low} onChange={(e) => set({ options: [e.target.value, high] })} placeholder="Low label, e.g. Poor" className="h-9" />
      <Input value={high} onChange={(e) => set({ options: [low, e.target.value] })} placeholder="High label, e.g. Excellent" className="h-9" />
    </div>
  );
}

function FileEditor({ f, set }: { f: Field; set: (p: Partial<Field>) => void }) {
  const [text, setText] = useState((f.options ?? []).join(", "));
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <Input
        aria-label="Allowed file types"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const exts = text
            .split(/[\s,]+/)
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean)
            .map((x) => (x.startsWith(".") ? x : `.${x}`));
          set({ options: exts.length ? exts : undefined });
          setText(exts.join(", "));
        }}
        placeholder="Allowed types, e.g. .pdf, .jpg (empty = any)"
        className="h-9"
      />
      <NumberRow label="Max MB" value={f.max ?? 10} min={1} max={25} onChange={(v) => set({ max: v })} />
    </div>
  );
}

/** Quiz answer key: pick correct options, or list accepted answers for text and numbers. */
function AnswerKeyEditor({ f, set }: { f: Field; set: (p: Partial<Field>) => void }) {
  const key = f.answerKey ?? { correct: [], points: 1 };
  const put = (patch: Partial<NonNullable<Field["answerKey"]>>) => set({ answerKey: { ...key, ...patch } });
  const multi = f.type === "checkboxes";
  const [text, setText] = useState(key.correct.join(", "));
  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <CheckIcon className="size-4 text-muted-foreground" /> Answer key
        </p>
        <span className="flex-1" />
        <NumberRow label="Points" value={key.points} min={0} max={100} onChange={(v) => put({ points: v ?? 1 })} />
      </div>
      {HAS_OPTIONS.has(f.type) ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{multi ? "Tick every option that must be selected" : "Choose the correct answer"}</p>
          <div className="flex flex-wrap gap-1.5">
            {(f.options ?? []).filter(Boolean).map((o) => {
              const on = key.correct.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={on}
                  onClick={() => put({ correct: multi ? (on ? key.correct.filter((c) => c !== o) : [...key.correct, o]) : on ? [] : [o] })}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors",
                    on ? "border-success/40 bg-success/10 font-medium text-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  {on && <CheckIcon className="size-3.5 text-success" />}
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <Input
          aria-label="Accepted answers"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => put({ correct: text.split(",").map((x) => x.trim()).filter(Boolean) })}
          placeholder={f.type === "number" ? "Correct number, e.g. 42" : "Accepted answers, separated by commas"}
          className="h-9"
        />
      )}
      <Input
        aria-label="Feedback shown after grading"
        value={key.feedback ?? ""}
        onChange={(e) => put({ feedback: e.target.value || undefined })}
        placeholder="Feedback shown after grading (optional)"
        className="h-9"
      />
    </div>
  );
}

function ValidationEditor({ f, set }: { f: Field; set: (p: Partial<Field>) => void }) {
  const textual = f.type === "short" || f.type === "paragraph";
  const [open, setOpen] = useState(Boolean(f.pattern || f.min !== undefined || f.max !== undefined || f.examples));
  const [probe, setProbe] = useState("");
  const g = { ...f, required: false };
  const probeErr = probe ? fieldError(g, probe) : null;
  const limitLabel = f.type === "number" ? "value" : f.type === "checkboxes" ? "picks" : "length";

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ShieldIcon className="size-4" /> Add validation
      </button>
    );

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <ShieldIcon className="size-4 text-muted-foreground" /> Validation
      </p>
      {f.type !== "email" && f.type !== "phone" && f.type !== "url" && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <NumberRow label={`Min ${limitLabel}`} value={f.min} onChange={(v) => set({ min: v })} />
          <NumberRow label={`Max ${limitLabel}`} value={f.max} onChange={(v) => set({ max: v })} />
        </div>
      )}
      {textual && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="Pattern (regular expression)"
            value={f.pattern ?? ""}
            onChange={(e) => set({ pattern: e.target.value || undefined })}
            placeholder="Pattern, e.g. ORD-[0-9]{5}"
            className="h-9 font-mono text-[13px]"
          />
          <Input
            aria-label="Error message"
            value={f.patternMessage ?? ""}
            onChange={(e) => set({ patternMessage: e.target.value || undefined })}
            placeholder="Message, e.g. Use the format ORD-12345"
            className="h-9"
          />
        </div>
      )}
      {f.examples && (f.examples.valid.length > 0 || f.examples.invalid.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Example answers, checked against the rule</p>
          <div className="flex flex-wrap gap-1.5">
            {f.examples.valid.map((v) => (
              <ExampleChip key={`v${v}`} text={v} expectPass pass={fieldError(g, v) === null} />
            ))}
            {f.examples.invalid.map((v) => (
              <ExampleChip key={`i${v}`} text={v} expectPass={false} pass={fieldError(g, v) === null} />
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input value={probe} onChange={(e) => setProbe(e.target.value)} placeholder="Try an answer…" aria-label="Try an answer" className="h-9 flex-1" />
        {probe && (
          <span className={cn("text-xs font-medium", probeErr ? "text-destructive" : "text-success")} aria-live="polite">
            {probeErr ?? "Accepted"}
          </span>
        )}
      </div>
    </div>
  );
}

function ExampleChip({ text, expectPass, pass }: { text: string; expectPass: boolean; pass: boolean }) {
  const ok = pass === expectPass;
  return (
    <span
      title={ok ? (pass ? "Accepted, as expected" : "Rejected, as expected") : expectPass ? "Should be accepted but the rule rejects it" : "Should be rejected but the rule accepts it"}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs",
        ok ? (pass ? "border-success/30 bg-success/8" : "border-destructive/25 bg-destructive/6") : "border-warning bg-warning/15",
      )}
    >
      {ok ? (pass ? <CheckIcon className="size-3 text-success" /> : <XIcon className="size-3 text-destructive" />) : <WarningIcon className="size-3 text-warning" />}
      {text || "(empty)"}
    </span>
  );
}

function LogicEditor({ f, earlier, set }: { f: Field; earlier: Field[]; set: (p: Partial<Field>) => void }) {
  const sources = earlier.filter((e) => e.type !== "section" && e.type !== "file");
  if (!sources.length) return null;
  if (!f.showIf)
    return (
      <button
        type="button"
        onClick={() => {
          const src = sources[sources.length - 1]!;
          set({ showIf: { field: src.id, op: "equals", value: src.options?.[0] ?? "" } });
        }}
        className="inline-flex h-9 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <LogicIcon className="size-4" /> {f.type === "section" ? "Only show this section if…" : "Only show if…"}
      </button>
    );

  const c = f.showIf;
  const src = sources.find((s) => s.id === c.field);
  const srcItems = sources.map((s) => ({ value: s.id, label: s.label || "Untitled" }));
  const valueOpts = src && HAS_OPTIONS.has(src.type) ? src.options : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-input bg-muted p-3 text-sm">
      <LogicIcon className="size-4 text-muted-foreground" />
      <span>Show if</span>
      <Select items={srcItems} value={c.field} onValueChange={(v) => v && set({ showIf: { ...c, field: v } })}>
        <SelectTrigger aria-label="Depends on question" className="h-9 max-w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {srcItems.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select items={OP_ITEMS} value={c.op} onValueChange={(v) => v && set({ showIf: { ...c, op: v as typeof c.op } })}>
        <SelectTrigger aria-label="Condition" className="h-9 w-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OP_ITEMS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {c.op !== "answered" &&
        (valueOpts?.length ? (
          <Select items={valueOpts.map((o) => ({ value: o, label: o }))} value={c.value} onValueChange={(v) => set({ showIf: { ...c, value: v ?? "" } })}>
            <SelectTrigger aria-label="Value" className="h-9 max-w-52">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {valueOpts.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input aria-label="Value" value={c.value} onChange={(e) => set({ showIf: { ...c, value: e.target.value } })} className="h-9 w-40" />
        ))}
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove condition" onClick={() => set({ showIf: undefined })} className="ml-auto">
        <XIcon />
      </Button>
    </div>
  );
}

export { clean };
