"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Root: theme only, so public form pages ship as little JS as possible. */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

/** Builder/dashboard extras: tooltips and toasts. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={300}>
      {children}
      <Toaster position="bottom-center" mobileOffset={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }} />
    </TooltipProvider>
  );
}
