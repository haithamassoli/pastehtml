import Link from "next/link";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/status-page";

export const metadata: Metadata = { title: "Not found" };

/**
 * Both the `notFound()` UI and, being the root one, the answer to every URL the
 * app does not route. A visitor who lands here has usually mistyped a paste
 * token or followed a link to one that was deleted, so it says so.
 *
 * Not the 404 a *paste* origin gives: that one never reaches Next's router —
 * `proxy.ts` answers it — and it must not carry app markup onto a paste host.
 */
export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Nothing here"
      actions={
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline" })}
        >
          Your pastes
        </Link>
      }
    >
      <p>
        This page does not exist. If you followed a link to a paste, it may have
        been deleted or its token mistyped — tokens are case-sensitive.
      </p>
    </StatusPage>
  );
}
