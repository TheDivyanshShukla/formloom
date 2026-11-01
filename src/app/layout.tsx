import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const sans = IBM_Plex_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"] });
// One job: IDs, patterns and example answers. The product is about formats, so they get their own face.
const mono = IBM_Plex_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Formloom: describe a form, get a form", template: "%s · Formloom" },
  description:
    "Open-source AI form builder. Describe what you need, get validation and conditional logic, share a link, and stream responses to Google Sheets or Excel.",
  openGraph: { siteName: "Formloom", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Paint under the notch (content is padded back with env(safe-area-inset-*)), and let the
  // software keyboard shrink the layout on Android so bottom-pinned UI moves with it.
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
