import "server-only";
import { env } from "@/server/env";

/** Sends plain text through Resend. No-op when mail is not configured. Never throws. */
export async function sendMail(to: string[], subject: string, text: string): Promise<void> {
  const list = [...new Set(to.map((a) => a.trim()).filter(Boolean))];
  if (!list.length || !env.RESEND_API_KEY || !env.MAIL_FROM) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: list, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(JSON.stringify({ mail: "failed", status: res.status }));
  } catch (e) {
    console.error(JSON.stringify({ mail: "failed", error: e instanceof Error ? e.message : "network" }));
  }
}
