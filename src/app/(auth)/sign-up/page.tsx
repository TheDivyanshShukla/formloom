import { Suspense } from "react";
import { AuthForm } from "@/features/auth/components/auth-form";
import { googleEnabled } from "@/server/auth";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthForm mode="sign-up" google={googleEnabled} />
    </Suspense>
  );
}
