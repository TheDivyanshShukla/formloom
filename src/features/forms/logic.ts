import { type Answer, type Answers, type Condition, type Field, type FormDraft, isFileAnswer } from "./schema.ts";

export const isEmpty = (a: Answer | undefined) =>
  a === undefined || (isFileAnswer(a) ? false : Array.isArray(a) ? a.length === 0 : a.trim() === "");

/** Answer as a list of strings, for conditions, summaries and CSV. */
export const asList = (a: Answer | undefined): string[] =>
  a === undefined ? [] : isFileAnswer(a) ? [a.name] : Array.isArray(a) ? a : [a];

export function holds(c: Condition, answers: Answers): boolean {
  const a = answers[c.field];
  const vals = asList(a);
  const v = c.value.trim().toLowerCase();
  const lower = vals.map((x) => x.trim().toLowerCase());
  switch (c.op) {
    case "answered":
      return !isEmpty(a);
    case "equals":
      return lower.includes(v);
    case "not_equals":
      return !lower.includes(v);
    case "contains":
      return lower.some((x) => x.includes(v));
    case "gt":
      return vals.some((x) => Number(x) > Number(c.value));
    case "lt":
      return vals.some((x) => Number(x) < Number(c.value));
  }
}

/** Ids of fields currently visible. A hidden section hides everything until the next section. */
export function visibleIds(fields: Field[], answers: Answers): Set<string> {
  const out = new Set<string>();
  let sectionOn = true;
  for (const f of fields) {
    const own = !f.showIf || holds(f.showIf, answers);
    if (f.type === "section") sectionOn = own;
    if (sectionOn && own) out.add(f.id);
  }
  return out;
}

const SEP = "\t";
/** One grid cell, stored as "row<TAB>column". */
export const gridCell = (row: string, col: string) => `${row}${SEP}${col}`;
export const splitCell = (cell: string): [string, string] => {
  const i = cell.indexOf(SEP);
  return i < 0 ? [cell, ""] : [cell.slice(0, i), cell.slice(i + 1)];
};

/** Where Next should go from this page: a section id, "submit", or null to continue. Last answered rule wins. */
export function jumpTarget(pageFields: Field[], answers: Answers): string | null {
  let target: string | null = null;
  for (const f of pageFields) {
    if ((f.type !== "choice" && f.type !== "dropdown") || !f.goTo) continue;
    const picked = asList(answers[f.id])[0];
    const to = picked ? f.goTo[picked] : undefined;
    if (to) target = to;
  }
  return target;
}

/** Text of an answer for tables and spreadsheets. Grid cells read as "row: column". */
export function answerText(f: Field, a: Answer | undefined, sep = ", "): string {
  const parts = asList(a).map((s) => (s.includes(SEP) ? splitCell(s).join(": ") : s));
  return parts.join(f.type === "checkboxes" || f.type === "choice_grid" || f.type === "checkbox_grid" ? sep : "");
}

/** Turn a respondent-supplied URL into a safe embed. Only https. Unknown hosts are not iframed. */
export function videoEmbed(raw: string): { kind: "iframe" | "file"; src: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  const you = url.searchParams.get("v");
  if ((host === "youtube.com" || host === "m.youtube.com") && you && /^[\w-]{6,}$/.test(you))
    return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${you}` };
  const short = host === "youtu.be" ? url.pathname.slice(1) : host === "youtube.com" && url.pathname.startsWith("/embed/") ? url.pathname.slice(7) : host === "youtube.com" && url.pathname.startsWith("/shorts/") ? url.pathname.slice(8) : "";
  if (short && /^[\w-]{6,}$/.test(short.split("/")[0] ?? ""))
    return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${short.split("/")[0]}` };
  const vimeo = host === "vimeo.com" ? url.pathname.slice(1).match(/^\d+/)?.[0] : undefined;
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo}` };
  if (/\.(mp4|webm)$/i.test(url.pathname)) return { kind: "file", src: url.toString() };
  return null;
}

/** Fisher–Yates with a fixed seed, so a refresh keeps the same order. */
export function seededOrder<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Split fields into pages at each visible section break. */
export function pages(fields: Field[], visible: Set<string>): Field[][] {
  const out: Field[][] = [];
  let cur: Field[] = [];
  for (const f of fields) {
    if (!visible.has(f.id)) continue;
    if (f.type === "section" && cur.length) {
      out.push(cur);
      cur = [];
    }
    cur.push(f);
  }
  out.push(cur);
  return out;
}

/**
 * Patterns run on the server against public input, so catastrophic backtracking is a denial of service.
 * Rejects long patterns, backreferences and quantified groups that contain quantifiers ((a+)+, (a|aa)*).
 * ponytail: heuristic, not a proof; switch to RE2 if users need arbitrary regexes.
 */
export function unsafePattern(p: string): boolean {
  if (p.length > 200) return true;
  if (/\\[1-9]/.test(p)) return true;
  return /\((?:[^()\\]|\\.)*[+*?}](?:[^()\\]|\\.)*\)\s*[+*{]/.test(p) || /\((?:[^()\\]|\\.)*\|(?:[^()\\]|\\.)*\)\s*[+*{]/.test(p);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;

export function fieldError(f: Field, a: Answer | undefined): string | null {
  if (f.type === "section" || f.type === "text" || f.type === "video") return null;
  if (isEmpty(a)) return f.required ? "This question is required" : null;
  if (f.type === "file") {
    if (!isFileAnswer(a)) return "Upload a file";
    if (f.max !== undefined && a.size > f.max * 1024 * 1024) return `File must be under ${f.max} MB`;
    const ext = a.name.slice(a.name.lastIndexOf(".")).toLowerCase();
    if (f.options?.length && !f.options.some((o) => o.toLowerCase() === ext)) return `Allowed: ${f.options.join(", ")}`;
    return null;
  }
  if (isFileAnswer(a)) return "Unexpected file";
  const vals = asList(a);
  const s = vals[0] ?? "";
  switch (f.type) {
    case "email":
      if (!EMAIL.test(s)) return "Enter a valid email";
      break;
    case "phone":
      if (!PHONE.test(s)) return "Enter a valid phone number";
      break;
    case "url":
      try {
        new URL(s);
      } catch {
        return "Enter a valid link (https://...)";
      }
      break;
    case "number": {
      const n = Number(s);
      if (!Number.isFinite(n)) return "Enter a number";
      if (f.min !== undefined && n < f.min) return `Must be at least ${f.min}`;
      if (f.max !== undefined && n > f.max) return `Must be at most ${f.max}`;
      break;
    }
    case "short":
    case "paragraph":
      if (f.min !== undefined && s.length < f.min) return `At least ${f.min} characters`;
      if (f.max !== undefined && s.length > f.max) return `At most ${f.max} characters`;
      break;
    case "choice":
    case "dropdown":
      if (f.options?.length && !f.options.includes(s) && !(f.other && f.type === "choice")) return "Pick one of the options";
      break;
    case "checkboxes":
      if (f.min !== undefined && vals.length < f.min) return `Pick at least ${f.min}`;
      if (f.max !== undefined && vals.length > f.max) return `Pick at most ${f.max}`;
      break;
    case "choice_grid":
    case "checkbox_grid": {
      const rows = f.options ?? [];
      const cols = new Set(f.columns ?? []);
      const seen = new Map<string, number>();
      for (const cell of vals) {
        const [row, col] = splitCell(cell);
        if (!rows.includes(row) || !cols.has(col)) return "Pick from the grid";
        seen.set(row, (seen.get(row) ?? 0) + 1);
      }
      if (f.type === "choice_grid" && [...seen.values()].some((n) => n > 1)) return "Pick one column per row";
      if (f.required && f.type === "choice_grid" && rows.some((r) => !seen.has(r))) return "Answer every row";
      if (f.required && f.type === "checkbox_grid" && seen.size === 0) return "This question is required";
      break;
    }
  }
  if (f.pattern && !unsafePattern(f.pattern)) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(`^(?:${f.pattern})$`);
    } catch {}
    // Bounded input keeps even a slow pattern cheap; long answers are capped by max length anyway.
    if (re && (s.length > 2000 || !re.test(s))) return f.patternMessage || "Answer is not in the expected format";
  }
  return null;
}

/** Validate visible fields; returns errors by field id plus answers stripped of hidden/unknown keys. */
export function validate(form: Pick<FormDraft, "fields">, answers: Answers) {
  const visible = visibleIds(form.fields, answers);
  const errors: Record<string, string> = {};
  const clean: Answers = {};
  for (const f of form.fields) {
    if (!visible.has(f.id) || f.type === "section" || f.type === "text" || f.type === "video") continue;
    const a = answers[f.id];
    const e = fieldError(f, a);
    if (e) errors[f.id] = e;
    else if (!isEmpty(a)) clean[f.id] = a!;
  }
  return { errors, clean };
}
