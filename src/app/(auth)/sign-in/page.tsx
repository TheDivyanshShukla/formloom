import { Suspense } from "react";
import { AuthForm } from "@/features/auth/components/auth-form";
import { googleEnabled } from "@/server/auth";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <AuthForm mode="sign-in" google={googleEnabled} />
    </Suspense>
  );
}
