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
import { bangers, plexMono, thmanyahSans } from "@/fonts";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { buttonVariants } from "@/components/ui/button";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import { THEME_COLOR } from "./manifest";
import { ConvexClientProvider } from "./providers";
import "./globals.css";

const TITLE = "pastehtml — publish HTML, get a URL";
const DESCRIPTION =
  "Drop an HTML or Markdown file and it goes live instantly on its own URL. No account needed. Publish from the browser, a terminal, the REST API or an MCP agent.";

/**
 * `metadataBase` is what turns every relative URL below — the OG image, the
 * canonical link — into the absolute one a crawler and a social scraper need.
 * It comes from `NEXT_PUBLIC_APP_URL`, so a preview deployment advertises
 * itself rather than production.
 *
 * The card image itself is `app/opengraph-image.tsx`, with
 * `app/twitter-image.tsx` re-exporting it; Next discovers both by convention
 * and fills in `og:image`, `twitter:image` and their dimensions, so nothing
 * here names them. The card only has to declare its shape.
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

// Single-theme by design: the halftone paper *is* the identity, so there is no
// dark palette to switch to. Saying so keeps form controls and scrollbars on
// the paper rather than the browser rendering them for a dark page.
export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${thmanyahSans.variable} ${bangers.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          appearance={{
            theme: shadcn,
            // Clerk renders its own markup, so the comic palette reaches it
            // through these variables rather than through the stylesheet.
            variables: {
              colorPrimary: "#e62429",
              colorPrimaryForeground: "#ffffff",
              colorBackground: "#ffffff",
              colorForeground: "#18120e",
              colorInput: "#fff8ec",
              colorInputForeground: "#18120e",
              colorBorder: "#18120e",
              colorDanger: "#e62429",
              colorRing: "#0072ce",
              borderRadius: "0px",
            },
          }}
          afterSignOutUrl="/"
        >
          <ConvexClientProvider>
            <Header />
            {children}
            <Footer />
            <RegisterServiceWorker />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

/**
 * The masthead. Nothing in it is square to the page: the wordmark and each nav
 * chip sit at a degree or two, which is what stops a row of ink boxes reading
 * as a toolbar. The rotations are dropped on `:active` by the button itself,
 * so a pressed chip travels straight into its shadow.
 */
function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
      <Link
        href="/"
        className="border-ink shadow-comic-sm font-display bg-card inline-block -rotate-1 border-3 px-3 pt-2 pb-1 text-2xl tracking-wide sm:text-3xl"
      >
        pastehtml<span className="text-hero-red">.assoli.site</span>
      </Link>
      <nav className="flex items-center gap-2.5" aria-label="Account">
        <Show when="signed-out">
          <SignInButton>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "rotate-1",
              )}
            >
              Sign in
            </button>
          </SignInButton>
          <SignUpButton>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "-rotate-1",
              )}
            >
              Sign up
            </button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "rotate-1",
            )}
          >
            Dashboard
          </Link>
          <UserButton />
        </Show>
      </nav>
    </header>
  );
}

/** The back cover: ink block, reversed out, with the issue number on it. */
function Footer() {
  return (
    <footer className="mt-12 px-4 pb-8 sm:px-8">
      <div className="border-ink shadow-comic bg-ink text-paper flex flex-wrap items-center justify-between gap-4 border-3 px-5 py-5 sm:px-6">
        <div>
          <p className="font-display text-paper text-2xl tracking-wide">
            pastehtml<span className="text-hero-red">.assoli.site</span>
          </p>
          <p className="text-paper/60 mt-1 text-sm">Publish HTML, get a URL.</p>
        </div>
        <nav
          aria-label="Elsewhere"
          className="flex flex-wrap gap-2 font-mono text-xs font-semibold tracking-[0.1em] uppercase"
        >
          <a
            href="https://github.com/haithamassoli/pastehtml/blob/main/docs/api.md"
            className="border-paper hover:bg-hero-yellow hover:border-hero-yellow hover:text-ink border-2 px-2.5 py-1.5"
          >
            API
          </a>
          <a
            href="https://github.com/haithamassoli/pastehtml"
            className="border-paper hover:bg-hero-yellow hover:border-hero-yellow hover:text-ink border-2 px-2.5 py-1.5"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
