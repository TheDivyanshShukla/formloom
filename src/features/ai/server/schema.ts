import { z } from "zod";
import { FormDraft } from "@/features/forms/schema";

export const AiQuestion = z.object({
  question: z.string(),
  options: z.array(z.string()).describe("2-4 short one-click answers"),
});

export const AiSuggestion = z.object({
  title: z.string().describe("e.g. 'Make Branch a searchable dropdown'"),
  why: z.string().describe("one line on the benefit"),
  prompt: z.string().describe("the exact instruction that applies it"),
});

export const AiOutput = z.object({
  reply: z.string(),
  form: FormDraft,
  questions: z.array(AiQuestion),
  suggestions: z.array(AiSuggestion),
});

export type AiQuestion = z.infer<typeof AiQuestion>;
export type AiSuggestion = z.infer<typeof AiSuggestion>;
export type AiResult = z.infer<typeof AiOutput>;

export const ChatTurn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
export type ChatTurn = z.infer<typeof ChatTurn>;

export const aiEditInput = z.object({
  formId: z.string().min(1),
  /** The builder's live draft, which may be ahead of the last autosave. */
  draft: FormDraft,
  history: z.array(ChatTurn).min(1).max(40),
});
