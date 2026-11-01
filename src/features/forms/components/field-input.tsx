"use client";

import dynamic from "next/dynamic";
import {
  FileIcon,
  SpinnerIcon,
  StarIcon,
  UploadIcon,
  XIcon,
} from "@/components/shared/icons";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { gridCell, splitCell } from "../logic";
import { type Answer, type Field, type FileAnswer, isFileAnswer } from "../schema";

// Only forms with a searchable dropdown pay for the combobox bundle.
const SearchSelect = dynamic(() => import("./search-select"), {
  loading: () => <div className="h-11 rounded-lg border bg-muted" />,
});

const box =
  "w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-[15px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus:border-foreground/60 focus:ring-2 focus:ring-ring/25 aria-invalid:border-destructive disabled:opacity-60";

const INPUT_TYPE: Partial<Record<Field["type"], string>> = {
  short: "text",
  email: "email",
  number: "number",
  phone: "tel",
  url: "url",
  date: "date",
  time: "time",
};

const AUTOCOMPLETE: Partial<Record<Field["type"], string>> = { email: "email", phone: "tel", url: "url" };

export type FieldInputProps = {
  field: Field;
  value: Answer | undefined;
  onChange: (v: Answer | undefined) => void;
  error?: string | null;
  formId?: string;
  /** Builder preview: interactive, but uploads are disabled. */
  preview?: boolean;
};

export function FieldInput({ field: f, value, onChange, error, formId, preview }: FieldInputProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : undefined;
  const str = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  const common = { id, "aria-invalid": Boolean(error) || undefined, "aria-describedby": describedBy, "aria-required": f.required };

  const control = (() => {
    switch (f.type) {
      case "paragraph":
        return (
          <textarea
            {...common}
            rows={4}
            className={cn(box, "min-h-28 resize-y")}
            placeholder={f.placeholder ?? "Your answer"}
            maxLength={f.max}
            value={str}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "choice":
        return <ChoiceInput f={f} value={str} onChange={onChange} />;
      case "checkboxes":
        return <CheckboxesInput f={f} value={list} onChange={onChange} />;
      case "dropdown":
        return f.searchable ? (
          <SearchSelect id={id} options={f.options ?? []} value={str} onChange={(v) => onChange(v)} invalid={Boolean(error)} describedBy={describedBy} placeholder={f.placeholder} />
        ) : (
          <select {...common} className={cn(box, "h-11 appearance-auto")} value={str} onChange={(e) => onChange(e.target.value)}>
            <option value="">{f.placeholder ?? "Choose"}</option>
            {(f.options ?? []).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        );
      case "choice_grid":
      case "checkbox_grid":
        return <GridInput f={f} value={list} onChange={onChange} />;
      case "scale":
        return <ScaleInput f={f} value={str} onChange={onChange} />;
      case "rating":
        return <RatingInput f={f} value={str} onChange={onChange} />;
      case "file":
        return <FileInput id={id} f={f} value={isFileAnswer(value) ? value : undefined} onChange={onChange} formId={formId} disabled={preview} />;
      case "section":
        return null;
      default:
        return (
          <input
            {...common}
            type={INPUT_TYPE[f.type] ?? "text"}
            inputMode={f.type === "number" ? "decimal" : undefined}
            autoComplete={AUTOCOMPLETE[f.type]}
            className={cn(box, "h-11")}
            placeholder={f.placeholder ?? (f.type === "date" || f.type === "time" ? undefined : "Your answer")}
            min={f.type === "number" ? f.min : undefined}
            max={f.type === "number" ? f.max : undefined}
            maxLength={f.type === "short" ? f.max : undefined}
            value={str}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  })();

  const optional = !f.required && <span className="shrink-0 text-xs text-muted-foreground">Optional</span>;
  const description = f.description && <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>;
  const err = error && (
    <p id={describedBy} role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  );

  // Option groups are one question with many controls: a fieldset gives them one name, state and error.
  if (GROUPED.has(f.type))
    return (
      <fieldset className="min-w-0 space-y-3" data-field={f.id} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy}>
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <legend className="text-base font-medium leading-snug">{f.label}</legend>
            {optional}
          </div>
          {description}
        </div>
        {f.image && <img src={f.image} alt="" className="max-h-64 w-full rounded-md object-cover" />}
        {control}
        {err}
      </fieldset>
    );

  return (
    <div className="space-y-3" data-field={f.id}>
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={id} className="text-base font-medium leading-snug">
            {f.label}
          </label>
          {optional}
        </div>
        {description}
      </div>
      {f.image && <img src={f.image} alt="" className="max-h-64 w-full rounded-md object-cover" />}
      {control}
      {err}
    </div>
  );
}

const GROUPED = new Set<Field["type"]>(["choice", "checkboxes", "scale", "rating", "choice_grid", "checkbox_grid"]);

const optionRow =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[15px] transition-colors duration-150 hover:bg-muted has-checked:font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/40";

function ChoiceInput({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const name = useId();
  const opts = f.options ?? [];
  const isOther = value !== "" && !opts.includes(value);
  const [otherOn, setOtherOn] = useState(isOther);
  return (
    <div className="-mx-3 space-y-0.5">
      {opts.map((o) => (
        <label key={o} className={optionRow}>
          <input
            type="radio"
            name={name}
            className="size-[18px] accent-form"
            checked={value === o && !otherOn}
            onChange={() => {
              setOtherOn(false);
              onChange(o);
            }}
          />
          {o}
        </label>
      ))}
      {f.other && (
        <label className={optionRow}>
          <input type="radio" name={name} className="size-[18px] accent-form" checked={otherOn} onChange={() => { setOtherOn(true); onChange(""); }} />
          <span>Other:</span>
          <input
            aria-label="Other answer"
            className="flex-1 border-b border-input bg-transparent py-1 outline-none focus:border-foreground/60"
            value={isOther ? value : ""}
            onFocus={() => setOtherOn(true)}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}

const OTHER = "Other: ";

function CheckboxesInput({ f, value, onChange }: { f: Field; value: string[]; onChange: (v: string[]) => void }) {
  const opts = f.options ?? [];
  const other = value.find((v) => v.startsWith(OTHER));
  const toggle = (o: string, on: boolean) => onChange(on ? [...value, o] : value.filter((v) => v !== o));
  return (
    <div className="-mx-3 space-y-0.5">
      {opts.map((o) => (
        <label key={o} className={optionRow}>
          <input type="checkbox" className="size-[18px] rounded accent-form" checked={value.includes(o)} onChange={(e) => toggle(o, e.target.checked)} />
          {o}
        </label>
      ))}
      {f.other && (
        <label className={optionRow}>
          <input
            type="checkbox"
            className="size-[18px] accent-form"
            checked={other !== undefined}
            onChange={(e) => onChange(e.target.checked ? [...value, OTHER] : value.filter((v) => !v.startsWith(OTHER)))}
          />
          <span>Other:</span>
          <input
            aria-label="Other answer"
            className="flex-1 border-b border-input bg-transparent py-1 outline-none focus:border-foreground/60"
            value={other?.slice(OTHER.length) ?? ""}
            onChange={(e) => onChange([...value.filter((v) => !v.startsWith(OTHER)), OTHER + e.target.value])}
          />
        </label>
      )}
    </div>
  );
}

function GridInput({ f, value, onChange }: { f: Field; value: string[]; onChange: (v: string[]) => void }) {
  const rows = f.options ?? [];
  const cols = f.columns ?? [];
  const radio = f.type === "choice_grid";
  const picked = (row: string) => {
    const hit = value.find((c) => splitCell(c)[0] === row);
    return hit ? splitCell(hit)[1] : "";
  };
  const set = (row: string, col: string, on: boolean) => {
    const rest = value.filter((c) => splitCell(c)[0] !== row || (!radio && splitCell(c)[1] !== col));
    onChange(on ? [...rest, gridCell(row, col)] : rest);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="p-2" />
            {cols.map((c) => (
              <th key={c} className="px-2 py-2 text-center font-medium text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-t">
              <th scope="row" className="py-1 pr-3 text-left font-medium">
                {row}
              </th>
              {cols.map((col) => {
                const on = radio ? picked(row) === col : value.includes(gridCell(row, col));
                return (
                  <td key={col} className="border-t border-border p-1 text-center">
                    <label className="inline-flex size-11 items-center justify-center">
                      <input
                        type={radio ? "radio" : "checkbox"}
                        name={radio ? `${f.id}-${row}` : undefined}
                        aria-label={`${row}, ${col}`}
                        className="size-[18px] accent-form"
                        checked={on}
                        onChange={(e) => set(row, col, e.target.checked)}
                      />
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScaleInput({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const lo = f.min ?? 1;
  const hi = Math.max(lo + 1, Math.min(f.max ?? 5, lo + 10));
  const steps = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i));
  const [low, high] = f.options ?? [];
  return (
    <div>
      <div role="radiogroup" aria-label={f.label} className="flex w-full max-w-md overflow-hidden rounded-md border border-input">
        {steps.map((s) => (
          // biome-ignore lint/a11y/useSemanticElements: styled numbered buttons inside a radiogroup
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            onClick={() => onChange(value === s ? "" : s)}
            className={cn(
              "h-11 flex-1 border-l border-input text-[15px] tabular-nums outline-none transition-colors duration-150 first:border-l-0 hover:bg-muted focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40",
              value === s && "bg-primary font-medium text-primary-foreground hover:bg-primary",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      {(low || high) && (
        <div className="mt-2 flex max-w-md justify-between text-sm text-muted-foreground">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  );
}

function RatingInput({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const n = Math.min(Math.max(f.max ?? 5, 3), 10);
  const cur = Number(value) || 0;
  const [hover, setHover] = useState(0);
  return (
    <div role="radiogroup" aria-label={f.label} className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: n }, (_, i) => i + 1).map((i) => (
        // biome-ignore lint/a11y/useSemanticElements: star buttons inside a radiogroup
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={cur === i}
          aria-label={`${i} of ${n}`}
          onMouseEnter={() => setHover(i)}
          onClick={() => onChange(cur === i ? "" : String(i))}
          className="grid size-11 place-items-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <StarIcon weight={i <= (hover || cur) ? "fill" : "duotone"} className={cn("size-7 transition-colors", i <= (hover || cur) ? "text-chart-3" : "text-input")} />
        </button>
      ))}
    </div>
  );
}

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

function FileInput({
  id,
  f,
  value,
  onChange,
  formId,
  disabled,
}: {
  id: string;
  f: Field;
  value: FileAnswer | undefined;
  onChange: (v: FileAnswer | undefined) => void;
  formId?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const accept = f.options?.join(",");

  async function upload(file: File) {
    if (!formId) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("field", f.id);
    try {
      const res = await fetch(`/api/forms/${formId}/upload`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) setErr(json.error ?? "Upload failed");
      else onChange(json as FileAnswer);
    } catch {
      setErr("Upload failed. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (value)
    return (
      <div className="flex items-center gap-3 rounded-md border bg-muted px-3.5 py-2.5">
        <FileIcon className="size-5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{value.name}</p>
          <p className="text-xs text-muted-foreground">{fmtSize(value.size)}</p>
        </div>
        <button type="button" aria-label="Remove file" onClick={() => onChange(undefined)} className="grid size-9 place-items-center rounded-md hover:bg-muted">
          <XIcon className="size-4" />
        </button>
      </div>
    );

  return (
    <div>
      <label
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input px-4 py-4 text-sm transition-colors duration-150 hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        {busy ? <SpinnerIcon className="size-5 animate-spin text-muted-foreground" /> : <UploadIcon className="size-5 text-muted-foreground" />}
        <span className="font-medium">{busy ? "Uploading…" : disabled ? "Uploads work on the live form" : "Choose a file"}</span>
        <span className="ml-auto text-muted-foreground">
          {[f.options?.join(", "), `up to ${f.max ?? 10} MB`].filter(Boolean).join(" · ")}
        </span>
        <input
          id={id}
          type="file"
          className="sr-only"
          accept={accept}
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </label>
      {err && <p className="mt-2 text-sm font-medium text-destructive">{err}</p>}
    </div>
  );
}
