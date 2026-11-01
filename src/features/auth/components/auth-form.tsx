"use client";

import {
  SpinnerIcon,
} from "@/components/shared/icons";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { googleSignInAction, signInAction, signUpAction } from "../actions";

export function AuthForm({ mode, google }: { mode: "sign-in" | "sign-up"; google: boolean }) {
  const next = useSearchParams().get("next") ?? "/forms";
  const [state, action, pending] = useActionState(mode === "sign-in" ? signInAction : signUpAction, undefined);
  const up = mode === "sign-up";

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[28px] font-semibold tracking-[-0.015em]">{up ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {up ? "Build your first form in under a minute." : "Sign in to your forms and responses."}
      </p>

      {google && (
        <>
          <form action={googleSignInAction} className="mt-8">
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline" className="h-11 w-full gap-2.5 text-[15px]">
              <GoogleMark /> Continue with Google
            </Button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form action={action} className={google ? "space-y-4" : "mt-8 space-y-4"}>
        <input type="hidden" name="next" value={next} />
        {up && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" required defaultValue={state?.name} key={`n${state?.name}`} className="h-11" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} key={`e${state?.email}`} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={up ? "new-password" : "current-password"}
            minLength={up ? 8 : undefined}
            required
            className="h-11"
          />
          {up && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
        </div>
        {state?.error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 w-full text-[15px]">
          {pending && <SpinnerIcon className="animate-spin" />}
          {up ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {up ? "Already have an account? " : "New to Formloom? "}
        <Link
          href={`${up ? "/sign-in" : "/sign-up"}${next !== "/forms" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {up ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.7H2v2.9A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.7 13.9a6.6 6.6 0 0 1 0-4.2V6.8H2a11 11 0 0 0 0 9.9l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.2-3.2A11 11 0 0 0 2 6.8l3.7 2.9C6.6 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}
