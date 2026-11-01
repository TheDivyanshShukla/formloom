import { z } from "zod";

export const FIELD_TYPES = [
  "short",
  "paragraph",
  "email",
  "number",
  "phone",
  "url",
  "date",
  "time",
  "choice",
  "checkboxes",
  "dropdown",
  "scale",
  "rating",
  "file",
  "choice_grid",
  "checkbox_grid",
  "text",
  "video",
  "section",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const CONDITION_OPS = ["equals", "not_equals", "contains", "answered", "gt", "lt"] as const;

export const Condition = z.object({
  field: z.string().describe("id of an earlier field"),
  op: z.enum(CONDITION_OPS),
  value: z.string().describe("comparison value; empty string for 'answered'"),
});

export const Examples = z.object({
  valid: z.array(z.string()).describe("2-3 realistic answers that must PASS validation"),
  invalid: z.array(z.string()).describe("2-3 realistic mistakes that must FAIL validation"),
});

export const Field = z.object({
  id: z.string().describe("stable snake_case id, unique in the form"),
  type: z.enum(FIELD_TYPES),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z
    .array(z.string())
    .optional()
    .describe(
      "choices for choice/checkboxes/dropdown; rows for choice_grid/checkbox_grid; for scale: [lowLabel, highLabel]; for file: accepted extensions like ['.pdf','.jpg']",
    ),
  columns: z.array(z.string()).optional().describe("column labels for choice_grid and checkbox_grid"),
  goTo: z
    .record(z.string(), z.string())
    .optional()
    .describe("choice or dropdown only: option text -> a later section's field id, or the word submit"),
  other: z.boolean().optional().describe("adds an 'Other' free-text choice to choice/checkboxes"),
  searchable: z.boolean().optional().describe("dropdown with type-to-search; use for long lists"),
  min: z.number().optional().describe("min length for text, min value for number, min picks for checkboxes, scale start"),
  max: z
    .number()
    .optional()
    .describe("max length for text, max value for number, max picks for checkboxes, scale end, rating stars, file size in MB"),
  pattern: z.string().optional().describe("JavaScript regex the whole answer must match (no ^ or $ needed)"),
  patternMessage: z.string().optional().describe("friendly error that shows the expected format"),
  examples: Examples.optional().describe("for any field with pattern/min/max: sample answers to prove the rule"),
  showIf: Condition.optional().describe("only show this field (or whole section) when the condition holds"),
  image: z.string().optional().describe("https URL of an image shown with this question"),
  answerKey: z
    .object({
      correct: z.array(z.string()).describe("accepted answers; for checkboxes the exact set of options to tick"),
      points: z.number().describe("points for a correct answer"),
      feedback: z.string().optional().describe("shown to the respondent after grading"),
    })
    .optional()
    .describe("quiz only: how this question is graded"),
});

export const FormDraft = z.object({
  title: z.string(),
  description: z.string(),
  confirmation: z.string().describe("message shown after submitting"),
  color: z.string().describe("hex accent color like #326e6e; muted, never neon"),
  font: z.enum(["sans", "serif"]).optional().describe("respondent form typeface"),
  headerImage: z.string().optional().describe("https URL of a banner above the title"),
  fields: z.array(Field),
  quiz: z
    .object({ enabled: z.boolean(), releaseScore: z.enum(["immediately", "later"]) })
    .optional()
    .describe("turn the form into a graded quiz; only when the user asks for a quiz or test"),
});

export type Condition = z.infer<typeof Condition>;
export type Field = z.infer<typeof Field>;
export type FormDraft = z.infer<typeof FormDraft>;

export const Settings = z.object({
  accepting: z.boolean(),
  /** Shown instead of the form when accepting is off. */
  closedMessage: z.string().optional(),
  limitOne: z.boolean(),
  /** Confirmation screen offers a fresh blank form. */
  another: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
  /** Ask for an email address before the questions. */
  collectEmail: z.boolean().optional(),
  /** Email that address a copy of their answers. */
  sendCopy: z.boolean().optional(),
  /** Email the form owner on each new response. Empty means off. */
  notifyEmail: z.string().optional(),
  webhook: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]),
  /** Respondents get a private link to edit their response. */
  allowEdit: z.boolean().optional(),
  csvKey: z.string(),
  /** Linked Google Sheet. Server-managed (like csvKey): clients can never set it. */
  sheet: z
    .object({ spreadsheetId: z.string(), url: z.string(), connectedBy: z.string(), title: z.string() })
    .nullable()
    .optional(),
});
export type Settings = z.infer<typeof Settings>;
/** The part of settings the builder may edit. */
export type EditableSettings = Omit<Settings, "csvKey" | "sheet">;
export type SheetLink = NonNullable<Settings["sheet"]>;

/** Ids and upload keys have fixed shapes; anything else is rejected before it reaches storage or SQL. */
export const FORM_ID_RE = /^[A-Za-z0-9_-]{4,32}$/;
const UPLOAD_KEY_RE = /^([A-Za-z0-9_-]{4,32})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,8})?$/;
/** True when `key` is a server-issued upload key, optionally for a specific form. */
export const isUploadKey = (key: string, formId?: string) => {
  const m = UPLOAD_KEY_RE.exec(key);
  return Boolean(m && (formId === undefined || m[1] === formId));
};

/** A file answer: the server-generated storage key plus display metadata. */
export type FileAnswer = { key: string; name: string; size: number; type: string };
export type Answer = string | string[] | FileAnswer;
export type Answers = Record<string, Answer>;

export const TYPE_LABELS: Record<FieldType, string> = {
  short: "Short answer",
  paragraph: "Paragraph",
  email: "Email",
  number: "Number",
  phone: "Phone",
  url: "Link",
  date: "Date",
  time: "Time",
  choice: "Multiple choice",
  checkboxes: "Checkboxes",
  dropdown: "Dropdown",
  scale: "Linear scale",
  rating: "Rating",
  file: "File upload",
  choice_grid: "Multiple choice grid",
  checkbox_grid: "Checkbox grid",
  text: "Title and description",
  video: "Video",
  section: "Section break",
};

/** Question types a quiz can grade automatically. */
export const GRADABLE = new Set<FieldType>(["short", "number", "choice", "checkboxes", "dropdown"]);

export const HAS_OPTIONS = new Set<FieldType>(["choice", "checkboxes", "dropdown"]);
export const IS_GRID = new Set<FieldType>(["choice_grid", "checkbox_grid"]);
/** Shown on the form, never answered. */
export const DECORATION = new Set<FieldType>(["section", "text", "video"]);
/** Answers that are a list of cells, joined when shown in a spreadsheet. */
export const MULTI = new Set<FieldType>(["checkboxes", "choice_grid", "checkbox_grid"]);
export const TEXTUAL = new Set<FieldType>(["short", "paragraph", "email", "number", "phone", "url"]);

export const isFileAnswer = (a: Answer | undefined): a is FileAnswer =>
  typeof a === "object" && a !== null && !Array.isArray(a) && "key" in a;

export const blankDraft = (): FormDraft => ({
  title: "Untitled form",
  description: "",
  confirmation: "Thanks! Your response has been recorded.",
  color: "#326e6e",
  fields: [{ id: "q1", type: "short", label: "Untitled question", required: false }],
});
