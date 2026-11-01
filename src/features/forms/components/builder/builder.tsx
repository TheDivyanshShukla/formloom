"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  CheckIcon,
  CloudOffIcon,
  EyeIcon,
  PlusIcon,
  SparkleIcon,
  SpinnerIcon,
  UndoIcon,
  TYPE_ICONS,
} from "@/components/shared/icons";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ResponsesView } from "@/features/responses/components/responses-view";
import type { ResponseDTO } from "@/features/responses/server/service";
import { useRouter } from "next/navigation";
import { focusWorkspaceAction } from "@/features/workspaces/actions";
import { saveFormAction } from "../../actions";
import { type EditableSettings, type Field, FIELD_TYPES, type FormDraft, HAS_OPTIONS, IS_GRID, TYPE_LABELS } from "../../schema";
import type { FormDTO } from "../../server/service";
import { FormRunner } from "../form-runner";
import { AiPanel } from "./ai-panel";
import { clean, QuestionCard } from "./question-card";
import { SettingsPanel } from "./settings-panel";
import { LinkSheets } from "./link-sheets";
import { SharePanel } from "./share-panel";

type SaveState = "saved" | "saving" | "error";
type Tab = "questions" | "responses" | "settings" | "preview";

const newId = () => `q_${Math.random().toString(36).slice(2, 8)}`;

export function Builder({ form, responses, headerWorkspaceId }: { form: FormDTO; responses: ResponseDTO[]; headerWorkspaceId: string }) {
  const [draft, setDraft] = useState<FormDraft>(form.draft);
  const [settings, setSettings] = useState<EditableSettings>(() => {
    const { csvKey: _k, sheet: _s, ...rest } = form.settings;
    return rest;
  });
  const [csvKey, setCsvKey] = useState(form.settings.csvKey);
  const [active, setActive] = useState<string | null>(null);
  const canEdit = form.role !== "viewer";
  const [tab, setTab] = useState<Tab>(canEdit ? "questions" : "responses");
  const [save, setSave] = useState<SaveState>("saved");
  const [aiOpen, setAiOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const undo = useRef<FormDraft[]>([]);
  const first = useRef(true);
  const latest = useRef({ draft, settings });
  latest.current = { draft, settings };

  useEffect(() => setOrigin(window.location.origin), []);

  // Opened from a link into another workspace: point the switcher (and "New form") at this form's workspace.
  const router = useRouter();
  useEffect(() => {
    if (headerWorkspaceId === form.workspaceId) return;
    focusWorkspaceAction(form.workspaceId)
      .then((ok) => ok && router.refresh())
      .catch(() => {});
  }, [headerWorkspaceId, form.workspaceId, router]);

  // Debounced autosave; the latest state always wins.
  // biome-ignore lint/correctness/useExhaustiveDependencies: draft/settings are the save triggers, read via ref
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSave("saving");
    const t = setTimeout(async () => {
      const snapshot = latest.current;
      const res = await saveFormAction({ id: form.id, ...snapshot }).catch(() => ({ ok: false as const, error: "offline" }));
      // A newer edit schedules its own save; re-renders alone (new ref object) must not strand the badge.
      if (latest.current.draft !== snapshot.draft || latest.current.settings !== snapshot.settings) return;
      setSave(res.ok ? "saved" : "error");
      if (!res.ok && res.error !== "offline") toast.error(res.error);
    }, 700);
    return () => clearTimeout(t);
  }, [draft, settings, form.id]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (save === "saved") return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [save]);

  const snapshot = useCallback(() => {
    undo.current = [...undo.current.slice(-29), latest.current.draft];
  }, []);

  const doUndo = useCallback(() => {
    const prev = undo.current.pop();
    if (prev) setDraft(prev);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && !el.closest("input,textarea,[contenteditable]")) {
        e.preventDefault();
        doUndo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [doUndo]);

  const patchDraft = useCallback((p: Partial<FormDraft>) => setDraft((d) => ({ ...d, ...p })), []);

  const onChange = useCallback((id: string, patch: Partial<Field>) => {
    if ("type" in patch) snapshot();
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? clean({ ...f, ...patch }) : f)) }));
  }, [snapshot]);

  const onDuplicate = useCallback((id: string) => {
    snapshot();
    const nid = newId();
    setDraft((d) => {
      const i = d.fields.findIndex((f) => f.id === id);
      const src = d.fields[i];
      if (!src) return d;
      const fields = [...d.fields];
      fields.splice(i + 1, 0, { ...src, id: nid, label: `${src.label} (copy)` });
      return { ...d, fields };
    });
    setActive(nid);
  }, [snapshot]);

  const onDelete = useCallback((id: string) => {
    snapshot();
    const d0 = latest.current.draft;
    const index = d0.fields.findIndex((f) => f.id === id);
    const removed = d0.fields[index];
    const dependents = d0.fields.filter((f) => f.showIf?.field === id).map((f) => [f.id, f.showIf] as const);
    setDraft((d) => ({
      ...d,
      // Conditions pointing at the deleted question would hide fields forever; drop them.
      fields: d.fields.filter((f) => f.id !== id).map((f) => (f.showIf?.field === id ? clean({ ...f, showIf: undefined }) : f)),
    }));
    setActive(null);
    // Restore just this question (and the conditions that used it), keeping every edit made since.
    const restore = () =>
      removed &&
      setDraft((d) => {
        if (d.fields.some((f) => f.id === removed.id)) return d;
        const fields = d.fields.map((f) => {
          const dep = dependents.find(([fid]) => fid === f.id);
          return dep && !f.showIf ? { ...f, showIf: dep[1] } : f;
        });
        fields.splice(Math.min(index, fields.length), 0, removed);
        return { ...d, fields };
      });
    toast("Question deleted", { action: { label: "Undo", onClick: restore } });
  }, [snapshot]);

  const add = (type: Field["type"], at?: number) => {
    snapshot();
    const f: Field = {
      id: newId(),
      type,
      label: type === "section" ? "New section" : type === "text" ? "Untitled text" : type === "video" ? "Video" : "Untitled question",
      required: false,
      ...(HAS_OPTIONS.has(type) ? { options: ["Option 1"] } : {}),
      ...(IS_GRID.has(type) ? { options: ["Row 1", "Row 2"], columns: ["Column 1", "Column 2"] } : {}),
    };
    setDraft((d) => {
      const i = at ?? d.fields.length;
      const fields = [...d.fields];
      fields.splice(i, 0, f);
      return { ...d, fields };
    });
    setActive(f.id);
    requestAnimationFrame(() => document.getElementById(`card-${f.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    if (!over || a.id === over.id) return;
    snapshot();
    setDraft((d) => {
      const from = d.fields.findIndex((f) => f.id === a.id);
      const to = d.fields.findIndex((f) => f.id === over.id);
      const fields = arrayMove(d.fields, from, to);
      // A condition may only reference an earlier question; drop ones the move broke.
      const seen = new Set<string>();
      return {
        ...d,
        fields: fields.map((f) => {
          const ok = !f.showIf || seen.has(f.showIf.field);
          seen.add(f.id);
          return ok ? f : clean({ ...f, showIf: undefined });
        }),
      };
    });
  };

  const applyAi = useCallback((next: FormDraft, note: string) => {
    snapshot();
    setDraft(next);
    toast.success("Form updated", { description: note.slice(0, 120), action: { label: "Undo", onClick: doUndo } });
  }, [snapshot, doUndo]);

  const ids = useMemo(() => draft.fields.map((f) => f.id), [draft.fields]);
  const csvUrl = `/api/forms/${form.id}/csv?key=${csvKey}`;

  const ai = <AiPanel formId={form.id} draft={draft} onApply={applyAi} className="h-full" onClose={() => setAiOpen(false)} />;
  const isLg = useIsLg();

  // A form born from a prompt opens with the assistant showing its questions and suggestions.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`formloom:seed:${form.id}`)) setAiOpen(true);
    } catch {}
  }, [form.id]);

  // Floating toolbar follows the selected question, like Google Forms.
  const canvas = useRef<HTMLDivElement>(null);
  const [barTop, setBarTop] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when questions move or change height
  useLayoutEffect(() => {
    const el = active ? document.getElementById(`card-${active}`) : null;
    setBarTop(el && canvas.current ? el.offsetTop : 0);
  }, [active, draft.fields]);

  const addAfterActive = (t: Field["type"]) => {
    const i = active ? draft.fields.findIndex((f) => f.id === active) : -1;
    add(t, i >= 0 ? i + 1 : draft.fields.length);
  };

  return (
    <div style={{ "--form": draft.color } as React.CSSProperties} className="flex min-h-0 flex-1 flex-col">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="min-h-0 flex-1 gap-0">
        <div className="sticky top-0 z-20 border-b bg-card">
          <div className="flex h-12 items-center gap-2 px-2 sm:px-5 md:grid md:grid-cols-[1fr_auto_1fr]">
            <div className="flex min-w-0 items-center gap-3 max-md:hidden">
              <span className="truncate text-sm font-medium">{draft.title || "Untitled form"}</span>
              <SaveBadge state={save} />
            </div>
            <TabsList variant="line" className="h-12 min-w-0 justify-self-center max-md:-ml-1">
              <TabsTrigger value="questions" className="px-3">Questions</TabsTrigger>
              <TabsTrigger value="responses" className="px-3">
                Responses
                {responses.length > 0 && <span className="num rounded-full bg-pop px-1.5 text-[11px] font-semibold text-[#131416]">{responses.length}</span>}
              </TabsTrigger>
              {canEdit && <TabsTrigger value="settings" className="px-3">Settings</TabsTrigger>}
            </TabsList>
            <div className="ml-auto flex items-center justify-end gap-0.5 [&>[aria-label]]:max-sm:hidden">
              {canEdit && (
                <IconBtn label={aiOpen ? "Hide assistant" : "Assistant"} onClick={() => setAiOpen((o) => !o)} pressed={aiOpen}>
                  <SparkleIcon className="text-support" />
                </IconBtn>
              )}
              <IconBtn label="Preview" onClick={() => setTab(tab === "preview" ? "questions" : "preview")} pressed={tab === "preview"}>
                <EyeIcon />
              </IconBtn>
              {canEdit && (
                <IconBtn label="Undo (⌘Z)" onClick={doUndo}>
                  <UndoIcon />
                </IconBtn>
              )}
              {canEdit && (
                <Button size="sm" className="ml-1.5 h-8 px-4" onClick={() => setSendOpen(true)}>
                  <span>Send</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className={aiOpen && isLg && canEdit ? "grid w-full flex-1 bg-muted lg:grid-cols-[minmax(0,1fr)_380px]" : "w-full flex-1 bg-muted"}>
          <div className="min-w-0 px-3 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto max-w-[768px]">
              <TabsContent value="questions" className="pb-28">
                {!canEdit && (
                  <>
                    <p className="mb-4 rounded-xl border bg-card px-4 py-3 text-sm">You have view-only access. Ask a workspace owner to make you an editor.</p>
                    <FormRunner formId={form.id} draft={draft} preview />
                  </>
                )}
                {canEdit && (
                  <div ref={canvas} className="relative space-y-3">
                    <header id="card-__header" className="rounded-xl border bg-card px-6 py-5" onFocusCapture={() => setActive(null)}>
                      <input
                        aria-label="Form title"
                        value={draft.title}
                        onChange={(e) => patchDraft({ title: e.target.value })}
                        className="w-full bg-transparent text-[26px] font-semibold tracking-[-0.015em] outline-none placeholder:text-muted-foreground"
                        placeholder="Untitled form"
                      />
                      <textarea
                        aria-label="Form description"
                        value={draft.description}
                        onChange={(e) => patchDraft({ description: e.target.value })}
                        rows={1}
                        placeholder="Form description"
                        className="mt-1 w-full resize-none bg-transparent text-[15px] text-muted-foreground outline-none [field-sizing:content]"
                      />
                    </header>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                        {draft.fields.map((f, i) => (
                          <div key={f.id} id={`card-${f.id}`} className="scroll-mt-24">
                            <QuestionCard
                              field={f}
                              index={i}
                              earlier={draft.fields.slice(0, i)}
                              sections={draft.fields.filter((x) => x.type === "section").map((x) => ({ id: x.id, label: x.label || "Untitled section" }))}
                              active={active === f.id}
                              onActivate={setActive}
                              onChange={onChange}
                              onDuplicate={onDuplicate}
                              onDelete={onDelete}
                              quiz={Boolean(draft.quiz?.enabled)}
                            />
                          </div>
                        ))}
                      </SortableContext>
                    </DndContext>

                    <SideToolbar top={barTop} onAdd={addAfterActive} onAi={() => setAiOpen(true)} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="responses">
                <ResponsesView
                  formId={form.id}
                  draft={draft}
                  responses={responses}
                  csvUrl={csvUrl}
                  canEdit={canEdit}
                  sheets={canEdit ? <LinkSheets formId={form.id} csvKey={csvKey} onCsvKey={setCsvKey} initial={form.settings.sheet ?? null} /> : null}
                />
              </TabsContent>
              <TabsContent value="settings">
                <SettingsPanel formId={form.id} draft={draft} settings={settings} onDraft={patchDraft} onSettings={(p) => setSettings((s) => ({ ...s, ...p }))} />
              </TabsContent>
              <TabsContent value="preview">
                <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Preview. Submissions here are not saved.</span>
                  <button type="button" onClick={() => setTab("questions")} className="font-medium text-foreground underline-offset-4 hover:underline">
                    Back to editing
                  </button>
                </div>
                <FormRunner formId={form.id} draft={draft} preview />
              </TabsContent>
            </div>
          </div>

          {canEdit && aiOpen && isLg && <div className="sticky top-12 h-[calc(100dvh-7rem-2px)] border-l bg-card">{ai}</div>}
        </div>
      </Tabs>

      {canEdit && !isLg && (
        <Sheet open={aiOpen} onOpenChange={setAiOpen}>
          <SheetContent side="bottom" className="h-[85dvh] gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]">
            <SheetTitle className="sr-only">Assistant</SheetTitle>
            {ai}
          </SheetContent>
        </Sheet>
      )}

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Send form</DialogTitle>
          </DialogHeader>
          <SharePanel
            formId={form.id}
            origin={origin}
            fields={draft.fields}
            webhook={settings.webhook}
            onWebhook={(webhook) => {
              setSettings((s) => ({ ...s, webhook }));
              toast.success(webhook ? "Webhook saved. New responses will be pushed." : "Webhook removed");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useIsLg() {
  const [lg, setLg] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    setLg(m.matches);
    const h = (e: MediaQueryListEvent) => setLg(e.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return lg;
}

function IconBtn({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label={label} aria-pressed={pressed} onClick={onClick} className={pressed ? "bg-accent" : undefined} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Google-Forms-style toolbar beside the selected question; a bottom bar on phones. */
function SideToolbar({ top, onAdd, onAi }: { top: number; onAdd: (t: Field["type"]) => void; onAi: () => void }) {
  const SectionI = TYPE_ICONS.section;
  return (
    <div
      className="z-10 flex gap-0.5 rounded-xl border bg-card p-1 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:mx-auto max-lg:w-fit max-lg:shadow-md lg:absolute lg:-right-14 lg:top-(--bar-top) lg:flex-col lg:transition-[top] lg:duration-200 lg:ease-out"
      style={{ "--bar-top": `${top}px` } as React.CSSProperties}
    >
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Add question" />}>
          <PlusIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="left" align="start" className="w-64 p-1.5">
          <div className="grid grid-cols-2 gap-0.5">
            {FIELD_TYPES.filter((t) => t !== "section").map((t) => {
              const I = TYPE_ICONS[t];
              return (
                <DropdownMenuItem key={t} onClick={() => onAdd(t)}>
                  <I /> {TYPE_LABELS[t]}
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconBtn label="Add section" onClick={() => onAdd("section")}>
        <SectionI />
      </IconBtn>
      <IconBtn label="Ask the assistant" onClick={onAi}>
        <SparkleIcon className="text-support" />
      </IconBtn>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  return (
    <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground sm:inline-flex" aria-live="polite">
      {state === "saving" && (
        <>
          <SpinnerIcon className="size-3.5 animate-spin" /> Saving
        </>
      )}
      {state === "saved" && (
        <>
          <CheckIcon className="size-3.5 text-success" /> Saved
        </>
      )}
      {state === "error" && (
        <>
          <CloudOffIcon className="size-3.5 text-destructive" /> Not saved, retrying on next edit
        </>
      )}
    </span>
  );
}
