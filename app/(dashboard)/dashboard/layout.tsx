import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

// Dashboard shell — signed-in area. Auth is enforced here so every nested
// route inherits the guard.
//
// It also settles the cache policy for everything under it: `auth()` reads the
// request, which makes this layout and every page beneath it dynamic, and Next
// answers a dynamic render `private, no-cache, no-store, max-age=0,
// must-revalidate`. Nothing to configure — one user's pastes must never be
// served to another, and the guard that enforces that is the same fact that
// stops the response being stored.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="border-ink shadow-comic-xs bg-hero-yellow inline-block -rotate-1 border-2 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase">
            Your pastes
          </p>
          <h1 className="text-kapow mt-3 text-4xl tracking-wide sm:text-5xl">
            Dashboard
          </h1>
        </div>
        {/* The account menu itself is Clerk's `UserButton` in the root header,
            which is present on every page including this one. */}
        <Link href="/" className={buttonVariants()}>
          New paste
        </Link>
      </div>
      {/* Scrolls rather than wraps on a narrow screen, which is the whole of
          the mobile navigation. */}
      <nav className="flex gap-2.5 overflow-x-auto pb-2">
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Pastes
        </Link>
        <Link
          href="/dashboard/folders"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Folders
        </Link>
        <Link
          href="/dashboard/settings/api-keys"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          API keys
        </Link>
      </nav>
      {children}
    </div>
  );
}
