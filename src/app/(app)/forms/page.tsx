import { Suspense } from "react";
import { Composer } from "@/features/forms/components/composer";
import { FormGrid, FormGridSkeleton } from "@/features/forms/components/form-grid";

export const metadata = { title: "Your forms" };

export default function FormsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-8">
      <section className="pb-10 pt-8 sm:pt-12">
        <h1 className="text-[28px] font-semibold tracking-[-0.015em]">New form</h1>
        <p className="mt-1 max-w-xl text-[15px] text-muted-foreground">
          Describe what you need to collect. Formloom drafts questions, validation and logic, then asks about anything unclear.
        </p>
        <Composer />
      </section>
      <Suspense fallback={<FormGridSkeleton />}>
        <FormGrid />
      </Suspense>
    </main>
  );
}
