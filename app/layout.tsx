import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import Link from "next/link";
import { thmanyahSans } from "@/fonts";
import { ConvexClientProvider } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "pastehtml",
  description: "Publish HTML and get an instant public URL.",
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
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
