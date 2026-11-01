import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormRunner } from "@/features/forms/components/form-runner";
import { getPublicForm } from "@/features/forms/server/service";

export async function generateMetadata({ params }: PageProps<"/f/[id]">): Promise<Metadata> {
  await connection();
  const form = await getPublicForm((await params).id);
  if (!form) return { title: "Form not found" };
  return {
    title: form.draft.title,
    description: form.draft.description.slice(0, 160) || "Fill out this form",
    robots: { index: false },
  };
}

export default function PublicFormPage({ params }: PageProps<"/f/[id]">) {
  return (
    <main className="min-h-dvh px-3 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-12 sm:pt-12">
      <Suspense fallback={<RunnerSkeleton />}>
        <PublicForm params={params} />
      </Suspense>
    </main>
  );
}

async function PublicForm({ params }: { params: PageProps<"/f/[id]">["params"] }) {
  await connection();
  const form = await getPublicForm((await params).id);
  if (!form) notFound();
  return (
    <FormRunner
      formId={form.id}
      draft={form.draft}
      org={form.org ?? undefined}
      accepting={form.accepting}
      closedMessage={form.closedMessage}
      limitOne={form.limitOne}
      another={form.another}
      shuffleOptions={form.shuffleOptions}
      shuffleQuestions={form.shuffleQuestions}
      collectEmail={form.collectEmail}
    />
  );
}

function RunnerSkeleton() {
  return (
    <div className="mx-auto max-w-[720px]" aria-busy>
      <div className="mb-3 h-5 w-40 rounded bg-accent" />
      <div className="sheet h-[560px]" />
    </div>
  );
}
