import { Suspense } from "react";
import { Logo } from "@/components/shared/brand";
import { AppProviders } from "@/components/shared/providers";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/features/auth/components/user-menu";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";

/**
 * Framed sheet: the 48px top bar sits on the stone frame with no rule; the work lives on a white
 * sheet inset 8px from the window, scrolling on its own. On a phone the sheet becomes the screen.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppProviders>
      <div className="flex h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pb-0">
        <header className="flex h-12 min-w-0 shrink-0 items-center gap-2 px-3 sm:px-4">
          <Logo href="/forms" compact />
          <span className="mx-1 h-5 w-px bg-border max-sm:hidden" aria-hidden />
          <Suspense fallback={<div className="h-8 w-32 rounded-md bg-accent" />}>
            <WorkspaceSwitcher />
          </Suspense>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Suspense fallback={<div className="size-8 rounded-full bg-accent" />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <div id="sheet" className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t bg-card sm:mx-2 sm:mb-[max(0.5rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:border">
          {children}
        </div>
      </div>
    </AppProviders>
  );
}
