"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, ExternalLinkIcon, KeyIcon, RefreshIcon, SheetIcon, SpinnerIcon } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { linkSheetAction, resyncSheetAction, sheetsStatusAction, unlinkSheetAction } from "@/features/integrations/actions";
import type { SheetsStatus } from "@/features/integrations/google/server/service";
import { rotateCsvKeyAction } from "../../actions";
import type { SheetLink } from "../../schema";

/** "Link to Sheets", where Google Forms users expect it: the Responses header. */
export function LinkSheets({
  formId,
  csvKey,
  onCsvKey,
  initial,
}: {
  formId: string;
  csvKey: string;
  onCsvKey: (k: string) => void;
  initial: SheetLink | null;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetLink | null>(initial);
  const [status, setStatus] = useState<SheetsStatus | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  // Back from Google's consent screen.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("sheet");
    if (!q) return;
    if (q === "linked") toast.success("Linked to a new Google Sheet. New responses are added automatically.");
    else toast.error("Could not link Google Sheets. Try again.");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!open) return;
    sheetsStatusAction(formId)
      .then((s) => {
        setStatus(s);
        if (s) setSheet(s.sheet);
      })
      .catch(() => setStatus(null));
  }, [open, formId]);

  const feed = `${origin}/api/forms/${formId}/csv?key=${csvKey}`;
  const copy = async (k: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(k);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed. Select the text and copy it.");
    }
  };

  return (
    <>
      {sheet ? (
        <Button variant="outline" size="sm" render={<a href={sheet.url} target="_blank" rel="noreferrer" />}>
          <SheetIcon className="text-success" /> View in Sheets
        </Button>
      ) : null}
      <Button variant={sheet ? "ghost" : "outline"} size="sm" onClick={() => setOpen(true)}>
        {!sheet && <SheetIcon className="text-success" />} {sheet ? "Sheet options" : "Link to Sheets"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send responses to a spreadsheet</DialogTitle>
            <DialogDescription>Every new response is added as a row.</DialogDescription>
          </DialogHeader>

          <section className="space-y-3 rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Google Sheets, linked</h3>
            {sheet ? (
              <>
                <p className="text-sm">
                  Linked to <span className="font-medium">{sheet.title}</span>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" render={<a href={sheet.url} target="_blank" rel="noreferrer" />}>
                    Open sheet <ExternalLinkIcon />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await resyncSheetAction(formId);
                        if ("ok" in r) toast.success("Sheet rebuilt from all responses");
                        else toast.error(r.error);
                      })
                    }
                  >
                    <RefreshIcon /> Resync
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        if (await unlinkSheetAction(formId)) {
                          setSheet(null);
                          toast.success("Unlinked. The spreadsheet stays in your Drive.");
                        }
                      })
                    }
                  >
                    Unlink
                  </Button>
                </div>
              </>
            ) : status && !status.configured ? (
              <p className="text-sm text-muted-foreground">
                Google sign-in is not set up on this server yet (AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET). Use the live feed below, which needs no sign-in.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Creates a new spreadsheet in your Google Drive with every response so far, then adds new ones as they arrive. Formloom can only see
                  spreadsheets it creates.
                </p>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await linkSheetAction(formId);
                      if ("needsAuth" in r) window.location.assign(r.needsAuth);
                      else if ("sheet" in r) {
                        setSheet(r.sheet);
                        toast.success("Linked to a new Google Sheet");
                      } else toast.error(r.error);
                    })
                  }
                >
                  {pending && <SpinnerIcon className="animate-spin" />} Create spreadsheet
                </Button>
              </>
            )}
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Live feed, no sign-in</h3>
            <div>
              <p className="mb-1.5 text-sm text-muted-foreground">Google Sheets: paste into cell A1. Refreshes about hourly.</p>
              <CopyRow value={`=IMPORTDATA("${feed}")`} id="sheets" copied={copied} onCopy={copy} />
            </div>
            <div>
              <p className="mb-1.5 text-sm text-muted-foreground">Excel: Data, Get Data, From Web, then paste.</p>
              <CopyRow value={feed} id="excel" copied={copied} onCopy={copy} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KeyIcon className="size-3.5 shrink-0" />
              <span className="flex-1">The key in this link can read every response. Rotate it if it leaks.</span>
              <Button
                variant="ghost"
                size="xs"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const k = await rotateCsvKeyAction(formId);
                    if (k) {
                      onCsvKey(k);
                      toast.success("New key. Update your spreadsheet formula.");
                    }
                  })
                }
              >
                Rotate key
              </Button>
            </div>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CopyRow({ value, id, copied, onCopy }: { value: string; id: string; copied: string | null; onCopy: (k: string, v: string) => void }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="h-9 font-mono text-[12px]" aria-label={id} />
      <Button variant="outline" className="h-9 shrink-0" onClick={() => onCopy(id, value)}>
        {copied === id ? <CheckIcon className="text-success" /> : <CopyIcon />}
        {copied === id ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
