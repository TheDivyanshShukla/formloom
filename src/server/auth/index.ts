import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { signInInput } from "@/features/auth/server/schema";
import { upsertOAuthUser, verifyCredentials } from "@/features/auth/server/service";
import { env } from "@/server/env";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    ...(googleEnabled ? [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })] : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = signInInput.safeParse(raw);
        if (!parsed.success) return null;
        return verifyCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        token.uid = (await upsertOAuthUser(user.email, user.name, user.image)).id;
      } else if (user?.id) {
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      return session;
    },
  },
});

/** Server-side gate for pages, actions and handlers. Never trust the proxy's optimistic check alone. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user;
}

export async function currentUserId(): Promise<string | null> {
  return (await auth())?.user?.id ?? null;
}
