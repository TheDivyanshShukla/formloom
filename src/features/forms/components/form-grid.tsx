import Link from "next/link";
import { EmptyState } from "@/components/shared/brand";
import { FileTextIcon } from "@/components/shared/icons";
import { currentWorkspace } from "@/features/workspaces/server/service";
import { requireUser } from "@/server/auth";
import { listForms } from "../server/service";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [u, n] of units) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
  return "just now";
}

export async function FormGrid() {
  const user = await requireUser();
  const ws = await currentWorkspace(user.id);
  const forms = await listForms(user.id, ws.id);
  const total = forms.reduce((a, f) => a + f.responses, 0);
  return (
    <section aria-labelledby="forms-h">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 id="forms-h" className="text-base font-semibold">
          {ws.personal ? "Your forms" : `Forms in ${ws.name}`}
        </h2>
        {forms.length > 0 && (
          <span className="num text-sm text-muted-foreground">
            {forms.length} form{forms.length === 1 ? "" : "s"} · {total} response{total === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {forms.length === 0 ? (
        <EmptyState icon={<FileTextIcon />} title="No forms yet">
          Describe one above, or start from one of the examples.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground max-sm:hidden">
              <tr>
                <th className="border-b px-4 py-2.5 font-medium">Name</th>
                <th className="w-28 border-b px-4 py-2.5 text-right font-medium">Questions</th>
                <th className="w-28 border-b px-4 py-2.5 text-right font-medium">Responses</th>
                <th className="w-28 border-b px-4 py-2.5 font-medium">Status</th>
                <th className="w-36 border-b px-4 py-2.5 text-right font-medium">Edited</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {forms.map((f) => (
                <tr key={f.id} className="group relative transition-colors hover:bg-muted max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-3 max-sm:px-4 max-sm:py-3">
                  <td className="px-4 py-3 max-sm:w-full max-sm:p-0">
                    <Link href={`/forms/${f.id}`} className="flex items-center gap-3 font-medium outline-none after:absolute after:inset-0 focus-visible:underline">
                      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: f.color }} aria-hidden />
                      <span className="truncate">{f.title}</span>
                    </Link>
                  </td>
                  <td className="num px-4 py-3 text-right text-muted-foreground max-sm:hidden">{f.questions}</td>
                  <td className="num px-4 py-3 text-right max-sm:p-0 max-sm:text-xs max-sm:text-muted-foreground">
                    {f.responses}
                    <span className="sm:hidden"> responses</span>
                  </td>
                  <td className="px-4 py-3 max-sm:p-0">
                    <span className={f.accepting ? "inline-flex items-center gap-1.5 text-sm" : "inline-flex items-center gap-1.5 text-sm text-muted-foreground"}>
                      <span className={f.accepting ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full border border-muted-foreground"} aria-hidden />
                      {f.accepting ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground max-sm:ml-auto max-sm:p-0 max-sm:text-xs">{ago(f.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function FormGridSkeleton() {
  return (
    <div className="space-y-2" aria-busy>
      <div className="h-5 w-40 rounded bg-muted" />
      <div className="h-48 rounded-xl border bg-muted" />
    </div>
  );
}
