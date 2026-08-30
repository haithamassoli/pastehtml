import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { thmanyahSans } from "@/fonts";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { config } from "@/lib/config";
import { THEME_COLOR } from "./manifest";
import { ConvexClientProvider } from "./providers";
import "./globals.css";

const TITLE = "pastehtml — publish HTML, get a URL";
const DESCRIPTION =
  "Drop an HTML file and it goes live instantly on its own URL. No account needed. Publish from the browser, a terminal, the REST API or an MCP agent.";

/**
 * `metadataBase` is what turns every relative URL below — the OG image, the
 * canonical link — into the absolute one a crawler and a social scraper need.
 * It comes from `NEXT_PUBLIC_APP_URL`, so a preview deployment advertises
 * itself rather than production.
 *
 * The Open Graph image itself is `app/opengraph-image.tsx`; Next discovers it
 * by convention and fills in `og:image` and its dimensions, so nothing here
 * names it. X falls back to `og:image` when `twitter:image` is absent, so the
 * card only has to declare its shape.
 */
export const metadata: Metadata = {
  metadataBase: new URL(config.appUrl),
  title: { default: TITLE, template: "%s · pastehtml" },
  description: DESCRIPTION,
  applicationName: "pastehtml",
  keywords: [
    "publish HTML",
    "HTML hosting",
    "paste HTML",
    "instant URL",
    "static page hosting",
    "share HTML file",
    "HTML pastebin",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "pastehtml",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  appleWebApp: { capable: true, title: "pastehtml", statusBarStyle: "default" },
  // Nothing here is a phone number or an address; Safari linkifying a token
  // that happens to look like one would be a broken link in the middle of a URL.
  formatDetection: { telephone: false, address: false, date: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${thmanyahSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ClerkProvider appearance={{ theme: shadcn }} afterSignOutUrl="/">
          <ConvexClientProvider>
            <header className="flex items-center justify-end gap-3 border-b border-black/[.08] px-6 py-3 dark:border-white/[.145]">
              <Show when="signed-out">
                <SignInButton />
                <SignUpButton />
              </Show>
              <Show when="signed-in">
                <Link href="/dashboard" className="text-sm hover:underline">
                  Dashboard
                </Link>
                <UserButton />
              </Show>
            </header>
            {children}
            <RegisterServiceWorker />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
