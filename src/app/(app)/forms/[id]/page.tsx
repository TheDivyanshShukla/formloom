import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Builder } from "@/features/forms/components/builder/builder";
import { getFormForUser } from "@/features/forms/server/service";
import { listResponses } from "@/features/responses/server/service";
import { currentWorkspace } from "@/features/workspaces/server/service";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Edit form" };

export default function EditFormPage({ params }: PageProps<"/forms/[id]">) {
  return (
    <Suspense fallback={<BuilderSkeleton />}>
      <Loaded params={params} />
    </Suspense>
  );
}

async function Loaded({ params }: { params: PageProps<"/forms/[id]">["params"] }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const [form, responses, ws] = await Promise.all([getFormForUser(user.id, id), listResponses(user.id, id), currentWorkspace(user.id)]);
  if (!form) notFound();
  return <Builder form={form} responses={responses ?? []} headerWorkspaceId={ws.id} />;
}

function BuilderSkeleton() {
  return (
    <div className="flex-1" aria-busy>
      <div className="h-12 border-b" />
      <div className="bg-muted px-3 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[768px] space-y-3">
          <div className="h-28 rounded-xl border bg-card" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl border bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
