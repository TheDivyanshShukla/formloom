import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/shared/brand";
import { OrgIcon } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { acceptInviteAction } from "@/features/workspaces/actions";
import { inviteInfo } from "@/features/workspaces/server/service";
import { auth } from "@/server/auth";

export const metadata: Metadata = { title: "Join workspace", robots: { index: false } };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <Logo />
        <Suspense fallback={<div className="mt-10 h-48 rounded-xl border bg-card" />}>
          <Invite params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Invite({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const [inv, session] = await Promise.all([inviteInfo(token), auth()]);
  if (!inv)
    return (
      <div className="mt-10">
        <h1 className="text-[22px] font-semibold">This invite has expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ask the workspace owner for a new link.</p>
      </div>
    );
  const next = `/invite/${token}`;
  return (
    <div className="mt-10 rounded-xl border bg-card p-6">
      <span className="mx-auto text-muted-foreground">
        <OrgIcon className="size-6" />
      </span>
      <h1 className="mt-4 text-[22px] font-semibold">Join {inv.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">You were invited as {inv.role === "editor" ? "an editor" : "a viewer"}.</p>
      {session?.user ? (
        <form action={acceptInviteAction.bind(null, token)} className="mt-6">
          <Button type="submit" className="h-11 w-full">
            Join workspace
          </Button>
        </form>
      ) : (
        <div className="mt-6 grid gap-2">
          <Button className="h-11" render={<Link href={`/sign-up?next=${encodeURIComponent(next)}`} />}>
            Create an account to join
          </Button>
          <Button variant="ghost" className="h-11" render={<Link href={`/sign-in?next=${encodeURIComponent(next)}`} />}>
            I already have an account
          </Button>
        </div>
      )}
    </div>
  );
}
