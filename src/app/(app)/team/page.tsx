import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TeamPanel } from "@/features/workspaces/components/team-panel";
import { currentWorkspace, listMembers } from "@/features/workspaces/server/service";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 rounded-xl border bg-card" />}>
        <Team />
      </Suspense>
    </main>
  );
}

async function Team() {
  const user = await requireUser();
  const ws = await currentWorkspace(user.id);
  if (ws.personal) redirect("/forms");
  const members = (await listMembers(user.id, ws.id)) ?? [];
  return <TeamPanel workspace={ws} members={members} me={user.id} />;
}
