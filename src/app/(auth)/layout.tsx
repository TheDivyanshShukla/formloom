import { Logo } from "@/components/shared/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden p-10 lg:flex lg:flex-col">
        <Logo />
        <div className="mt-auto max-w-md">
          <p className="text-[32px] font-semibold leading-tight tracking-[-0.02em]">One sentence in. A finished form out.</p>
          <ul className="mt-8 space-y-2.5">
            {[
              "Demo request form, qualify leads by team size and budget",
              "Vendor onboarding with GSTIN, bank details and documents",
              "Quarterly NPS survey that asks why only when the score is low",
            ].map((p) => (
              <li key={p} className="rounded-xl rounded-bl-sm border bg-card px-4 py-3 text-sm">
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">For freelancers, teams and whole organisations.</p>
        </div>
      </aside>
      <main className="flex flex-col bg-card px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:px-12 lg:m-2 lg:rounded-2xl lg:border">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
