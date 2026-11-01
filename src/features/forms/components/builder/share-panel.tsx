"use client";

import {
  CheckIcon,
  CodeIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  WebhookIcon,
} from "@/components/shared/icons";
import { renderSVG } from "uqr";
import { useMemo, useState } from "react";
import type { Field } from "../../schema";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: async (key: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
      } catch {
        toast.error("Copy failed. Select the text and copy it manually.");
      }
    },
  };
}

function Prefill({ origin, formId, fields, copy }: { origin: string; formId: string; fields: Field[]; copy: ReturnType<typeof useCopy> }) {
  const usable = fields.filter((f) => f.type !== "section" && f.type !== "file" && f.type !== "choice_grid" && f.type !== "checkbox_grid").slice(0, 6);
  const [vals, setVals] = useState<Record<string, string>>({});
  const link = useMemo(() => {
    const q = new URLSearchParams();
    for (const f of usable) {
      const v = vals[f.id]?.trim();
      if (v) q.set(f.id, v);
    }
    const s = q.toString();
    return `${origin}/f/${formId}${s ? `?${s}` : ""}`;
  }, [vals, usable, origin, formId]);
  if (!usable.length) return null;
  return (
    <Card icon={<LinkIcon />} title="Pre-filled link" hint="The form opens with these answers already filled in. People can still change them.">
      <div className="space-y-2">
        {usable.map((f) => (
          <label key={f.id} className="block text-sm">
            <span className="mb-1 block text-muted-foreground">{f.label || "Untitled"}</span>
            <Input value={vals[f.id] ?? ""} onChange={(e) => setVals((s) => ({ ...s, [f.id]: e.target.value }))} className="h-9" />
          </label>
        ))}
      </div>
      <div className="mt-3">
        <CopyField id="prefill" value={link} {...copy} />
      </div>
    </Card>
  );
}

function CopyField({ id, value, mono, copy, copied }: { id: string; value: string; mono?: boolean } & ReturnType<typeof useCopy>) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className={`h-10 bg-muted/40 ${mono ? "font-mono text-[13px]" : ""}`} aria-label={id} />
      <Button variant="outline" className="h-10 shrink-0" onClick={() => copy(id, value)}>
        {copied === id ? <CheckIcon className="text-success" /> : <CopyIcon />}
        {copied === id ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

const appsScript = `// Paste into Extensions > Apps Script of the target Google Sheet, then
// Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const answers = data.response.answers;
  const headers = ["Submitted at", ...Object.keys(answers)];
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (const h of headers) if (!existing.includes(h)) { existing.push(h); sheet.getRange(1, existing.length).setValue(h); }
  const row = existing.map((h) => (h === "Submitted at" ? data.response.submittedAt : answers[h] ?? ""));
  sheet.appendRow(row);
  return ContentService.createTextOutput("ok");
}`;

export function SharePanel({
  formId,
  origin,
  fields = [],
  webhook,
  onWebhook,
}: {
  formId: string;
  origin: string;
  fields?: Field[];
  webhook: string;
  onWebhook: (v: string) => void;
}) {
  const c = useCopy();
  const [hook, setHook] = useState(webhook);
  const link = `${origin}/f/${formId}`;
  const embed = `<iframe src="${link}" width="100%" height="900" style="border:0" loading="lazy" title="Form"></iframe>`;
  const hookValid = hook === "" || /^https?:\/\/.+/.test(hook);

  return (
    <div className="space-y-4">
      <Card icon={<LinkIcon />} title="Public link" hint="Anyone with the link can respond. No sign-in needed.">
        <CopyField id="link" value={link} {...c} />
        <Button variant="link" className="mt-1 h-8 px-0" render={<a href={link} target="_blank" rel="noreferrer" />}>
          Open form <ExternalLinkIcon />
        </Button>
      </Card>

      <Card icon={<LinkIcon />} title="QR code" hint="Print it on a poster or slide. Scanning opens the public link.">
        <div className="flex items-start gap-4">
          <img
            alt="QR code for the public link"
            src={`data:image/svg+xml,${encodeURIComponent(renderSVG(link))}`}
            className="size-36 shrink-0 rounded-md border bg-white p-2"
          />
          <p className="text-sm text-muted-foreground">Same address as the public link. Copy the link if you would rather share it as text.</p>
        </div>
      </Card>

      <Prefill origin={origin} formId={formId} fields={fields} copy={c} />

      <Card icon={<CodeIcon />} title="Embed on a website" hint="Paste into any HTML page, Notion embed block or LMS.">
        <CopyField id="embed" value={embed} mono {...c} />
      </Card>

      <Card icon={<WebhookIcon />} title="Push each response (webhook)" hint="Each submission is POSTed as JSON the moment it arrives. Works with Apps Script, Zapier, Make, n8n or your own API.">
        <div className="flex gap-2">
          <Input
            value={hook}
            onChange={(e) => setHook(e.target.value.trim())}
            placeholder="https://script.google.com/macros/s/…/exec"
            aria-label="Webhook URL"
            aria-invalid={!hookValid || undefined}
            className="h-10 font-mono text-[13px]"
          />
          <Button className="h-10" disabled={!hookValid || hook === webhook} onClick={() => onWebhook(hook)}>
            Save
          </Button>
        </div>
        {!hookValid && <p className="mt-1.5 text-xs font-medium text-destructive">Enter a full https:// URL.</p>}
        <details className="group mt-4 rounded-xl border">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Append rows to a Google Sheet instantly (Apps Script)</summary>
          <div className="space-y-3 border-t px-4 py-4 text-sm">
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Open your sheet › Extensions › Apps Script, replace the code with the script below.</li>
              <li>Deploy › New deployment › Web app. Execute as Me, access Anyone. Authorise.</li>
              <li>Copy the web app URL ending in /exec, paste it above, Save.</li>
            </ol>
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed">{appsScript}</pre>
            <Button variant="outline" size="sm" onClick={() => c.copy("script", appsScript)}>
              {c.copied === "script" ? <CheckIcon className="text-success" /> : <CopyIcon />} Copy script
            </Button>
          </div>
        </details>
      </Card>
    </div>
  );
}

function Card({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex gap-3">
        <span className="mt-0.5 text-muted-foreground [&_svg]:size-5">{icon}</span>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
