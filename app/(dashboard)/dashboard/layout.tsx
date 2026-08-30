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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {/* The account menu itself is Clerk's `UserButton` in the root header,
            which is present on every page including this one. */}
        <Link href="/" className={buttonVariants({ size: "sm" })}>
          New paste
        </Link>
      </div>
      {/* Scrolls rather than wraps on a narrow screen, which is the whole of
          the mobile navigation. */}
      <nav className="border-border flex gap-4 overflow-x-auto border-b pb-2 text-sm">
        <Link href="/dashboard" className="font-medium whitespace-nowrap">
          Pastes
        </Link>
        <Link
          href="/dashboard/folders"
          className="font-medium whitespace-nowrap"
        >
          Folders
        </Link>
        <Link
          href="/dashboard/settings/api-keys"
          className="font-medium whitespace-nowrap"
        >
          API keys
        </Link>
      </nav>
      {children}
    </div>
  );
}
