// biome-ignore-all lint/a11y: div-based virtualized ARIA grid; keyboard handled on the focusable grid container
"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from "react";
import { ArrowUpIcon, SearchIcon } from "@/components/shared/icons";
import { Input } from "@/components/ui/input";
import { answerText } from "@/features/forms/logic";
import { type Field, isFileAnswer } from "@/features/forms/schema";
import type { ResponseDTO } from "../server/service";
import { buildRows, clampWidth, defaultWidth, filterRows, nextSort, type Sort, sortRows } from "./responses-grid.logic";

const ROW_H = 36;
const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function ResponsesGrid({ fields, responses }: { fields: Field[]; responses: ResponseDTO[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>(null);
  const [sel, setSel] = useState<{ row: number; col: number } | null>(null);
  const [widths, setWidths] = useState<Record<number, number>>({});
  const scroller = useRef<HTMLDivElement>(null);

  const all = useMemo(() => buildRows(fields, responses), [fields, responses]);
  const rows = useMemo(() => sortRows(filterRows(all, q), fields, sort), [all, q, fields, sort]);

  const heads = ["Submitted", ...fields.map((f) => f.label)];
  const w = (c: number) => widths[c] ?? defaultWidth(c === 0 ? "date" : fields[c - 1]!.type);
  const total = heads.reduce((s, _, c) => s + w(c), 0);

  const virt = useVirtualizer({ count: rows.length, getScrollElement: () => scroller.current, estimateSize: () => ROW_H, overscan: 12 });

  const text = (row: number, col: number) => {
    const g = rows[row];
    if (!g) return "";
    return col === 0 ? dateFmt.format(g.time) : (g.texts[col - 1] ?? "");
  };

  const onKey = (e: KeyboardEvent) => {
    if (!sel) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      void navigator.clipboard?.writeText(text(sel.row, sel.col));
      return;
    }
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const row = Math.min(rows.length - 1, Math.max(0, sel.row + d[0]!));
    const col = Math.min(heads.length - 1, Math.max(0, sel.col + d[1]!));
    setSel({ row, col });
    virt.scrollToIndex(row);
  };

  const startResize = (c: number) => (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = w(c);
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => setWidths((s) => ({ ...s, [c]: clampWidth(w0 + ev.clientX - x0) }));
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const cellCls = (c: number, row: number | null) =>
    `relative flex h-9 shrink-0 items-center border-r border-border px-3 ${c === 0 ? "sticky left-0 z-10 bg-card" : ""} ${row !== null && sel?.row === row && sel.col === c ? "outline outline-1 -outline-offset-1 outline-foreground" : ""}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers" aria-label="Search answers" className="h-9 pl-9" />
        </div>
        <span className="num text-sm text-muted-foreground">
          {rows.length} of {all.length} rows
        </span>
      </div>
      <div
        ref={scroller}
        tabIndex={0}
        role="grid"
        aria-rowcount={rows.length + 1}
        aria-colcount={heads.length}
        onKeyDown={onKey}
        className="h-[560px] w-full overflow-auto rounded-xl border border-border bg-card text-[13px] text-foreground outline-none"
      >
        <div style={{ width: total, minWidth: "100%" }}>
          <div role="row" className="sticky top-0 z-20 flex border-b border-border bg-muted text-xs text-muted-foreground" style={{ width: total }}>
            {heads.map((h, c) => (
              <div
                key={c}
                role="columnheader"
                aria-sort={sort?.col === c ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                style={{ width: w(c) }}
                className={`relative flex h-9 shrink-0 cursor-pointer select-none items-center gap-1 border-r border-border px-3 font-medium ${c === 0 ? "sticky left-0 z-30 bg-muted" : ""}`}
                onClick={() => setSort(nextSort(sort, c))}
                title={h}
              >
                <span className="min-w-0 truncate">{h}</span>
                {sort?.col === c && <ArrowUpIcon className={`size-3 shrink-0 ${sort.dir === "desc" ? "rotate-180" : ""}`} />}
                <span onPointerDown={startResize(c)} onClick={(e) => e.stopPropagation()} className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none" />
              </div>
            ))}
          </div>
          <div style={{ height: virt.getTotalSize(), width: total, position: "relative" }}>
            {virt.getVirtualItems().map((v) => {
              const g = rows[v.index]!;
              return (
                <div key={g.r.id} role="row" aria-rowindex={v.index + 2} className="absolute left-0 flex border-b border-border hover:bg-muted/50" style={{ top: 0, height: ROW_H, width: total, transform: `translateY(${v.start}px)` }}>
                  {heads.map((_, c) => (
                    <div
                      key={c}
                      role="gridcell"
                      style={{ width: w(c) }}
                      className={`${cellCls(c, v.index)} ${c === 0 ? "num text-muted-foreground" : ""}`}
                      title={text(v.index, c)}
                      onClick={() => {
                        setSel({ row: v.index, col: c });
                        scroller.current?.focus({ preventScroll: true });
                      }}
                    >
                      <span className="min-w-0 truncate">{c === 0 ? dateFmt.format(g.time) : <CellContent f={fields[c - 1]!} a={g.r.answers[fields[c - 1]!.id]} />}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {!rows.length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">{q.trim() ? `No responses match “${q}”.` : "No responses yet."}</p>}
        </div>
      </div>
    </div>
  );
}

function CellContent({ f, a }: { f: Field; a: ResponseDTO["answers"][string] | undefined }) {
  if (a === undefined) return <span className="sr-only">No answer</span>;
  if (isFileAnswer(a))
    return (
      <a href={`/api/files/${a.key}`} onClick={(e) => e.stopPropagation()} className="font-medium text-foreground underline underline-offset-4">
        {a.name}
      </a>
    );
  return <>{answerText(f, a)}</>;
}
