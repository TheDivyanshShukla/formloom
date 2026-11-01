"use client";

import {
  DuplicateIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/shared/icons";
import { useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteFormAction, duplicateFormAction } from "../../actions";
import type { EditableSettings, FormDraft } from "../../schema";

// Swatches are user content (the form's own accent), not design tokens.
const SWATCHES = ["#326e6e", "#1d1f20", "#2f70bb", "#1e7b4f", "#a86f0c", "#b4361f", "#a1305f", "#5d5f60"];

export function SettingsPanel({
  formId,
  draft,
  settings,
  onDraft,
  onSettings,
}: {
  formId: string;
  draft: FormDraft;
  settings: EditableSettings;
  onDraft: (patch: Partial<FormDraft>) => void;
  onSettings: (patch: Partial<EditableSettings>) => void;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <section className="divide-y rounded-xl border bg-card">
        <Row title="Accepting responses" hint="Turn off to close the form. The link shows a closed message.">
          <Switch checked={settings.accepting} onCheckedChange={(c) => onSettings({ accepting: c })} aria-label="Accepting responses" />
        </Row>
        <Row title="Shuffle option order" hint="Each person sees choice, checkbox and dropdown options in a different order.">
          <Switch checked={Boolean(settings.shuffleOptions)} onCheckedChange={(c) => onSettings({ shuffleOptions: c })} aria-label="Shuffle option order" />
        </Row>
        <Row title="Shuffle question order" hint="Questions on a page change order. Section titles stay at the top of the page.">
          <Switch checked={Boolean(settings.shuffleQuestions)} onCheckedChange={(c) => onSettings({ shuffleQuestions: c })} aria-label="Shuffle question order" />
        </Row>
        <Row title="Collect email addresses" hint="The form asks for an email before the questions.">
          <Switch checked={Boolean(settings.collectEmail)} onCheckedChange={(c) => onSettings({ collectEmail: c })} aria-label="Collect email addresses" />
        </Row>
        <Row title="Send respondents a copy" hint="Needs RESEND_API_KEY and MAIL_FROM. Otherwise the switch is saved and nothing is sent.">
          <Switch checked={Boolean(settings.sendCopy)} onCheckedChange={(c) => onSettings({ sendCopy: c })} aria-label="Send respondents a copy" />
        </Row>
        <Row title="Submit another response" hint="After sending, the confirmation screen offers a blank form.">
          <Switch checked={Boolean(settings.another)} onCheckedChange={(c) => onSettings({ another: c })} aria-label="Submit another response" />
        </Row>
        <Row title="One response per device" hint="Stops casual repeat submissions. Not a security control: for strict limits ask for a verified email.">
          <Switch checked={settings.limitOne} onCheckedChange={(c) => onSettings({ limitOne: c })} aria-label="One response per device" />
        </Row>
        <Row title="Let people edit after submitting" hint="Each respondent gets a private link on the confirmation screen to change their answers.">
          <Switch checked={Boolean(settings.allowEdit)} onCheckedChange={(c) => onSettings({ allowEdit: c })} aria-label="Let people edit after submitting" />
        </Row>
      </section>

      <section className="divide-y rounded-xl border bg-card">
        <Row title="Make this a quiz" hint="Assign points and correct answers. A released score includes what they missed. The answer key is not in the form page.">
          <Switch
            checked={Boolean(draft.quiz?.enabled)}
            onCheckedChange={(c) => onDraft({ quiz: { enabled: c, releaseScore: draft.quiz?.releaseScore ?? "immediately" } })}
            aria-label="Make this a quiz"
          />
        </Row>
        {draft.quiz?.enabled && (
          <Row title="Show score right after submitting" hint="Turn off to grade first and share results yourself later.">
            <Switch
              checked={draft.quiz.releaseScore === "immediately"}
              onCheckedChange={(c) => onDraft({ quiz: { enabled: true, releaseScore: c ? "immediately" : "later" } })}
              aria-label="Show score right after submitting"
            />
          </Row>
        )}
      </section>

      <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
        <div>
          <p className="mb-2 text-sm font-medium">Accent color</p>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Use color ${c}`}
                aria-pressed={draft.color.toLowerCase() === c}
                onClick={() => onDraft({ color: c })}
                style={{ background: c }}
                className={cn(
                  "size-8 rounded-full outline-none ring-offset-2 ring-offset-card transition focus-visible:ring-3 focus-visible:ring-ring",
                  draft.color.toLowerCase() === c && "ring-2 ring-foreground",
                )}
              />
            ))}
            <label className="relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border bg-card text-muted-foreground hover:bg-muted" title="Custom color">
              <PlusIcon className="size-4" />
              <input type="color" value={draft.color} onChange={(e) => onDraft({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom color" />
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="confirmation" className="mb-2 block text-sm font-medium">
            Confirmation message
          </label>
          <Textarea id="confirmation" value={draft.confirmation} onChange={(e) => onDraft({ confirmation: e.target.value })} rows={2} />
        </div>
        <div>
          <label htmlFor="closed" className="mb-2 block text-sm font-medium">
            Message when the form is closed
          </label>
          <Textarea
            id="closed"
            value={settings.closedMessage ?? ""}
            onChange={(e) => onSettings({ closedMessage: e.target.value || undefined })}
            placeholder="This form is no longer accepting responses."
            rows={2}
          />
        </div>
        <div>
          <label htmlFor="notify" className="mb-2 block text-sm font-medium">
            Email me each response
          </label>
          <Input
            id="notify"
            type="email"
            value={settings.notifyEmail ?? ""}
            placeholder="you@company.com"
            onChange={(e) => onSettings({ notifyEmail: e.target.value.trim() })}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Sent only when RESEND_API_KEY and MAIL_FROM are set on the server.</p>
        </div>
        <div>
          <label htmlFor="banner" className="mb-2 block text-sm font-medium">
            Header image URL
          </label>
          <Input id="banner" value={draft.headerImage ?? ""} placeholder="https://" onChange={(e) => onDraft({ headerImage: e.target.value.trim() || undefined })} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Font</p>
          <div className="flex gap-2">
            {(["sans", "serif"] as const).map((font) => (
              <button
                key={font}
                type="button"
                aria-pressed={(draft.font ?? "sans") === font}
                onClick={() => onDraft({ font })}
                className={cn("h-9 rounded-md border px-3 text-sm", (draft.font ?? "sans") === font && "border-foreground font-medium", font === "serif" && "font-serif")}
              >
                {font === "sans" ? "Sans" : "Serif"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2 rounded-xl border bg-card p-5 sm:p-6">
        <Button variant="outline" disabled={pending} onClick={() => start(() => duplicateFormAction(formId))}>
          <DuplicateIcon /> Duplicate form
        </Button>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" disabled={pending} />}>
            <TrashIcon /> Delete form
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{draft.title}”?</AlertDialogTitle>
              <AlertDialogDescription>The form, its link and every response are deleted permanently. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => start(() => deleteFormAction(formId))}>
                Delete forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}
