import type { Answers } from "./schema";

/** Offline submission queue in localStorage, flushed when the device is back online. */
type Item = { formId: string; answers: Answers; at: number };
const KEY = "formloom:outbox";

const read = (): Item[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Item[];
  } catch {
    return [];
  }
};
const write = (items: Item[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
};

export function queue(formId: string, answers: Answers) {
  write([...read(), { formId, answers, at: Date.now() }]);
}

export const pending = (formId: string) => read().filter((i) => i.formId === formId).length;

let flushing = false;

/** Send queued items. Network failures keep them queued; server rejections (4xx) drop them. */
export async function flush(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of read()) {
      try {
        const res = await fetch(`/api/forms/${item.formId}/responses`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: item.answers }),
        });
        if (res.status === 429 || res.status >= 500) break;
        write(read().filter((x) => x.at !== item.at || x.formId !== item.formId));
        if (res.ok) sent++;
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}
